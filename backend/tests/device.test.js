const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, newDeviceKey } = require("./helpers");

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

  const register = (headers, body = {}) =>
    request(app).post("/api/me/device").set(headers).send({ platform: "android", key: newDeviceKey(), ...body });

  const withKey = (req, deviceKey) => (deviceKey === undefined ? req : req.set("X-Device-Key", deviceKey));
  const checkIn = (headers, deviceKey) => withKey(request(app).post("/api/me/attendance/check-in").set(headers), deviceKey);
  const today = (headers, deviceKey) => withKey(request(app).get("/api/me/attendance/today").set(headers), deviceKey);

  const deviceUrl = (employeeId) => `/api/employees/${employeeId}/device`;
  // HR always says which waiting phone it looked at (by when it was registered)
  const approve = (employeeId, registeredAt = "2026-01-01T00:00:00.000Z") =>
    request(app).post(`${deviceUrl(employeeId)}/approve`).set(hr).send({ registeredAt });
  const lastUsed = async () => (await prisma.registeredDevice.findUnique({ where: { employeeId: data.a1.id } })).lastUsedAt;

  test("nothing is registered at first, and check-in needs a registered phone", async () => {
    const res = await today(employee);
    assert.equal(res.body.deviceRegistered, false);
    assert.equal(res.body.device, null);

    const attempt = await checkIn(employee, "anything");
    assert.equal(attempt.status, 403);
    assert.match(attempt.body.message, /Register this phone/);
  });

  test("the phone sends its own key; it waits for HR and only a hash is stored", async () => {
    key = newDeviceKey();
    const res = await register(employee, { key });
    assert.equal(res.status, 201);
    assert.equal("key" in res.body, false);
    assert.equal(res.body.device.status, "PENDING");
    assert.equal(res.body.device.platform, "android");

    const stored = await prisma.registeredDevice.findUnique({ where: { employeeId: data.a1.id } });
    assert.ok(!stored.keyHash.includes(key));

    const mine = await today(employee, key);
    assert.deepEqual(mine.body.device, { status: "PENDING", platform: "android", thisPhone: true });
    assert.equal((await today(employee, newDeviceKey())).body.device.thisPhone, false);
    assert.equal((await today(employee)).body.device.thisPhone, false);
  });

  test("the key is checked", async () => {
    assert.equal((await register(manager, { platform: "toaster" })).status, 422);
    assert.equal((await register(manager, { key: "short" })).status, 422);
    assert.equal((await register(manager, { key: "x".repeat(101) })).status, 422);
    assert.equal((await request(app).post("/api/me/device").set(manager).send({ platform: "android" })).status, 422);
  });

  test("a waiting phone can't check in, not even with its key", async () => {
    const res = await checkIn(employee, key);
    assert.equal(res.status, 403);
    assert.match(res.body.message, /waiting for HR/);
  });

  test("registering again while waiting replaces the waiting phone (a lost answer, a retry)", async () => {
    const first = await prisma.registeredDevice.findUnique({ where: { employeeId: data.a1.id } });
    const retryKey = newDeviceKey();
    assert.equal((await register(employee, { key: retryKey, platform: "ios" })).status, 201);

    const now = await prisma.registeredDevice.findUnique({ where: { employeeId: data.a1.id } });
    assert.equal(now.id, first.id);
    assert.equal(now.platform, "ios");
    assert.equal((await today(employee, key)).body.device.thisPhone, false);

    // Back to the first key for the rest of the tests
    assert.equal((await register(employee, { key })).status, 201);
  });

  test("HR sees the waiting phone, and only HR can approve it", async () => {
    const seen = await request(app).get(deviceUrl(data.a1.id)).set(hr);
    assert.equal(seen.status, 200);
    assert.equal(seen.body.device.status, "PENDING");
    assert.equal("keyHash" in seen.body.device, false);

    const list = await request(app).get("/api/employees?pageSize=100").set(hr);
    const phoneStatus = (id) => list.body.employees.find((e) => e.id === id).phoneStatus;
    assert.equal(phoneStatus(data.a1.id), "PENDING");
    assert.equal(phoneStatus(data.a2.id), null);
    assert.equal(list.body.employees.some((e) => "device" in e), false);

    assert.equal((await request(app).post(`${deviceUrl(data.a1.id)}/approve`).set(employee)).status, 403);
    assert.equal((await request(app).post(`${deviceUrl(data.a1.id)}/approve`).set(manager)).status, 403);
  });

  test("approving needs the phone HR looked at, and refuses one that replaced it", async () => {
    const missing = await request(app).post(`${deviceUrl(data.a1.id)}/approve`).set(hr).send({});
    assert.equal(missing.status, 422);

    const res = await approve(data.a1.id, "2020-01-01T00:00:00.000Z");
    assert.equal(res.status, 409);
    assert.match(res.body.message, /changed/);
  });

  test("once approved, check-in and check-out work only with that phone's key", async () => {
    const seen = await request(app).get(deviceUrl(data.a1.id)).set(hr);
    const res = await approve(data.a1.id, seen.body.device.registeredAt);
    assert.equal(res.status, 200);
    assert.equal(res.body.device.status, "APPROVED");
    assert.equal(res.body.device.approvedBy, "hr");
    assert.ok(res.body.device.approvedAt);

    assert.equal((await approve(data.a1.id, seen.body.device.registeredAt)).status, 409);
    assert.equal((await approve(data.a2.id)).status, 404);
    assert.equal((await approve(99999)).status, 404);

    assert.equal((await checkIn(employee, "wrong-key")).status, 403);
    assert.equal((await checkIn(employee, "x".repeat(5000))).status, 403);
    const wrongOut = await request(app).post("/api/me/attendance/check-out").set(employee).set("X-Device-Key", "wrong");
    assert.equal(wrongOut.status, 403);

    // Refused attempts don't count as using the phone
    assert.equal(await lastUsed(), null);
  });

  test("the phone's last use is a check-in or out that went through, not a refused one", async () => {
    assert.equal((await checkIn(employee, key)).status, 200);
    const used = await lastUsed();
    assert.ok(used);

    // Already checked in today: refused, and the last use stays as it was
    assert.equal((await checkIn(employee, key)).status, 409);
    assert.deepEqual(await lastUsed(), used);
  });

  test("an approved phone can't be replaced by registering again", async () => {
    const again = await register(employee);
    assert.equal(again.status, 409);
    assert.match(again.body.message, /ask HR to reset/);
    assert.equal((await today(employee, key)).body.device.thisPhone, true);
  });

  test("another person's key doesn't work for you", async () => {
    const managerKey = newDeviceKey();
    await register(manager, { key: managerKey });
    await prisma.registeredDevice.update({ where: { employeeId: data.managerA.id }, data: { status: "APPROVED" } });
    assert.equal((await checkIn(employee, managerKey)).status, 403);
  });

  test("only HR can see or reset a registered phone", async () => {
    const url = deviceUrl(data.a1.id);
    assert.equal((await request(app).delete(url).set(employee)).status, 403);
    assert.equal((await request(app).delete(url).set(manager)).status, 403);
    assert.equal((await request(app).get(url).set(manager)).status, 403);

    assert.equal((await request(app).delete(url).set(hr)).status, 200);
    assert.equal((await request(app).delete(url).set(hr)).status, 404);
    assert.equal((await request(app).delete(deviceUrl(99999)).set(hr)).status, 404);
    assert.equal((await request(app).get(url).set(hr)).body.registered, false);
  });

  test("after a reset the old key stops working, and the new phone registers and waits", async () => {
    const old = await checkIn(employee, key);
    assert.equal(old.status, 403);
    assert.match(old.body.message, /Register this phone/);

    const freshKey = newDeviceKey();
    assert.equal((await register(employee, { key: freshKey, platform: "ios" })).status, 201);
    assert.match((await checkIn(employee, freshKey)).body.message, /waiting for HR/);
  });

  test("rejecting a waiting phone is a reset", async () => {
    assert.equal((await request(app).delete(deviceUrl(data.a1.id)).set(hr)).status, 200);
    assert.equal((await today(employee)).body.device, null);
  });

  test("a reset can name the phone HR looked at, and then leaves one that replaced it", async () => {
    assert.equal((await register(employee)).status, 201);
    const { registeredAt } = (await request(app).get(deviceUrl(data.a1.id)).set(hr)).body.device;

    const stale = await request(app).delete(`${deviceUrl(data.a1.id)}?registeredAt=2020-01-01T00:00:00.000Z`).set(hr);
    assert.equal(stale.status, 409);
    assert.match(stale.body.message, /changed/);
    assert.ok((await today(employee)).body.device);

    assert.equal((await request(app).delete(`${deviceUrl(data.a1.id)}?registeredAt=yesterday`).set(hr)).status, 422);

    const res = await request(app).delete(`${deviceUrl(data.a1.id)}?registeredAt=${encodeURIComponent(registeredAt)}`).set(hr);
    assert.equal(res.status, 200);
    assert.equal((await today(employee)).body.device, null);
  });
});
