const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, account } = require("./helpers");
const attendanceService = require("../src/services/attendanceService");

let data;
let amir; // an EMPLOYEE account for A-1
let alice; // a MANAGER account, who is an employee too
let hr;

// 14 October 2026 is a Wednesday. The month index is 0-based.
const at = (hours, minutes) => new Date(2026, 9, 14, hours, minutes);
const todayRow = (employee, dateKey = "2026-10-14") =>
  prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: employee.id, date: new Date(`${dateKey}T00:00:00Z`) } } });

before(async () => {
  data = await seedFixtures();
  await account("amir@example.com", "EMPLOYEE", data.a1.id);
  amir = await login("amir@example.com");
  alice = await login("manager.a@example.com");
  hr = await login("hr@example.com");
});
beforeEach(() => prisma.attendance.deleteMany());
after(() => prisma.$disconnect());

describe("checking in and out (the rules)", () => {
  test("a check-in is saved with the server's time, and is late after the grace period", async () => {
    const onTime = await attendanceService.checkInSelf(data.a1, at(8, 52));
    assert.equal(onTime.status, "PRESENT");
    assert.equal(onTime.checkIn, "08:52");
    assert.equal(onTime.checkOut, null);
    assert.equal((await todayRow(data.a1)).checkIn, "08:52");

    const late = await attendanceService.checkInSelf(data.a2, at(9, 20));
    assert.equal(late.status, "LATE");
  });

  test("you can only check in once a day", async () => {
    await attendanceService.checkInSelf(data.a1, at(8, 52));

    await assert.rejects(attendanceService.checkInSelf(data.a1, at(8, 59)), { statusCode: 409 });
    assert.equal((await todayRow(data.a1)).checkIn, "08:52");
  });

  test("a check-out needs a check-in, and happens once", async () => {
    await assert.rejects(attendanceService.checkOutSelf(data.a1, at(17, 0)), { statusCode: 409 });

    await attendanceService.checkInSelf(data.a1, at(8, 52));
    const out = await attendanceService.checkOutSelf(data.a1, at(17, 5));
    assert.equal(out.checkOut, "17:05");
    assert.equal(out.checkIn, "08:52");

    await assert.rejects(attendanceService.checkOutSelf(data.a1, at(17, 10)), { statusCode: 409 });
    assert.equal((await todayRow(data.a1)).checkOut, "17:05");
  });

  test("a check-out is never earlier than the check-in", async () => {
    await attendanceService.checkInSelf(data.a1, at(10, 30));
    const out = await attendanceService.checkOutSelf(data.a1, at(10, 30));

    assert.equal(out.checkOut, "10:30");
  });

  test("only active employees can check in", async () => {
    await prisma.employee.update({ where: { id: data.a2.id }, data: { status: "inactive" } });
    const inactive = await prisma.employee.findUnique({ where: { id: data.a2.id } });

    await assert.rejects(attendanceService.checkInSelf(inactive, at(9, 0)), { statusCode: 403 });
    await assert.rejects(attendanceService.checkOutSelf(inactive, at(17, 0)), { statusCode: 403 });
    await prisma.employee.update({ where: { id: data.a2.id }, data: { status: "active" } });
  });
});

describe("checking in and out (the API)", () => {
  test("the whole day, and it shows in today's attendance", async () => {
    const early = await request(app).post("/api/me/check-out").set(amir);
    assert.equal(early.status, 409);

    const inRes = await request(app).post("/api/me/check-in").set(amir);
    assert.equal(inRes.status, 200);
    assert.match(inRes.body.record.checkIn, /^\d\d:\d\d$/);
    assert.equal(inRes.body.record.employeeId, "A-1");

    assert.equal((await request(app).post("/api/me/check-in").set(amir)).status, 409);

    const today = await request(app).get("/api/me/attendance?days=1").set(amir);
    assert.equal(today.body.attendance[0].checkIn, inRes.body.record.checkIn);
    assert.equal(today.body.attendance[0].checkOut, null);

    const outRes = await request(app).post("/api/me/check-out").set(amir);
    assert.equal(outRes.status, 200);
    assert.match(outRes.body.record.checkOut, /^\d\d:\d\d$/);
    assert.equal((await request(app).post("/api/me/check-out").set(amir)).status, 409);
  });

  test("it is the signed-in person's own record, whatever is sent", async () => {
    const res = await request(app).post("/api/me/check-in").set(amir).send({ employeeId: data.b1.id, checkIn: "01:00" });

    assert.equal(res.status, 200);
    assert.equal(res.body.record.employeeId, "A-1");
    assert.equal(await prisma.attendance.count({ where: { employeeId: data.b1.id } }), 0);
    assert.notEqual(res.body.record.checkIn, "01:00");
  });

  test("a manager can check in too, since they are an employee", async () => {
    assert.equal((await request(app).post("/api/me/check-in").set(alice)).status, 200);
  });

  test("HR admin accounts are not employees, and everything needs a login", async () => {
    assert.equal((await request(app).post("/api/me/check-in").set(hr)).status, 403);
    assert.equal((await request(app).post("/api/me/check-out").set(hr)).status, 403);
    assert.equal((await request(app).post("/api/me/check-in")).status, 401);
    assert.equal((await request(app).post("/api/me/check-out")).status, 401);
  });

  test("the manager sees the check-in in their team's attendance", async () => {
    await request(app).post("/api/me/check-in").set(amir);

    const res = await request(app).get("/api/manager/attendance").set(alice);
    const a1 = res.body.rows.find((r) => r.employee.employeeId === "A-1");

    assert.ok(["PRESENT", "LATE"].includes(a1.record.status));
  });
});
