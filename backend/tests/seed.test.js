const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawnSync } = require("child_process");

const seed = (env) =>
  spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "seed.js")], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

test("the seed script refuses a database on another machine, whatever NODE_ENV is", () => {
  // Nothing is reachable there either: had the script gone past its check, it would fail differently.
  const result = seed({ NODE_ENV: "development", DATABASE_URL: "postgresql://nobody:none@db.example.invalid:5432/none" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /db\.example\.invalid, not at this machine/);
});

test("the seed script refuses to run in production", () => {
  // Nothing listens at this address: had the script gone past its check, it would fail differently.
  const result = seed({ NODE_ENV: "production", DATABASE_URL: "postgresql://nobody:none@127.0.0.1:1/none" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to seed/);
});
