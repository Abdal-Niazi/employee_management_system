const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");

let data;
let hr;

before(async () => {
  data = await seedFixtures();
  hr = await login("hr@example.com");
});
after(() => prisma.$disconnect());

const newEmployee = (overrides = {}) => ({
  employeeId: "NEW-1",
  firstName: "Nadia",
  lastName: "Khan",
  email: "Nadia.Khan@Example.com",
  hireDate: "2025-03-01",
  ...overrides,
});

describe("create", () => {
  test("stores the email in lower case and blocks the same email in other casing", async () => {
    const res = await request(app).post("/api/employees").set(hr).send(newEmployee());
    assert.equal(res.status, 201);
    assert.equal(res.body.employee.email, "nadia.khan@example.com");

    const duplicate = await request(app)
      .post("/api/employees")
      .set(hr)
      .send(newEmployee({ employeeId: "NEW-2", email: "NADIA.KHAN@example.com" }));
    assert.equal(duplicate.status, 409);
  });

  test("enforces length limits and drops unknown fields", async () => {
    const tooLong = await request(app)
      .post("/api/employees")
      .set(hr)
      .send(newEmployee({ employeeId: "NEW-3", email: "n3@example.com", firstName: "x".repeat(101) }));
    assert.equal(tooLong.status, 422);

    const extra = await request(app)
      .post("/api/employees")
      .set(hr)
      .send(newEmployee({ employeeId: "NEW-4", email: "n4@example.com", id: 999, createdAt: "2000-01-01" }));
    assert.equal(extra.status, 201);
    assert.notEqual(extra.body.employee.id, 999);
  });
});

describe("list", () => {
  test("is paginated", async () => {
    const res = await request(app).get("/api/employees?page=2&pageSize=2").set(hr);

    assert.equal(res.status, 200);
    assert.equal(res.body.employees.length, 2);
    assert.equal(res.body.pagination.page, 2);
    assert.equal(res.body.pagination.pageSize, 2);
    assert.ok(res.body.pagination.total >= 5);
  });

  test("rejects bad paging values", async () => {
    assert.equal((await request(app).get("/api/employees?pageSize=101").set(hr)).status, 400);
    assert.equal((await request(app).get("/api/employees?page=0").set(hr)).status, 400);
  });
});

describe("update and delete", () => {
  test("an employee can't manage themselves or a missing employee", async () => {
    const self = await request(app).patch(`/api/employees/${data.a1.id}`).set(hr).send({ managerId: data.a1.id });
    assert.equal(self.status, 400);

    const missing = await request(app).patch(`/api/employees/${data.a1.id}`).set(hr).send({ managerId: 999999 });
    assert.equal(missing.status, 400);
  });

  test("a missing employee is a 404", async () => {
    const res = await request(app).delete("/api/employees/999999").set(hr);

    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Employee not found");
  });

  test("deleting an employee removes their leave and unlinks their manager account", async () => {
    assert.equal((await request(app).delete(`/api/employees/${data.a2.id}`).set(hr)).status, 200);
    assert.equal(await prisma.leaveRequest.count({ where: { employeeId: data.a2.id } }), 0);

    assert.equal((await request(app).delete(`/api/employees/${data.managerA.id}`).set(hr)).status, 200);
    const account = await prisma.admin.findUnique({ where: { email: "manager.a@example.com" } });
    assert.equal(account.employeeId, null);
  });
});
