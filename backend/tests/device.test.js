const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");
const { isWeekend, todayKey } = require("../src/utils/companyTime");

// Whether today allows a check-in at all, so the suite passes on any day.
const workday = !isWeekend(todayKey());

after(() => prisma.$disconnect());

describe("registered phones", () => {
  let data;
  let employee;
  let manager;
  let hr;
  let key;

  before(async () => {
    data = await seedFixtures();
    employee = await login("employee.a1@example.com");
    manager = await login("manager.a@example.com");
    hr = await login("hr@example.com");
  });

  const register = (headers, body = { platform: "android" }) =>
    request(app).post("/api/me/device").set(headers).send(body);

  const checkIn = (headers, deviceKey) => {
    const req = request(app).post("/api/me/attendance/check-in").set(headers);
    return deviceKey === undefined ? req : req.set("X-Device-Key", deviceKey);
  };

  test("nothing is registered at first, and check-in needs a registered phone", async () => {
    const today = await request(app).get("/api/me/attendance/today").set(employee);
    assert.equal(today.body.deviceRegistered, false);

    const res = await checkIn(employee, "anything");
    assert.equal(res.status, 403);
    assert.match(res.body.message, /Register this phone/);
  });

  test("a phone registers once and gets its key once; only a hash is stored", async () => {
    const res = await register(employee);
    assert.equal(res.status, 201);
    key = res.body.key;
    assert.equal(typeof key, "string");
    assert.ok(key.length >= 40);
    assert.equal(res.body.device.platform, "android");

    const stored = await prisma.registeredDevice.findUnique({ where: { employeeId: data.a1.id } });
    assert.ok(!stored.keyHash.includes(key));

    const again = await register(employee);
    assert.equal(again.status, 409);
    assert.match(again.body.message, /ask HR to reset/);
    assert.equal((await request(app).get("/api/me/attendance/today").set(employee)).body.deviceRegistered, true);
  });

  test("validates the platform", async () => {
    assert.equal((await register(manager, { platform: "toaster" })).status, 422);
  });

  test("check-in and check-out only with the registered phone's key", async () => {
    assert.equal((await checkIn(employee)).status, 403);
    assert.equal((await checkIn(employee, "wrong-key")).status, 403);
    assert.equal((await checkIn(employee, "x".repeat(5000))).status, 403);
    const wrongOut = await request(app).post("/api/me/attendance/check-out").set(employee).set("X-Device-Key", "wrong");
    assert.equal(wrongOut.status, 403);

    // The phone is accepted; what happens next depends on the day.
    const res = await checkIn(employee, key);
    assert.equal(res.status, workday ? 200 : 400);

    const device = await prisma.registeredDevice.findUnique({ where: { employeeId: data.a1.id } });
    assert.ok(device.lastUsedAt);
  });

  test("app builds from before registered phones keep their paths and are told to update", async () => {
    for (const path of ["/api/me/check-in", "/api/me/check-out"]) {
      const res = await request(app).post(path).set(employee);
      assert.equal(res.status, 403);
      assert.match(res.body.message, /Update the app/);
    }

    // The old path works like the new one with the phone's key
    const res = await request(app).post("/api/me/check-in").set(employee).set("X-Device-Key", key);
    assert.notEqual(res.status, 403);

    // The old name for the days is still in the answer
    const history = await request(app).get("/api/me/attendance?days=3").set(employee);
    assert.deepEqual(history.body.attendance, history.body.records);
  });

  test("another person's key doesn't work for you", async () => {
    const managerKey = (await register(manager)).body.key;
    assert.equal((await checkIn(employee, managerKey)).status, 403);
  });

  test("only HR can see or reset a registered phone", async () => {
    const url = `/api/employees/${data.a1.id}/device`;
    assert.equal((await request(app).delete(url).set(employee)).status, 403);
    assert.equal((await request(app).delete(url).set(manager)).status, 403);
    assert.equal((await request(app).get(url).set(manager)).status, 403);

    const seen = await request(app).get(url).set(hr);
    assert.equal(seen.status, 200);
    assert.equal(seen.body.registered, true);
    assert.equal(seen.body.device.platform, "android");
    assert.equal("keyHash" in seen.body.device, false);

    assert.equal((await request(app).delete(url).set(hr)).status, 200);
    assert.equal((await request(app).delete(url).set(hr)).status, 404);
    assert.equal((await request(app).delete("/api/employees/99999/device").set(hr)).status, 404);
    assert.equal((await request(app).get(url).set(hr)).body.registered, false);
  });

  test("after a reset the old key stops working, and the new phone can register", async () => {
    const old = await checkIn(employee, key);
    assert.equal(old.status, 403);
    assert.match(old.body.message, /Register this phone/);

    const fresh = await register(employee, { platform: "ios" });
    assert.equal(fresh.status, 201);
    assert.notEqual(fresh.body.key, key);
    assert.notEqual((await checkIn(employee, fresh.body.key)).status, 403);
  });
});
