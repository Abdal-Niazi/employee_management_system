const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");

let data;
let hr;
let managerA;
let soloLeave; // a pending 2027 request of an employee who has no manager

const leaveOf = (res, id) => res.body.leaveRequests.find((r) => r.id === id);

before(async () => {
  data = await seedFixtures();
  hr = await login("hr@example.com");
  managerA = await login("manager.a@example.com");

  // Two more requests for A-2 in 2027 (Annual 5 days pending) so the year is not the same as the fixtures'
  await prisma.leaveRequest.create({
    data: { employeeId: data.a2.id, type: "Annual", startDate: new Date("2027-03-01"), endDate: new Date("2027-03-05"), days: 5, status: "PENDING" },
  });
  const solo = await prisma.employee.create({
    data: { employeeId: "SOLO-9", firstName: "Sana", lastName: "Test", email: "solo-9@example.com", hireDate: new Date("2024-01-15") },
  });
  soloLeave = await prisma.leaveRequest.create({
    data: { employeeId: solo.id, type: "Sick", startDate: new Date("2027-04-05"), endDate: new Date("2027-04-06"), days: 2, status: "PENDING" },
  });
});
after(() => prisma.$disconnect());

describe("a manager deciding leave", () => {
  test("each pending request shows what is left of that kind in the year it starts", async () => {
    const res = await request(app).get("/api/manager/leave-requests?status=PENDING").set(managerA);

    // A-1 has 3 Annual days approved and 3 waiting in 2026: 8 of 14 left, counting this request
    assert.deepEqual(leaveOf(res, data.leaveA1.id).balance, {
      year: 2026,
      type: "Annual",
      entitlement: 14,
      used: 3,
      pending: 3,
      remaining: 8,
    });
    // A-2's 2026 request is measured against 2026, not against the 2027 one
    assert.equal(leaveOf(res, data.leaveA2.id).balance.pending, 3);
    assert.equal(leaveOf(res, data.leaveA2.id).balance.year, 2026);
    const in2027 = res.body.leaveRequests.find((r) => r.employeeId === "A-2" && r.startDate === "2027-03-01");
    assert.deepEqual([in2027.balance.year, in2027.balance.pending, in2027.balance.remaining], [2027, 5, 9]);
  });

  test("a request that is already decided has no balance", async () => {
    const res = await request(app).get("/api/manager/leave-requests?status=APPROVED").set(managerA);

    assert.ok(res.body.leaveRequests.length >= 1);
    assert.ok(res.body.leaveRequests.every((r) => r.balance === null));
  });

  test("a team member's leave history shows it too, and deciding a request clears it", async () => {
    const history = await request(app).get(`/api/manager/team/${data.a1.id}/leave-requests`).set(managerA);
    assert.equal(leaveOf(history, data.leaveA1.id).balance.remaining, 8);
    assert.equal(leaveOf(history, data.approvedA1.id).balance, null);

    const decided = await request(app).patch(`/api/manager/leave-requests/${data.leaveA1.id}`).set(managerA).send({ status: "APPROVED" });
    assert.equal(decided.status, 200);
    assert.equal(decided.body.leaveRequest.balance, null);
  });
});

describe("HR deciding leave", () => {
  test("sees the balance of everyone's pending requests, including people with no manager", async () => {
    const res = await request(app).get("/api/leave-requests?status=PENDING").set(hr);

    const solo = leaveOf(res, soloLeave.id);
    assert.deepEqual([solo.balance.type, solo.balance.year, solo.balance.remaining], ["Sick", 2027, 6]);
    assert.equal(solo.managerName, null);
    assert.ok(res.body.leaveRequests.every((r) => r.status !== "PENDING" || r.balance));
  });

  test("with no filter, only the pending ones carry a balance", async () => {
    const res = await request(app).get("/api/leave-requests").set(hr);

    for (const r of res.body.leaveRequests) {
      assert.equal(r.balance === null, r.status !== "PENDING");
    }
  });
});

describe("the employee's own list", () => {
  test("is unchanged: no balance on the requests (the balance has its own endpoint)", async () => {
    const amir = await login("employee.a1@example.com"); // the fixtures give A-1 this account

    const res = await request(app).get("/api/me/leave-requests").set(amir);
    assert.ok(res.body.leaveRequests.every((r) => r.balance === null));
    assert.equal((await request(app).get("/api/me/leave-balance?year=2026").set(amir)).status, 200);
  });
});
