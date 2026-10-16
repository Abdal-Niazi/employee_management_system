const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { app, prisma, request, seedFixtures, login, account, PASSWORD } = require("./helpers");

// Each test uses its own account: failed attempts count per account (5 in tests, LOGIN_RATE_LIMIT).
let data;

before(async () => {
  data = await seedFixtures();
  await account("employee.b1@example.com", "EMPLOYEE", data.b1.id);
});
after(() => prisma.$disconnect());

const change = (headers, body) => request(app).post("/api/auth/change-password").set(headers).send(body);
const me = (headers) => request(app).get("/api/auth/me").set(headers);
const signIn = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe("changing your own password", () => {
  test("needs a login", async () => {
    assert.equal((await request(app).post("/api/auth/change-password").send({})).status, 401);
  });

  test("a wrong current password is refused, without signing you out", async () => {
    const auth = await login("employee.a1@example.com");
    const res = await change(auth, { currentPassword: "not-my-password", newPassword: "A-new-password-1" });

    // 400, not 401: the app signs out on a 401
    assert.equal(res.status, 400);
    assert.match(res.body.message, /current password/);
    assert.equal((await me(auth)).status, 200);
  });

  test("checks the new password", async () => {
    const auth = await login("employee.a1@example.com");
    const bodies = [
      { currentPassword: PASSWORD, newPassword: "short" },
      { currentPassword: PASSWORD, newPassword: PASSWORD },
      { currentPassword: PASSWORD, newPassword: "é".repeat(37) }, // 74 bytes
      { newPassword: "A-new-password-1" },
    ];

    for (const body of bodies) {
      assert.equal((await change(auth, body)).status, 422, JSON.stringify(body));
    }
  });

  test("after 5 failed attempts the account is blocked for a while, even with the right password", async () => {
    const auth = await login("employee.a1@example.com");
    const res = await change(auth, { currentPassword: PASSWORD, newPassword: "A-new-password-1" });

    assert.equal(res.status, 429);
    // Nothing changed
    assert.equal((await signIn("employee.a1@example.com", PASSWORD)).status, 200);
  });

  test("signs out every other login, keeps this one with a new token, and the new password works", async () => {
    const phone = await login("manager.a@example.com");
    const laptop = await login("manager.a@example.com");

    const res = await change(phone, { currentPassword: PASSWORD, newPassword: "Manager-new-pass-1" });
    assert.equal(res.status, 200);
    assert.equal(res.body.admin.email, "manager.a@example.com");
    assert.equal("passwordHash" in res.body.admin, false);

    // The old token of this phone and the laptop's are signed out; the new token works
    assert.equal((await me(phone)).status, 401);
    assert.equal((await me(laptop)).status, 401);
    assert.equal((await me(bearer(res.body.token))).status, 200);

    assert.equal((await signIn("manager.a@example.com", PASSWORD)).status, 401);
    assert.equal((await signIn("manager.a@example.com", "Manager-new-pass-1")).status, 200);
  });

  test("works for every role", async () => {
    for (const email of ["hr@example.com", "employee.b1@example.com"]) {
      const res = await change(await login(email), { currentPassword: PASSWORD, newPassword: "Another-pass-22" });
      assert.equal(res.status, 200, email);
      assert.equal((await signIn(email, "Another-pass-22")).status, 200, email);
    }
  });

  test("a login from before this update still works, until the password changes", async () => {
    const admin = await prisma.admin.findUnique({ where: { email: "manager.b@example.com" } });
    const oldStyle = bearer(jwt.sign({ sub: String(admin.id) }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" }));
    assert.equal((await me(oldStyle)).status, 200);

    const res = await change(await login("manager.b@example.com"), { currentPassword: PASSWORD, newPassword: "Bob-new-pass-1" });
    assert.equal(res.status, 200);
    assert.equal((await me(oldStyle)).status, 401);
  });

  test("two changes sent at once: only one goes through", async () => {
    const auth = await login("unlinked@example.com");
    const results = await Promise.all([
      change(auth, { currentPassword: PASSWORD, newPassword: "First-new-pass-1" }),
      change(auth, { currentPassword: PASSWORD, newPassword: "Second-new-pass-2" }),
    ]);

    const statuses = results.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 200).length, 1, JSON.stringify(statuses));
    assert.ok(statuses.every((s) => [200, 400, 409].includes(s)), JSON.stringify(statuses));

    // Exactly the winning password works
    const won = results[0].status === 200 ? "First-new-pass-1" : "Second-new-pass-2";
    const lost = won === "First-new-pass-1" ? "Second-new-pass-2" : "First-new-pass-1";
    assert.equal((await signIn("unlinked@example.com", won)).status, 200);
    assert.equal((await signIn("unlinked@example.com", lost)).status, 401);
  });
});
