const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, account } = require("./helpers");
const { ENTITLEMENTS, readDays } = require("../src/utils/leavePolicy");

let data;
let amir; // A-1: has a pending and an approved Annual request, 3 working days each, in November 2026
let ayesha; // A-2: has a pending Annual request of 3 days in November 2026
let hr;

const balanceOf = async (headers, year = 2026) => {
  const res = await request(app).get(`/api/me/leave-balance?year=${year}`).set(headers);
  assert.equal(res.status, 200);
  return Object.fromEntries(res.body.balances.map((b) => [b.type, b]));
};
const ask = (headers, body) => request(app).post("/api/me/leave-requests").set(headers).send({ reason: "Balance test", ...body });
const request_ = (type, startDate, endDate) => ({ type, startDate, endDate });

before(async () => {
  data = await seedFixtures();
  await account("ayesha@example.com", "EMPLOYEE", data.a2.id);
  amir = await login("employee.a1@example.com"); // the fixtures give A-1 this account
  ayesha = await login("ayesha@example.com");
  hr = await login("hr@example.com");
});
after(() => prisma.$disconnect());

describe("the policy", () => {
  test("defaults are 14 annual, 8 sick and 6 casual days", () => {
    assert.deepEqual({ ...ENTITLEMENTS }, { Annual: 14, Sick: 8, Casual: 6 });
  });

  test("a setting must be a whole number of days", () => {
    process.env.TEST_LEAVE_DAYS = "10";
    assert.equal(readDays("TEST_LEAVE_DAYS", 3), 10);
    delete process.env.TEST_LEAVE_DAYS;
    assert.equal(readDays("TEST_LEAVE_DAYS", 3), 3);

    for (const bad of ["abc", "-1", "2.5", "400"]) {
      process.env.TEST_LEAVE_DAYS = bad;
      assert.throws(() => readDays("TEST_LEAVE_DAYS", 3), /TEST_LEAVE_DAYS must be a whole number/);
    }
    delete process.env.TEST_LEAVE_DAYS;
  });
});

describe("the balance", () => {
  test("counts approved and waiting days separately and subtracts both", async () => {
    const balance = await balanceOf(amir);

    assert.deepEqual(balance.Annual, { type: "Annual", entitlement: 14, used: 3, pending: 3, remaining: 8 });
    assert.deepEqual(balance.Sick, { type: "Sick", entitlement: 8, used: 0, pending: 0, remaining: 8 });
    assert.deepEqual(balance.Casual, { type: "Casual", entitlement: 6, used: 0, pending: 0, remaining: 6 });
  });

  test("is per person and per year", async () => {
    assert.equal((await balanceOf(ayesha)).Annual.used, 0);
    assert.equal((await balanceOf(ayesha)).Annual.pending, 3);
    assert.equal((await balanceOf(amir, 2027)).Annual.remaining, 14);
  });

  test("a rejected request does not count", async () => {
    const rejected = await prisma.leaveRequest.create({
      data: { employeeId: data.a2.id, type: "Sick", startDate: new Date("2026-12-07"), endDate: new Date("2026-12-09"), days: 3, status: "REJECTED" },
    });

    assert.equal((await balanceOf(ayesha)).Sick.remaining, 8);
    await prisma.leaveRequest.delete({ where: { id: rejected.id } });
  });

  test("refuses a bad year, and needs the right account", async () => {
    for (const year of ["abc", "1999", "2101", "2026.5"]) {
      assert.equal((await request(app).get(`/api/me/leave-balance?year=${year}`).set(amir)).status, 400);
    }
    assert.equal((await request(app).get("/api/me/leave-balance").set(hr)).status, 403);
    assert.equal((await request(app).get("/api/me/leave-balance")).status, 401);
  });
});

describe("asking for more than is left", () => {
  test("a request within the balance goes through, and holds its days back", async () => {
    // Five working days, 2027-03-01 (Monday) to 2027-03-05
    const res = await ask(ayesha, request_("Casual", "2027-03-01", "2027-03-05"));
    assert.equal(res.status, 201);

    const casual = (await balanceOf(ayesha, 2027)).Casual;
    assert.deepEqual([casual.pending, casual.remaining], [5, 1]);
  });

  test("another request that goes over what is left is refused, with the numbers", async () => {
    // One day is left of Casual in 2027; two days are not allowed
    const res = await ask(ayesha, request_("Casual", "2027-04-05", "2027-04-06"));

    assert.equal(res.status, 409);
    assert.match(res.body.message, /only have 1 Casual leave day left for 2027, and this request is for 2/);
    assert.equal((await ask(ayesha, request_("Casual", "2027-04-05", "2027-04-05"))).status, 201);
  });

  test("each kind of leave has its own balance", async () => {
    // Casual is used up, Annual and Sick are not
    assert.equal((await balanceOf(ayesha, 2027)).Casual.remaining, 0);
    assert.equal((await ask(ayesha, request_("Annual", "2027-05-03", "2027-05-04"))).status, 201);
    assert.equal((await ask(ayesha, request_("Casual", "2027-06-07", "2027-06-07"))).status, 409);
  });

  test("cancelling a waiting request gives its days back", async () => {
    const list = await request(app).get("/api/me/leave-requests").set(ayesha);
    const waiting = list.body.leaveRequests.find((r) => r.type === "Casual" && r.startDate === "2027-04-05");

    assert.equal((await request(app).delete(`/api/me/leave-requests/${waiting.id}`).set(ayesha)).status, 200);
    assert.equal((await balanceOf(ayesha, 2027)).Casual.remaining, 1);
  });

  test("a request counts towards the year it starts in", async () => {
    // Friday 31 December 2027 to Monday 3 January 2028: 2 working days, counted in 2027
    const res = await ask(amir, request_("Sick", "2027-12-31", "2028-01-03"));

    assert.equal(res.status, 201);
    assert.equal(res.body.leaveRequest.days, 2);
    assert.equal((await balanceOf(amir, 2027)).Sick.pending, 2);
    assert.equal((await balanceOf(amir, 2028)).Sick.pending, 0);
  });

  test("an old request for a year with no allowance left is refused too", async () => {
    // A-1 has already used 6 of 14 Annual days in 2026; 9 more do not fit
    const res = await ask(amir, request_("Annual", "2026-12-01", "2026-12-11"));

    assert.equal(res.status, 409);
    assert.match(res.body.message, /only have 8 Annual leave days left for 2026, and this request is for 9/);
  });
});
