const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");

let hr;
let manager;
let unlinked;

before(async () => {
  await seedFixtures();
  hr = await login("hr@example.com");
  manager = await login("manager.a@example.com");
  unlinked = await login("unlinked@example.com");
});
after(() => prisma.$disconnect());

test("every API route needs a token", async () => {
  assert.equal((await request(app).get("/api/employees")).status, 401);
  assert.equal((await request(app).get("/api/manager/team")).status, 401);
  assert.equal((await request(app).get("/api/me")).status, 401);
  assert.equal((await request(app).get("/api/attendance")).status, 401);
  assert.equal((await request(app).patch("/api/manager/leave-requests/1").send({ status: "APPROVED" })).status, 401);
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
});

test("a manager account without an employee is refused", async () => {
  const res = await request(app).get("/api/manager/team").set(unlinked);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /isn't linked to an employee/);
});

test("only EMPLOYEE and MANAGER accounts can use /api/me", async () => {
  assert.equal((await request(app).get("/api/me").set(hr)).status, 403);
  assert.equal((await request(app).get("/api/me/leave-requests").set(hr)).status, 403);
  assert.equal((await request(app).get("/api/me").set(manager)).status, 200);
});

test("employee accounts cannot use the HR or manager APIs", async () => {
  const employee = await prisma.employee.findFirst({ where: { employeeId: "A-1" } });
  await prisma.admin.create({
    data: { email: "plain@example.com", name: "plain", role: "EMPLOYEE", employeeId: employee.id, passwordHash: await require("../src/services/authService").hashPassword("Correct-horse-42") },
  });
  const plain = await login("plain@example.com");

  assert.equal((await request(app).get("/api/employees").set(plain)).status, 403);
  assert.equal((await request(app).get("/api/manager/team").set(plain)).status, 403);
  assert.equal((await request(app).get("/api/attendance").set(plain)).status, 403);
  assert.equal((await request(app).get("/api/me").set(plain)).status, 200);
});
