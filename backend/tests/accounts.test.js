const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, account, PASSWORD } = require("./helpers");
const { generateTemporaryPassword } = require("../src/utils/temporaryPassword");

let data;
let hr;
let manager;
let employee;

const url = (id) => `/api/employees/${id}/account`;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const signIn = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const create = (id, body, headers = hr) => request(app).post(url(id)).set(headers).send(body);
const reset = (id, headers = hr) => request(app).post(`${url(id)}/reset-password`).set(headers);
const update = (id, body, headers = hr) => request(app).patch(url(id)).set(headers).send(body);
const me = (headers) => request(app).get("/api/auth/me").set(headers);
const TEMPORARY = /^[A-HJKMNP-Za-hjkmnp-z2-9]{4}(-[A-HJKMNP-Za-hjkmnp-z2-9]{4}){2}$/;

// A new employee, without a login unless `withAccount` says so (it signs in with the test password).
let counter = 0;
const person = async ({ withAccount = false, status = "active", hireDate = "2024-01-15" } = {}) => {
  counter += 1;
  const code = `ACC-${counter}`;
  const created = await prisma.employee.create({
    data: { employeeId: code, firstName: `Person${counter}`, lastName: "Test", email: `${code.toLowerCase()}@example.com`, hireDate: new Date(hireDate), status },
  });
  if (withAccount) await account(created.email, "EMPLOYEE", created.id);

  return created;
};

before(async () => {
  data = await seedFixtures();
  hr = await login("hr@example.com");
  manager = await login("manager.a@example.com");
  employee = await login("employee.a1@example.com");
});
after(() => prisma.$disconnect());

describe("temporary passwords", () => {
  test("look like Kx7m-Qp3n-Rw9t, without letters that can be mistaken for each other", () => {
    for (let i = 0; i < 200; i += 1) assert.match(generateTemporaryPassword(), TEMPORARY);
  });

  test("are different every time", () => {
    const seen = new Set(Array.from({ length: 500 }, generateTemporaryPassword));
    assert.equal(seen.size, 500);
  });
});

describe("who may look after logins", () => {
  test("needs a login, and only an HR admin gets in", async () => {
    const id = data.a2.id;

    assert.equal((await request(app).get(url(id))).status, 401);
    for (const headers of [manager, employee]) {
      assert.equal((await request(app).get(url(id)).set(headers)).status, 403);
      assert.equal((await create(id, { role: "EMPLOYEE" }, headers)).status, 403);
      assert.equal((await update(id, { disabled: true }, headers)).status, 403);
      assert.equal((await reset(id, headers)).status, 403);
    }
  });

  test("an employee that doesn't exist is a 404, a bad id a 400", async () => {
    assert.equal((await request(app).get(url(99999)).set(hr)).status, 404);
    assert.equal((await create(99999, { role: "EMPLOYEE" })).status, 404);
    assert.equal((await request(app).get(url("abc")).set(hr)).status, 400);
  });
});

describe("creating a login", () => {
  test("gives a temporary password once, and only its hash is kept", async () => {
    const res = await create(data.a2.id, { role: "EMPLOYEE" });

    assert.equal(res.status, 201);
    assert.match(res.body.temporaryPassword, TEMPORARY);
    // The employee's own email is used when none is sent
    assert.deepEqual(
      { email: res.body.account.email, role: res.body.account.role, status: res.body.account.status, mustChangePassword: res.body.account.mustChangePassword },
      { email: "a-2@example.com", role: "EMPLOYEE", status: "ACTIVE", mustChangePassword: true }
    );
    assert.ok(!JSON.stringify(res.body).includes("passwordHash"));

    const stored = await prisma.admin.findUnique({ where: { email: "a-2@example.com" } });
    assert.equal(stored.employeeId, data.a2.id);
    assert.notEqual(stored.passwordHash, res.body.temporaryPassword);

    // Looking it up later shows the login, never the password
    const again = await request(app).get(url(data.a2.id)).set(hr);
    assert.equal(again.body.account.email, "a-2@example.com");
    assert.equal("temporaryPassword" in again.body, false);
  });

  test("the person signs in with it, can only choose a new password, and then everything opens", async () => {
    const temporary = (await reset(data.a2.id)).body.temporaryPassword;
    const res = await signIn("a-2@example.com", temporary);

    assert.equal(res.status, 200);
    assert.equal(res.body.admin.mustChangePassword, true);
    const first = bearer(res.body.token);

    assert.equal((await me(first)).status, 200);
    const blocked = await request(app).get("/api/me/leave-balance").set(first);
    assert.equal(blocked.status, 403);
    assert.match(blocked.body.message, /Choose your own password first/);

    const changed = await request(app).post("/api/auth/change-password").set(first).send({ currentPassword: temporary, newPassword: "My-own-password-7" });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.admin.mustChangePassword, false);

    assert.equal((await request(app).get("/api/me/leave-balance").set(bearer(changed.body.token))).status, 200);
    assert.equal((await signIn("a-2@example.com", temporary)).status, 401);
    assert.equal((await signIn("a-2@example.com", "My-own-password-7")).status, 200);
  });

  test("a person with a login already, or an email in use, is refused", async () => {
    const taken = await create(data.a2.id, { role: "EMPLOYEE" });
    assert.equal(taken.status, 409);
    assert.match(taken.body.message, /already has a login/);

    const sameEmail = await create(data.b1.id, { role: "EMPLOYEE", email: "employee.a1@example.com" });
    assert.equal(sameEmail.status, 409);
    assert.match(sameEmail.body.message, /already used by another login/);
  });

  test("an email is trimmed and lower-cased, and a manager login is possible", async () => {
    const res = await create(data.b1.id, { role: "MANAGER", email: "  Bilal.New@Example.com " });

    assert.equal(res.status, 201);
    assert.equal(res.body.account.email, "bilal.new@example.com");
    assert.equal(res.body.account.role, "MANAGER");
    const session = await signIn("bilal.new@example.com", res.body.temporaryPassword);
    assert.equal(session.body.admin.role, "MANAGER");
    assert.equal(session.body.admin.employeeId, data.b1.id);
  });

  test("refuses a wrong role, a bad email, and an employee who left", async () => {
    const someone = await person();
    for (const body of [{ role: "HR_ADMIN" }, {}, { role: "EMPLOYEE", email: "not-an-email" }]) {
      assert.equal((await create(someone.id, body)).status, 422, JSON.stringify(body));
    }

    const gone = await person({ status: "terminated" });
    const res = await create(gone.id, { role: "EMPLOYEE" });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /isn't active/);
  });

  test("an employee without a login shows none", async () => {
    const someone = await person();
    const res = await request(app).get(url(someone.id)).set(hr);

    assert.equal(res.status, 200);
    assert.equal(res.body.account, null);
  });
});

describe("a forgotten password", () => {
  test("a new temporary one signs out everything the person had, and has to be replaced again", async () => {
    const someone = await person({ withAccount: true });
    const email = someone.email;
    const before = bearer((await signIn(email, PASSWORD)).body.token);

    const res = await reset(someone.id);
    assert.equal(res.status, 200);
    assert.match(res.body.temporaryPassword, TEMPORARY);
    assert.equal(res.body.account.mustChangePassword, true);

    assert.equal((await me(before)).status, 401);
    assert.equal((await signIn(email, PASSWORD)).status, 401);
    const session = await signIn(email, res.body.temporaryPassword);
    assert.equal(session.status, 200);
    assert.equal(session.body.admin.mustChangePassword, true);

    // Another reset gives another password, and the earlier one stops working
    const second = await reset(someone.id);
    assert.notEqual(second.body.temporaryPassword, res.body.temporaryPassword);
    assert.equal((await signIn(email, res.body.temporaryPassword)).status, 401);
  });

  test("an employee without a login has nothing to reset", async () => {
    const someone = await person();
    const res = await reset(someone.id);

    assert.equal(res.status, 404);
    assert.match(res.body.message, /no login/);
  });
});

describe("turning a login off", () => {
  test("it can't sign in or use a token from before, and turning it on again doesn't bring those back", async () => {
    const someone = await person({ withAccount: true });
    const email = someone.email;
    const token = bearer((await signIn(email, PASSWORD)).body.token);

    const off = await update(someone.id, { disabled: true });
    assert.equal(off.status, 200);
    assert.equal(off.body.account.status, "DISABLED");

    // Told so only with the right password; a wrong one is still the same 401 as always
    const turnedOff = await signIn(email, PASSWORD);
    assert.equal(turnedOff.status, 403);
    assert.match(turnedOff.body.message, /turned off/);
    assert.equal((await signIn(email, "Wrong-password-1")).status, 401);
    assert.equal((await me(token)).status, 401);

    const on = await update(someone.id, { disabled: false });
    assert.equal(on.body.account.status, "ACTIVE");
    assert.equal((await signIn(email, PASSWORD)).status, 200);
    assert.equal((await me(token)).status, 401);
  });

  test("needs something to change, and an employee with a login", async () => {
    const someone = await person({ withAccount: true });
    for (const body of [{}, { disabled: "yes" }, { role: "HR_ADMIN" }]) {
      assert.equal((await update(someone.id, body)).status, 422, JSON.stringify(body));
    }

    const without = await person();
    assert.equal((await update(without.id, { disabled: true })).status, 404);
  });
});

describe("employee or manager", () => {
  test("switching the role signs out the old logins and changes what the person may open", async () => {
    const someone = await person({ withAccount: true });
    const asEmployee = bearer((await signIn(someone.email, PASSWORD)).body.token);
    assert.equal((await request(app).get("/api/manager/team").set(asEmployee)).status, 403);

    const res = await update(someone.id, { role: "MANAGER" });
    assert.equal(res.status, 200);
    assert.equal(res.body.account.role, "MANAGER");
    assert.equal((await me(asEmployee)).status, 401);

    const session = await signIn(someone.email, PASSWORD);
    assert.equal(session.body.admin.role, "MANAGER");
    assert.equal((await request(app).get("/api/manager/team").set(bearer(session.body.token))).status, 200);

    // And back: the same role again changes nothing and signs nobody out
    const same = await update(someone.id, { role: "MANAGER" });
    assert.equal(same.status, 200);
    assert.equal((await me(bearer(session.body.token))).status, 200);
  });
});
