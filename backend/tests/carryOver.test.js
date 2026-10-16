// Carry-over is on for this file (scripts/test.js turns it off for the others): up to 5 days of
// unused annual leave move into the next year, starting with 2027.
process.env.LEAVE_CARRY_OVER_DAYS = "5";
process.env.LEAVE_CARRY_OVER_FIRST_YEAR = "2027";

const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { app, prisma, request, seedFixtures, login, account } = require("./helpers");
const { CARRY_OVER } = require("../src/utils/leavePolicy");

let data;
let hr;
let amir; // A-1: 3 Annual days approved and 3 waiting in 2026, so 8 of 14 are left at the end of it

// A person with an employee account, hired on `hireDate`, with no leave yet.
const person = async (code, hireDate = "2024-01-15") => {
  const employee = await prisma.employee.create({
    data: { employeeId: code, firstName: code, lastName: "Test", email: `${code.toLowerCase()}@example.com`, hireDate: new Date(hireDate) },
  });
  await account(`${code.toLowerCase()}@example.com`, "EMPLOYEE", employee.id);

  return { employee, auth: await login(`${code.toLowerCase()}@example.com`) };
};

// A request saved straight in the database (so tests can use more days than a form allows).
const took = (employeeId, year, days, status = "APPROVED", month = "06") =>
  prisma.leaveRequest.create({
    data: { employeeId, type: "Annual", startDate: new Date(`${year}-${month}-01`), endDate: new Date(`${year}-${month}-01`), days, status },
  });

const annual = async (auth, year) => {
  const res = await request(app).get(`/api/me/leave-balance?year=${year}`).set(auth);
  assert.equal(res.status, 200);
  return res.body.balances.find((b) => b.type === "Annual");
};

const childEnv = (settings) => ({ ...process.env, LEAVE_CARRY_OVER_DAYS: "", LEAVE_CARRY_OVER_FIRST_YEAR: "", ...settings });
const policyIn = (settings) =>
  spawnSync(process.execPath, ["-e", "console.log(JSON.stringify(require('./src/utils/leavePolicy').CARRY_OVER))"], {
    cwd: path.join(__dirname, ".."),
    env: childEnv(settings),
    encoding: "utf8",
  });

before(async () => {
  data = await seedFixtures();
  hr = await login("hr@example.com");
  amir = await login("employee.a1@example.com");
});
after(() => prisma.$disconnect());

describe("the policy", () => {
  test("is 5 annual days, from 2027, unless the settings say otherwise", () => {
    assert.deepEqual({ ...CARRY_OVER }, { type: "Annual", days: 5, firstYear: 2027 });
    assert.deepEqual(JSON.parse(policyIn({}).stdout), { type: "Annual", days: 5, firstYear: 2027 });
    assert.deepEqual(JSON.parse(policyIn({ LEAVE_CARRY_OVER_DAYS: "0", LEAVE_CARRY_OVER_FIRST_YEAR: "2030" }).stdout), {
      type: "Annual",
      days: 0,
      firstYear: 2030,
    });
  });

  test("a bad setting stops the server at startup, saying which one", () => {
    const badDays = policyIn({ LEAVE_CARRY_OVER_DAYS: "-1" });
    assert.notEqual(badDays.status, 0);
    assert.match(badDays.stderr, /LEAVE_CARRY_OVER_DAYS must be a whole number/);

    for (const bad of ["abc", "1999", "2101", "2027.5"]) {
      const result = policyIn({ LEAVE_CARRY_OVER_FIRST_YEAR: bad });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /LEAVE_CARRY_OVER_FIRST_YEAR must be a year/);
    }
  });
});

describe("carrying days over", () => {
  test("unused annual days move into the next year, up to the limit", async () => {
    const res = await request(app).get("/api/me/leave-balance?year=2027").set(amir);
    const balance = Object.fromEntries(res.body.balances.map((b) => [b.type, b]));

    // 8 were left at the end of 2026, only 5 can move
    assert.deepEqual(balance.Annual, { type: "Annual", entitlement: 14, carriedOver: 5, used: 0, pending: 0, remaining: 19 });
    // Sick and casual days never carry over
    assert.deepEqual([balance.Sick.carriedOver, balance.Sick.remaining], [0, 8]);
    assert.deepEqual([balance.Casual.carriedOver, balance.Casual.remaining], [0, 6]);
  });

  test("the first year that gets carried days is 2027, so 2026 stays as it was", async () => {
    assert.deepEqual(await annual(amir, 2026), { type: "Annual", entitlement: 14, carriedOver: 0, used: 3, pending: 3, remaining: 8 });
  });

  test("only what was not taken moves, and days waiting for a decision count as taken", async () => {
    const low = await person("LOW-1");
    await took(low.employee.id, 2026, 12);
    const waiting = await person("WAIT-1");
    await took(waiting.employee.id, 2026, 13, "PENDING");

    assert.equal((await annual(low.auth, 2027)).carriedOver, 2);
    assert.equal((await annual(low.auth, 2027)).remaining, 16);
    assert.equal((await annual(waiting.auth, 2027)).carriedOver, 1);
  });

  test("a year with everything used, or only rejected requests, changes nothing", async () => {
    const used = await person("USED-1");
    await took(used.employee.id, 2026, 14);
    const rejected = await person("REJ-1");
    await took(rejected.employee.id, 2026, 14, "REJECTED");

    assert.deepEqual([(await annual(used.auth, 2027)).carriedOver, (await annual(used.auth, 2027)).remaining], [0, 14]);
    assert.deepEqual([(await annual(rejected.auth, 2027)).carriedOver, (await annual(rejected.auth, 2027)).remaining], [5, 19]);
  });

  test("carried days can carry on, but never more than the limit a year", async () => {
    // Nothing taken in 2027: 14 + 5 days are left, still only 5 move on (not 19)
    assert.equal((await annual(amir, 2028)).carriedOver, 5);
    assert.equal((await annual(amir, 2028)).remaining, 19);

    // 17 of the 19 days of 2027 are taken, so 2 are left to move into 2028
    const chain = await person("CHAIN-1");
    await took(chain.employee.id, 2027, 17);
    assert.equal((await annual(chain.auth, 2028)).carriedOver, 2);
    assert.equal((await annual(chain.auth, 2028)).remaining, 16);
    // and 2028 untouched leaves 16 behind, of which 5 move on
    assert.equal((await annual(chain.auth, 2029)).carriedOver, 5);
  });

  test("nothing moves into the year a person was hired", async () => {
    const hired27 = await person("NEW-27", "2027-03-01");
    const hired26 = await person("NEW-26", "2026-06-01");

    assert.deepEqual([(await annual(hired27.auth, 2027)).carriedOver, (await annual(hired27.auth, 2027)).remaining], [0, 14]);
    assert.equal((await annual(hired27.auth, 2028)).carriedOver, 5);
    assert.equal((await annual(hired26.auth, 2027)).carriedOver, 5);
  });
});

describe("asking for leave", () => {
  test("the carried days can be asked for, and no more", async () => {
    const ask = await person("ASK-1");
    const send = (startDate, endDate) =>
      request(app).post("/api/me/leave-requests").set(ask.auth).send({ type: "Annual", startDate, endDate, reason: "Carry-over test" });

    // 2027-03-01 is a Monday: four weeks are 20 working days, one more than the 14 + 5 there are
    const tooMany = await send("2027-03-01", "2027-03-26");
    assert.equal(tooMany.status, 409);
    assert.match(tooMany.body.message, /only have 19 Annual leave days left for 2027, and this request is for 20/);

    assert.equal((await send("2027-03-01", "2027-03-25")).status, 201);
    assert.equal((await annual(ask.auth, 2027)).remaining, 0);
    assert.equal((await send("2027-04-05", "2027-04-05")).status, 409);
  });

  test("the people deciding see the carried days in each year a request is for", async () => {
    const dec = await person("DEC-1");
    const in2027 = await took(dec.employee.id, 2027, 3, "PENDING", "05");
    const in2028 = await took(dec.employee.id, 2028, 2, "PENDING", "02");

    const res = await request(app).get("/api/leave-requests?status=PENDING").set(hr);
    const balanceOf = (leave) => res.body.leaveRequests.find((r) => r.id === leave.id).balance;

    assert.deepEqual(balanceOf(in2027), { year: 2027, type: "Annual", entitlement: 14, carriedOver: 5, used: 0, pending: 3, remaining: 16 });
    // 2027 leaves 14 + 5 - 3 = 16 behind, of which 5 move into 2028
    assert.deepEqual(balanceOf(in2028), { year: 2028, type: "Annual", entitlement: 14, carriedOver: 5, used: 0, pending: 2, remaining: 17 });

    // The same on the manager's list
    const team = await request(app).get("/api/manager/leave-requests?status=PENDING").set(await login("manager.a@example.com"));
    const a1 = team.body.leaveRequests.find((r) => r.id === data.leaveA1.id);
    assert.deepEqual([a1.balance.year, a1.balance.carriedOver, a1.balance.remaining], [2026, 0, 8]);
  });
});
