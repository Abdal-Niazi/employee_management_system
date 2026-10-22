const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { app, prisma, resetDatabase } = require("./helpers");
const { runChecks } = require("../scripts/checkDeployment");

let server;
let base;

before(async () => {
  await resetDatabase();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

describe("the post-deploy check", () => {
  test("a healthy API passes every check (HTTPS is skipped for a local address)", async () => {
    const results = await runChecks(base);

    assert.ok(results.length >= 8);
    assert.deepEqual(
      results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail}`),
      []
    );
    assert.equal(results.find((r) => /HTTPS/.test(r.name)).skipped, true);
  });

  test("an address with nothing behind it fails the checks without throwing", async () => {
    const results = await runChecks("http://127.0.0.1:9");

    assert.ok(results.length >= 8);
    assert.ok(results.every((r) => r.ok === false || r.skipped));
    assert.ok(results.some((r) => /Couldn't connect/.test(r.detail)));
  });

  test("plain http on a real address is flagged", async () => {
    const results = await runChecks("http://api.invalid");

    assert.match(results.find((r) => /HTTPS/.test(r.name)).detail, /plain http/);
  });

  test("the script exits with 1 and says how to use it when no address is given", () => {
    const run = spawnSync(process.execPath, ["scripts/checkDeployment.js"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    });

    assert.equal(run.status, 1);
    assert.match(run.stderr, /Usage: npm run check-deploy/);
  });
});
