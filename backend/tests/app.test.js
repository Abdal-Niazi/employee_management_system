const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request } = require("./helpers");

after(() => prisma.$disconnect());

test("/health reports ok without details", async () => {
  const res = await request(app).get("/health");

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ok" });
});

test("sends security headers and hides the framework", async () => {
  const res = await request(app).get("/");

  assert.ok(res.headers["content-security-policy"]);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-powered-by"], undefined);
});

test("only allows browser calls from allowed origins", async () => {
  const evil = await request(app).get("/").set("Origin", "https://evil.example");
  assert.equal(evil.headers["access-control-allow-origin"], undefined);

  const local = await request(app).get("/").set("Origin", "http://localhost:8081");
  assert.equal(local.headers["access-control-allow-origin"], "http://localhost:8081");
});

test("rejects bad bodies with 4xx, not 500", async () => {
  const malformed = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send('{"email": ');
  assert.equal(malformed.status, 400);

  const huge = await request(app)
    .post("/api/auth/login")
    .send({ email: "a@example.com", password: "x".repeat(200 * 1024) });
  assert.equal(huge.status, 413);
});

test("unknown routes are a 404", async () => {
  assert.equal((await request(app).get("/api/nope")).status, 404);
});
