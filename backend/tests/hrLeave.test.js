const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, account } = require("./helpers");

let data;
let hr;
let managerA;
let amir; // an EMPLOYEE account
let loner; // an employee with no manager, and their pending request
let lonerLeave;

before(async () => {
  data = await seedFixtures();
  loner = await prisma.employee.create({
    data: { employeeId: "SOLO-1", firstName: "Sana", lastName: "Test", email: "solo-1@example.com", hireDate: new Date("2024-01-15") },
  });
  lonerLeave = await prisma.leaveRequest.create({
    data: { employeeId: loner.id, type: "Casual", startDate: new Date("2026-12-07"), endDate: new Date("2026-12-07"), days: 1, reason: "Errand" },
  });
  await account("amir@example.com", "EMPLOYEE", data.a1.id);
  hr = await login("hr@example.com");
  managerA = await login("manager.a@example.com");
  amir = await login("amir@example.com");
});
after(() => prisma.$disconnect());

describe("HR: all leave requests", () => {
  test("lists everyone's requests, including people with no manager", async () => {
    const res = await request(app).get("/api/leave-requests").set(hr);

    assert.equal(res.status, 200);
    const employees = new Set(res.body.leaveRequests.map((r) => r.employeeId));
    assert.ok(employees.has("A-1") && employees.has("A-2") && employees.has("B-1") && employees.has("SOLO-1"));

    const solo = res.body.leaveRequests.find((r) => r.employeeId === "SOLO-1");
    assert.equal(solo.managerName, null);
    const a1 = res.body.leaveRequests.find((r) => r.employeeId === "A-1");
    assert.equal(a1.managerName, "Alice Test");
  });

  test("filters by status and rejects unknown ones", async () => {
    const approved = await request(app).get("/api/leave-requests?status=APPROVED").set(hr);
    assert.ok(approved.body.leaveRequests.length >= 1);
    assert.ok(approved.body.leaveRequests.every((r) => r.status === "APPROVED"));

    assert.equal((await request(app).get("/api/leave-requests?status=WRONG").set(hr)).status, 400);
  });
});

describe("HR: deciding leave", () => {
  test("approves a request for someone with no manager, and records who did", async () => {
    const res = await request(app)
      .patch(`/api/leave-requests/${lonerLeave.id}`)
      .set(hr)
      .send({ status: "APPROVED", note: "Fine by HR" });

    assert.equal(res.status, 200);
    assert.equal(res.body.leaveRequest.status, "APPROVED");
    assert.equal(res.body.leaveRequest.decisionNote, "Fine by HR");
    assert.match(res.body.leaveRequest.decidedBy, /\(HR\)$/);
  });

  test("a request is decided only once", async () => {
    const again = await request(app).patch(`/api/leave-requests/${lonerLeave.id}`).set(hr).send({ status: "REJECTED" });
    assert.equal(again.status, 409);
  });

  test("HR can decide a request that belongs to a manager's team, and the manager can't then", async () => {
    const res = await request(app).patch(`/api/leave-requests/${data.leaveA2.id}`).set(hr).send({ status: "REJECTED" });
    assert.equal(res.status, 200);

    const late = await request(app).patch(`/api/manager/leave-requests/${data.leaveA2.id}`).set(managerA).send({ status: "APPROVED" });
    assert.equal(late.status, 409);
  });

  test("a manager's decision is credited to the manager", async () => {
    const res = await request(app).patch(`/api/manager/leave-requests/${data.leaveA1.id}`).set(managerA).send({ status: "APPROVED" });

    assert.equal(res.status, 200);
    assert.equal(res.body.leaveRequest.decidedBy, "Alice Test");
  });

  test("validates the decision and the id", async () => {
    assert.equal((await request(app).patch(`/api/leave-requests/${data.leaveB1.id}`).set(hr).send({ status: "MAYBE" })).status, 422);
    assert.equal((await request(app).patch("/api/leave-requests/999999").set(hr).send({ status: "APPROVED" })).status, 404);
    assert.equal((await request(app).patch("/api/leave-requests/abc").set(hr).send({ status: "APPROVED" })).status, 400);
  });

  test("the employee sees who decided", async () => {
    const res = await request(app).get("/api/me/leave-requests").set(amir);
    const decided = res.body.leaveRequests.find((r) => r.id === data.leaveA1.id);

    assert.equal(decided.status, "APPROVED");
    assert.equal(decided.decidedBy, "Alice Test");
  });
});

describe("who may use it", () => {
  test("managers and employees cannot use the HR leave API", async () => {
    for (const who of [managerA, amir]) {
      assert.equal((await request(app).get("/api/leave-requests").set(who)).status, 403);
      assert.equal((await request(app).patch(`/api/leave-requests/${data.leaveB1.id}`).set(who).send({ status: "APPROVED" })).status, 403);
    }
  });

  test("it needs a login", async () => {
    assert.equal((await request(app).get("/api/leave-requests")).status, 401);
    assert.equal((await request(app).patch(`/api/leave-requests/${data.leaveB1.id}`).send({ status: "APPROVED" })).status, 401);
  });
});
