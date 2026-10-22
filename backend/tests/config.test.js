const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { checkConfig } = require("../src/utils/config");

const GOOD = { DATABASE_URL: "postgresql://user:pw@db.example.com:5432/ems", JWT_SECRET: "x".repeat(40) };

describe("the settings check", () => {
  test("good settings give no errors and no warnings", () => {
    assert.deepEqual(checkConfig(GOOD), { errors: [], warnings: [] });
    assert.deepEqual(checkConfig({ ...GOOD, NODE_ENV: "production", TRUST_PROXY: "1" }), { errors: [], warnings: [] });
  });

  test("a missing database address or secret, or a short secret, stops the server", () => {
    assert.deepEqual(checkConfig({ JWT_SECRET: GOOD.JWT_SECRET }).errors, ["DATABASE_URL is not set."]);
    assert.deepEqual(checkConfig({ DATABASE_URL: GOOD.DATABASE_URL }).errors, ["JWT_SECRET is not set."]);
    assert.match(checkConfig({ ...GOOD, JWT_SECRET: "short" }).errors[0], /at least 32 characters/);
    assert.equal(checkConfig({}).errors.length, 2);
  });

  test("in production, a missing TRUST_PROXY is warned about, and only there", () => {
    const production = checkConfig({ ...GOOD, NODE_ENV: "production" });

    assert.deepEqual(production.errors, []);
    assert.equal(production.warnings.length, 1);
    assert.match(production.warnings[0], /TRUST_PROXY is not set/);
    assert.deepEqual(checkConfig({ ...GOOD, NODE_ENV: "development" }).warnings, []);
  });

  test("in production, a database on this machine is warned about", () => {
    const local = { ...GOOD, NODE_ENV: "production", TRUST_PROXY: "1", DATABASE_URL: "postgresql://u:p@localhost:5432/ems" };

    assert.match(checkConfig(local).warnings[0], /points at this machine/);
  });
});
