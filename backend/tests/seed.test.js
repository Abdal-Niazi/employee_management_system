const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawnSync } = require("child_process");

test("the seed script refuses to run in production", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "seed.js")], {
    cwd: path.join(__dirname, ".."),
    // Nothing listens at this address: had the script gone past its check, it would fail differently.
    env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "postgresql://nobody:none@127.0.0.1:1/none" },
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to seed/);
});
