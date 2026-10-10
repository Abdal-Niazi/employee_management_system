const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");

let hr;
let manager;
let employee;
let unlinked;

before(async () => {
  await seedFixtures();
  hr = await login("hr@example.com");
  manager = await login("manager.a@example.com");
  employee = await login("employee.a1@example.com");
  unlinked = await login("unlinked@example.com");
});
after(() => prisma.$disconnect());

test("every API route needs a token", async () => {
  assert.equal((await request(app).get("/api/employees")).status, 401);
  assert.equal((await request(app).get("/api/manager/team")).status, 401);
  assert.equal((await request(app).patch("/api/manager/leave-requests/1").send({ status: "APPROVED" })).status, 401);
  assert.equal((await request(app).get("/api/manager/attendance")).status, 401);
  assert.equal((await request(app).get("/api/attendance-corrections")).status, 401);
  assert.equal((await request(app).patch("/api/attendance-corrections/1").send({ status: "APPROVED" })).status, 401);
  assert.equal((await request(app).get("/api/me/attendance/today")).status, 401);
  assert.equal((await request(app).post("/api/me/attendance/check-in")).status, 401);
});

test("employees and managers use /api/me, HR admins don't", async () => {
  assert.equal((await request(app).get("/api/me/attendance/today").set(employee)).status, 200);
  assert.equal((await request(app).get("/api/me/attendance/today").set(manager)).status, 200);

  assert.equal((await request(app).get("/api/me/attendance/today").set(hr)).status, 403);
  assert.equal((await request(app).post("/api/me/attendance/check-in").set(hr)).status, 403);

  const res = await request(app).get("/api/me/attendance").set(unlinked);
  assert.equal(res.status, 403);
  assert.match(res.body.message, /isn't linked to an employee/);
});

test("an employee account can't use the manager or HR routes", async () => {
  assert.equal((await request(app).get("/api/manager/team").set(employee)).status, 403);
  assert.equal((await request(app).get("/api/manager/attendance").set(employee)).status, 403);
  assert.equal((await request(app).get("/api/employees").set(employee)).status, 403);
  assert.equal((await request(app).get("/api/attendance-corrections").set(employee)).status, 403);
});

test("only HR admins can use /api/employees", async () => {
  assert.equal((await request(app).get("/api/employees").set(hr)).status, 200);

  assert.equal((await request(app).get("/api/employees").set(manager)).status, 403);
  assert.equal((await request(app).get("/api/employees/1").set(manager)).status, 403);
  assert.equal((await request(app).delete("/api/employees/1").set(manager)).status, 403);
});

test("only MANAGER accounts can use /api/manager", async () => {
  assert.equal((await request(app).get("/api/manager/team").set(manager)).status, 200);
  assert.equal((await request(app).get("/api/manager/team").set(hr)).status, 403);
  assert.equal((await request(app).get("/api/manager/attendance").set(hr)).status, 403);
  assert.equal((await request(app).post("/api/manager/attendance-corrections").set(hr).send({})).status, 403);
});

test("only HR admins can decide attendance corrections", async () => {
  assert.equal((await request(app).get("/api/attendance-corrections").set(hr)).status, 200);

  assert.equal((await request(app).get("/api/attendance-corrections").set(manager)).status, 403);
  const decide = await request(app).patch("/api/attendance-corrections/1").set(manager).send({ status: "APPROVED" });
  assert.equal(decide.status, 403);
});

test("a manager account without an employee is refused", async () => {
  const res = await request(app).get("/api/manager/team").set(unlinked);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /isn't linked to an employee/);
});
