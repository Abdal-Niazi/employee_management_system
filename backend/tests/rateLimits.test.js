const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { ipKey, loginKey, userKey } = require("../src/middleware/rateLimits");
const { app, prisma, request, seedFixtures, PASSWORD } = require("./helpers");

// The parts of a request the limiters look at
const req = ({ ip = "203.0.113.7", token, email, adminId } = {}) => ({
  ip,
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body: email === undefined ? undefined : { email },
  admin: adminId === undefined ? undefined : { id: adminId },
});

describe("the keys", () => {
  test("failed sign-ins are counted per address and email", () => {
    assert.equal(loginKey(req({ email: " A@Example.com " })), loginKey(req({ email: "a@example.com" })));
    assert.notEqual(loginKey(req({ email: "a@example.com" })), loginKey(req({ email: "b@example.com" })));
    assert.notEqual(loginKey(req({ email: "a@example.com" })), loginKey(req({ ip: "203.0.113.8", email: "a@example.com" })));
    // A body that isn't JSON still gets a key
    assert.equal(typeof loginKey(req()), "string");
  });

  test("the per-address count ignores the token, so a made-up token gets no fresh allowance", () => {
    assert.equal(ipKey(req({ token: "random-1" })), ipKey(req({ token: "random-2" })));
    assert.equal(ipKey(req({ token: "random-1" })), ipKey(req()));
    assert.notEqual(ipKey(req()), ipKey(req({ ip: "203.0.113.8" })));
  });

  test("signed-in requests are counted per verified account", () => {
    // Two people on the same office Wi-Fi get separate allowances
    assert.notEqual(userKey(req({ adminId: 1 })), userKey(req({ adminId: 2 })));
    // One person keeps one allowance when their address changes or they sign in again
    assert.equal(userKey(req({ adminId: 1, token: "t1" })), userKey(req({ adminId: 1, ip: "198.51.100.1", token: "t2" })));
  });
});

// The test run allows 20 failed sign-ins per address (LOGIN_IP_RATE_LIMIT) and 5 per address and
// email (LOGIN_RATE_LIMIT). This file runs in its own process, so it starts with a fresh count.
describe("one address trying many accounts", () => {
  before(seedFixtures);
  after(() => prisma.$disconnect());

  const signIn = (email, password) => request(app).post("/api/auth/login").send({ email, password });

  test("is cut off after 20 failures, even though each email failed only once", async () => {
    for (let n = 0; n < 20; n++) {
      assert.equal((await signIn(`nobody-${n}@example.com`, "wrong-password")).status, 401);
    }

    assert.equal((await signIn("someone-new@example.com", "wrong-password")).status, 429);
    // A right password is still refused from that address until the window passes
    assert.equal((await signIn("hr@example.com", PASSWORD)).status, 429);
  });
});
