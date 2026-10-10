const { test } = require("node:test");
const assert = require("node:assert/strict");
const { apiKey, loginKey } = require("../src/middleware/rateLimits");

// The parts of a request the limiters look at
const req = ({ ip = "203.0.113.7", token, email } = {}) => ({
  ip,
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body: email === undefined ? undefined : { email },
});

test("failed sign-ins are counted per address and email", () => {
  assert.equal(loginKey(req({ email: " A@Example.com " })), loginKey(req({ email: "a@example.com" })));
  assert.notEqual(loginKey(req({ email: "a@example.com" })), loginKey(req({ email: "b@example.com" })));
  assert.notEqual(loginKey(req({ email: "a@example.com" })), loginKey(req({ ip: "203.0.113.8", email: "a@example.com" })));
  // A body that isn't JSON still gets a key
  assert.equal(typeof loginKey(req()), "string");
});

test("signed-in requests are counted per person, everything else per address", () => {
  // Two people on the same office Wi-Fi get separate allowances
  assert.notEqual(apiKey(req({ token: "token-of-amir" })), apiKey(req({ token: "token-of-ayesha" })));
  // One person keeps one allowance when their address changes
  assert.equal(apiKey(req({ token: "t1" })), apiKey(req({ ip: "198.51.100.1", token: "t1" })));

  assert.equal(apiKey(req()), apiKey(req()));
  assert.notEqual(apiKey(req()), apiKey(req({ ip: "203.0.113.8" })));

  // Only a hash of the token is kept in memory
  assert.ok(!apiKey(req({ token: "secret-token" })).includes("secret-token"));
});
