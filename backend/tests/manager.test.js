const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");

let data;
let managerA;

before(async () => {
  data = await seedFixtures();
  managerA = await login("manager.a@example.com");
});
after(() => prisma.$disconnect());

describe("team", () => {
  test("a manager sees only their own team, whatever managerId is sent", async () => {
    const res = await request(app).get(`/api/manager/team?managerId=${data.managerB.id}`).set(managerA);

    assert.equal(res.status, 200);
    assert.equal(res.body.manager.id, data.managerA.id);
    assert.deepEqual(res.body.team.map((e) => e.employeeId).sort(), ["A-1", "A-2"]);
  });

  test("another team's member is not found", async () => {
    assert.equal((await request(app).get(`/api/manager/team/${data.a1.id}`).set(managerA)).status, 200);
    assert.equal((await request(app).get(`/api/manager/team/${data.b1.id}`).set(managerA)).status, 404);
    assert.equal((await request(app).get(`/api/manager/team/${data.b1.id}/leave-requests`).set(managerA)).status, 404);
  });

  test("a bad id is a 400", async () => {
    assert.equal((await request(app).get("/api/manager/team/abc").set(managerA)).status, 400);
  });
});

describe("leave requests", () => {
  test("lists only the team's requests, pending first", async () => {
    const res = await request(app).get("/api/manager/leave-requests").set(managerA);

    assert.equal(res.status, 200);
    assert.ok(res.body.leaveRequests.every((r) => ["A-1", "A-2"].includes(r.employeeId)));
    assert.equal(res.body.leaveRequests.length, 3);
    assert.equal(res.body.leaveRequests.at(-1).status, "APPROVED");
  });

  test("filters by status and rejects unknown ones", async () => {
    const pending = await request(app).get("/api/manager/leave-requests?status=PENDING").set(managerA);
    assert.equal(pending.status, 200);
    assert.ok(pending.body.leaveRequests.every((r) => r.status === "PENDING"));

    assert.equal((await request(app).get("/api/manager/leave-requests?status=WRONG").set(managerA)).status, 400);
  });

  test("can't decide another team's request", async () => {
    const res = await request(app)
      .patch(`/api/manager/leave-requests/${data.leaveB1.id}`)
      .set(managerA)
      .send({ status: "APPROVED" });

    assert.equal(res.status, 404);
    const stored = await prisma.leaveRequest.findUnique({ where: { id: data.leaveB1.id } });
    assert.equal(stored.status, "PENDING");
  });

  test("approves a pending request once", async () => {
    const url = `/api/manager/leave-requests/${data.leaveA1.id}`;
    const res = await request(app).patch(url).set(managerA).send({ status: "APPROVED", note: "  Enjoy  " });

    assert.equal(res.status, 200);
    assert.equal(res.body.leaveRequest.status, "APPROVED");
    assert.equal(res.body.leaveRequest.decisionNote, "Enjoy");
    assert.ok(res.body.leaveRequest.decidedAt);

    const stored = await prisma.leaveRequest.findUnique({ where: { id: data.leaveA1.id } });
    assert.equal(stored.decidedById, data.managerA.id);

    const again = await request(app).patch(url).set(managerA).send({ status: "REJECTED" });
    assert.equal(again.status, 409);
  });

  test("validates the decision", async () => {
    const url = `/api/manager/leave-requests/${data.leaveA2.id}`;

    assert.equal((await request(app).patch(url).set(managerA).send({ status: "MAYBE" })).status, 422);
    assert.equal((await request(app).patch(url).set(managerA).send({ status: "REJECTED", note: "x".repeat(501) })).status, 422);
    assert.equal((await request(app).patch("/api/manager/leave-requests/0").set(managerA).send({ status: "APPROVED" })).status, 400);
  });
});
