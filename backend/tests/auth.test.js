const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, PASSWORD, seedFixtures, login } = require("./helpers");

before(seedFixtures);
after(() => prisma.$disconnect());

const signIn = (email, password) => request(app).post("/api/auth/login").send({ email, password });

describe("POST /api/auth/login", () => {
  test("returns a token and the account without its password hash", async () => {
    const res = await signIn("MANAGER.A@example.com", PASSWORD);

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.admin.email, "manager.a@example.com");
    assert.equal(res.body.admin.role, "MANAGER");
    assert.ok(res.body.admin.employeeId);
    assert.equal(res.body.admin.passwordHash, undefined);
  });

  test("gives the same answer for a wrong password and an unknown email", async () => {
    const wrongPassword = await signIn("hr@example.com", "wrong-password");
    const unknownEmail = await signIn("nobody@example.com", "wrong-password");

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });

  test("validates the body", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "x" });
    assert.equal(res.status, 422);

    const tooLong = await signIn("hr@example.com", "x".repeat(201));
    assert.equal(tooLong.status, 422);
  });
});

describe("GET /api/auth/me", () => {
  test("needs a valid token", async () => {
    assert.equal((await request(app).get("/api/auth/me")).status, 401);
    assert.equal((await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-token")).status, 401);
  });

  test("returns the signed-in account", async () => {
    const res = await request(app).get("/api/auth/me").set(await login("hr@example.com"));

    assert.equal(res.status, 200);
    assert.equal(res.body.admin.role, "HR_ADMIN");
  });

  test("rejects the token of a deleted account", async () => {
    const headers = await login("manager.b@example.com");
    await prisma.admin.delete({ where: { email: "manager.b@example.com" } });

    assert.equal((await request(app).get("/api/auth/me").set(headers)).status, 401);
  });
});

// Last, because it uses up this IP's failed-login allowance (5 in tests).
describe("login rate limit", () => {
  test("blocks an IP after too many failed attempts", async () => {
    let res;
    for (let attempt = 0; attempt < 6; attempt++) {
      res = await signIn("hr@example.com", `guess-${attempt}`);
    }

    assert.equal(res.status, 429);

    // Even the right password is refused until the window passes.
    assert.equal((await signIn("hr@example.com", PASSWORD)).status, 429);
  });
});
