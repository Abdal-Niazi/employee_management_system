const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, account } = require("./helpers");
const { countWorkingDays } = require("../src/services/meService");
const { todayKey } = require("../src/utils/companyTime");

let data;
let amir; // the EMPLOYEE account of A-1 (manager: Alice)
let ayesha; // an EMPLOYEE account for A-2
let alice; // a MANAGER account, who is also an employee
let hr;

const post = (headers, body) => request(app).post("/api/me/leave-requests").set(headers).send(body);
const request_ = { type: "Annual", startDate: "2027-03-01", endDate: "2027-03-03", reason: "Trip" };

before(async () => {
  data = await seedFixtures();
  await account("ayesha@example.com", "EMPLOYEE", data.a2.id);
  await account("floating@example.com", "EMPLOYEE", null);
  amir = await login("employee.a1@example.com");
  ayesha = await login("ayesha@example.com");
  alice = await login("manager.a@example.com");
  hr = await login("hr@example.com");
});
// Leave created by a test is removed, so the tests don't depend on each other.
beforeEach(() => prisma.leaveRequest.deleteMany({ where: { reason: "Trip" } }));
after(() => prisma.$disconnect());

describe("counting working days", () => {
  test("skips Saturday and Sunday", () => {
    assert.equal(countWorkingDays("2027-03-01", "2027-03-03"), 3);
    assert.equal(countWorkingDays("2027-03-05", "2027-03-09"), 3);
    assert.equal(countWorkingDays("2027-03-06", "2027-03-07"), 0);
    assert.equal(countWorkingDays("2027-03-04", "2027-03-04"), 1);
  });
});

describe("profile", () => {
  test("an employee sees their own details and manager", async () => {
    const res = await request(app).get("/api/me").set(amir);

    assert.equal(res.status, 200);
    assert.equal(res.body.employee.employeeId, "A-1");
    assert.equal(res.body.employee.manager.employeeId, "MGR-A");
  });

  test("a manager is an employee too", async () => {
    const res = await request(app).get("/api/me").set(alice);

    assert.equal(res.status, 200);
    assert.equal(res.body.employee.employeeId, "MGR-A");
    assert.equal(res.body.employee.manager, null);
  });

  test("HR admins have no employee profile, and an unlinked account is refused", async () => {
    assert.equal((await request(app).get("/api/me").set(hr)).status, 403);

    const floating = await login("floating@example.com");
    const res = await request(app).get("/api/me").set(floating);
    assert.equal(res.status, 403);
    assert.match(res.body.message, /isn't linked to an employee/);
  });

  test("everything needs a login", async () => {
    for (const path of ["/api/me", "/api/me/leave-requests"]) {
      assert.equal((await request(app).get(path)).status, 401);
    }
    assert.equal((await request(app).post("/api/me/leave-requests").send(request_)).status, 401);
    assert.equal((await request(app).delete("/api/me/leave-requests/1")).status, 401);
  });
});

describe("own leave", () => {
  test("lists only your own requests, with the company's today", async () => {
    const res = await request(app).get("/api/me/leave-requests").set(amir);

    assert.equal(res.status, 200);
    assert.equal(res.body.today, todayKey());
    assert.deepEqual(res.body.leaveRequests.map((r) => r.id).sort(), [data.leaveA1.id, data.approvedA1.id].sort());
    assert.ok(res.body.leaveRequests.every((r) => r.employeeId === "A-1"));
  });

  test("requests leave: pending, with the working days counted", async () => {
    const res = await post(ayesha, request_);

    assert.equal(res.status, 201);
    assert.equal(res.body.leaveRequest.status, "PENDING");
    assert.equal(res.body.leaveRequest.days, 3);
    assert.equal(res.body.leaveRequest.employeeId, "A-2");
    assert.equal(res.body.leaveRequest.managerName, "Alice Test");

    const across = await post(ayesha, { type: "Sick", startDate: "2027-05-07", endDate: "2027-05-11", reason: "Trip" });
    assert.equal(across.body.leaveRequest.days, 3);
  });

  test("the manager sees it and can approve it, and the employee sees who decided", async () => {
    const created = await post(ayesha, request_);
    const id = created.body.leaveRequest.id;
    const list = await request(app).get("/api/manager/leave-requests?status=PENDING").set(alice);
    assert.ok(list.body.leaveRequests.some((r) => r.id === id));

    await request(app).patch(`/api/manager/leave-requests/${id}`).set(alice).send({ status: "APPROVED" });

    const mine = await request(app).get("/api/me/leave-requests").set(ayesha);
    const decided = mine.body.leaveRequests.find((r) => r.id === id);
    assert.equal(decided.status, "APPROVED");
    assert.equal(decided.decidedBy, "Alice Test");
  });

  test("refuses a weekend-only range, too long a range and overlapping leave", async () => {
    assert.equal((await post(ayesha, { ...request_, startDate: "2027-03-06", endDate: "2027-03-07" })).status, 400);
    assert.equal((await post(ayesha, { ...request_, startDate: "2027-01-04", endDate: "2027-04-30" })).status, 400);

    // A-1 already has leave on 2 to 4 November 2026.
    const overlap = await post(amir, { ...request_, startDate: "2026-11-03", endDate: "2026-11-03" });
    assert.equal(overlap.status, 409);
  });

  test("two requests sent at the same moment can't both pass the overlap check", async () => {
    const results = await Promise.all([post(ayesha, request_), post(ayesha, request_), post(ayesha, request_)]);

    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
    assert.equal(await prisma.leaveRequest.count({ where: { employeeId: data.a2.id, reason: "Trip" } }), 1);
  });

  test("validates the form", async () => {
    assert.equal((await post(ayesha, { ...request_, type: "Holiday" })).status, 422);
    assert.equal((await post(ayesha, { ...request_, startDate: "2027-02-31" })).status, 422);
    assert.equal((await post(ayesha, { ...request_, startDate: "2027-03-05", endDate: "2027-03-01" })).status, 422);
    assert.equal((await post(ayesha, { ...request_, reason: "x".repeat(501) })).status, 422);
    assert.equal((await post(ayesha, { startDate: "2027-03-01" })).status, 422);
  });

  test("cancels your own pending request, once", async () => {
    const created = await post(ayesha, request_);
    const id = created.body.leaveRequest.id;

    assert.equal((await request(app).delete(`/api/me/leave-requests/${id}`).set(ayesha)).status, 200);
    assert.equal(await prisma.leaveRequest.count({ where: { id } }), 0);
    assert.equal((await request(app).delete(`/api/me/leave-requests/${id}`).set(ayesha)).status, 404);
  });

  test("won't cancel a decided request or someone else's", async () => {
    assert.equal((await request(app).delete(`/api/me/leave-requests/${data.approvedA1.id}`).set(amir)).status, 409);
    assert.equal((await request(app).delete(`/api/me/leave-requests/${data.leaveA2.id}`).set(amir)).status, 404);
    assert.equal((await request(app).delete("/api/me/leave-requests/abc").set(amir)).status, 400);
  });
});
