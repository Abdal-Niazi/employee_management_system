const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");
const { buildRecord, localDateKey } = require("../src/services/attendanceService");

// Fixed days far from "now": a Monday, the Saturday before it, a later Tuesday on which A-1 has approved leave.
const MONDAY = "2026-10-05";
const TUESDAY_AFTER = "2026-10-06";
const SATURDAY = "2026-10-03";
const LEAVE_DAY = "2026-11-03";

let data;
let managerA;
let hr;

const checkIn = (employee, dateKey, time, out = null) =>
  prisma.attendance.create({
    data: { employeeId: employee.id, date: new Date(`${dateKey}T00:00:00Z`), checkIn: time, checkOut: out },
  });

before(async () => {
  data = await seedFixtures();
  managerA = await login("manager.a@example.com");
  hr = await login("hr@example.com");
});
beforeEach(() => prisma.attendance.deleteMany());
after(() => prisma.$disconnect());

describe("how a day's status is worked out", () => {
  const employee = { id: 1, employeeId: "E-1", hireDate: new Date("2024-01-15") };
  const record = (overrides) => buildRecord({ employee, dateKey: MONDAY, now: new Date(2026, 9, 20, 12, 0), ...overrides });

  test("a check-in within the grace period is on time, after it is late", () => {
    assert.equal(record({ row: { checkIn: "09:05", checkOut: null } }).status, "PRESENT");
    assert.equal(record({ row: { checkIn: "09:06", checkOut: null } }).status, "LATE");
    assert.equal(record({ row: { checkIn: "08:30", checkOut: "17:00" } }).checkOut, "17:00");
  });

  test("nobody is absent until the shift is over", () => {
    const today = { dateKey: "2026-10-09" };
    assert.equal(record({ ...today, now: new Date(2026, 9, 9, 10, 0) }).status, "NOT_IN");
    assert.equal(record({ ...today, now: new Date(2026, 9, 9, 17, 30) }).status, "ABSENT");
    assert.equal(record({ dateKey: "2026-10-08", now: new Date(2026, 9, 9, 8, 0) }).status, "ABSENT");
    assert.equal(record({ dateKey: "2026-10-12", now: new Date(2026, 9, 9, 8, 0) }).status, "NOT_IN");
  });

  test("weekends and days before the hire date are off, but a saved check-in still counts", () => {
    assert.equal(record({ dateKey: SATURDAY }).status, "OFF");
    assert.equal(record({ dateKey: "2023-12-01" }).status, "OFF");
    assert.equal(record({ dateKey: SATURDAY, row: { checkIn: "10:00", checkOut: null } }).status, "LATE");
  });

  test("approved leave shows as on leave", () => {
    const approvedLeave = [{ employeeId: 1, startDate: new Date("2026-10-05"), endDate: new Date("2026-10-07") }];
    assert.equal(record({ dateKey: "2026-10-06", approvedLeave }).status, "ON_LEAVE");
    assert.equal(record({ dateKey: "2026-10-08", approvedLeave }).status, "ABSENT");
  });
});

describe("manager: team attendance", () => {
  test("shows only the team, with each person's status and the day's counts", async () => {
    await checkIn(data.a1, MONDAY, "08:50", "17:05");
    await checkIn(data.a2, MONDAY, "09:20");
    await checkIn(data.b1, MONDAY, "08:00", "16:00");

    const res = await request(app).get(`/api/manager/attendance?date=${MONDAY}`).set(managerA);

    assert.equal(res.status, 200);
    assert.equal(res.body.date, MONDAY);
    assert.deepEqual(res.body.rows.map((r) => [r.employee.employeeId, r.record.status]), [
      ["A-1", "PRESENT"],
      ["A-2", "LATE"],
    ]);
    assert.equal(res.body.rows[0].record.checkIn, "08:50");
    assert.equal(res.body.rows[0].record.checkOut, "17:05");
    assert.equal(res.body.rows[1].record.checkOut, null);
    assert.equal(res.body.counts.PRESENT, 1);
    assert.equal(res.body.counts.LATE, 1);
    assert.equal(res.body.shift.start, "09:00");
  });

  test("a past weekday with no check-in is absent, a weekend is off", async () => {
    const absent = await request(app).get(`/api/manager/attendance?date=${TUESDAY_AFTER}`).set(managerA);
    assert.deepEqual(absent.body.rows.map((r) => r.record.status), ["ABSENT", "ABSENT"]);
    assert.equal(absent.body.counts.ABSENT, 2);

    const weekend = await request(app).get(`/api/manager/attendance?date=${SATURDAY}`).set(managerA);
    assert.deepEqual(weekend.body.rows.map((r) => r.record.status), ["OFF", "OFF"]);
  });

  test("approved leave shows as on leave", async () => {
    const res = await request(app).get(`/api/manager/attendance?date=${LEAVE_DAY}`).set(managerA);
    const a1 = res.body.rows.find((r) => r.employee.employeeId === "A-1");

    assert.equal(a1.record.status, "ON_LEAVE");
  });

  test("defaults to today, and rejects a bad date", async () => {
    const res = await request(app).get("/api/manager/attendance").set(managerA);
    assert.equal(res.status, 200);
    assert.equal(res.body.date, localDateKey(new Date()));

    assert.equal((await request(app).get("/api/manager/attendance?date=2026-02-31").set(managerA)).status, 400);
    assert.equal((await request(app).get("/api/manager/attendance?date=yesterday").set(managerA)).status, 400);
  });
});

describe("manager: one member's attendance", () => {
  test("lists the last days, newest first", async () => {
    const res = await request(app).get(`/api/manager/team/${data.a1.id}/attendance?days=3`).set(managerA);

    assert.equal(res.status, 200);
    assert.equal(res.body.attendance.length, 3);
    assert.equal(res.body.attendance[0].date, localDateKey(new Date()));
    assert.ok(res.body.attendance[0].date > res.body.attendance[2].date);
  });

  test("uses 7 days by default and refuses silly values", async () => {
    const res = await request(app).get(`/api/manager/team/${data.a1.id}/attendance`).set(managerA);
    assert.equal(res.body.attendance.length, 7);

    for (const days of ["0", "32", "abc", "1.5"]) {
      assert.equal((await request(app).get(`/api/manager/team/${data.a1.id}/attendance?days=${days}`).set(managerA)).status, 400);
    }
  });

  test("another team's member is not found", async () => {
    assert.equal((await request(app).get(`/api/manager/team/${data.b1.id}/attendance`).set(managerA)).status, 404);
  });
});

describe("HR admin: recording attendance", () => {
  const put = (body) => request(app).put("/api/attendance").set(hr).send(body);

  test("saves a check-in, then corrects it without making a second row", async () => {
    const first = await put({ employeeId: data.a1.id, date: MONDAY, checkIn: "09:30" });
    assert.equal(first.status, 200);
    assert.equal(first.body.record.status, "LATE");

    const fixed = await put({ employeeId: data.a1.id, date: MONDAY, checkIn: "08:55", checkOut: "17:10" });
    assert.equal(fixed.body.record.status, "PRESENT");
    assert.equal(fixed.body.record.checkOut, "17:10");
    assert.equal(await prisma.attendance.count({ where: { employeeId: data.a1.id } }), 1);
  });

  test("lists everyone for a day", async () => {
    await put({ employeeId: data.b1.id, date: MONDAY, checkIn: "08:40" });

    const res = await request(app).get(`/api/attendance?date=${MONDAY}`).set(hr);

    assert.equal(res.status, 200);
    const b1 = res.body.rows.find((r) => r.employee.employeeId === "B-1");
    assert.equal(b1.record.status, "PRESENT");
    assert.ok(res.body.rows.length >= 5);
  });

  test("rejects bad input", async () => {
    assert.equal((await put({ employeeId: data.a1.id, date: MONDAY, checkIn: "9:30" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: MONDAY, checkIn: "25:00" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: MONDAY, checkIn: "10:00", checkOut: "09:00" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: "2026-02-31", checkIn: "09:00" })).status, 422);
    assert.equal((await put({ date: MONDAY, checkIn: "09:00" })).status, 422);
  });

  test("won't record the future, a day before the hire date, or an unknown employee", async () => {
    assert.equal((await put({ employeeId: data.a1.id, date: "2999-01-01", checkIn: "09:00" })).status, 400);
    assert.equal((await put({ employeeId: data.a1.id, date: "2023-12-01", checkIn: "09:00" })).status, 400);
    assert.equal((await put({ employeeId: 999999, date: MONDAY, checkIn: "09:00" })).status, 404);
  });

  test("removes a record, and says so when there is none", async () => {
    await put({ employeeId: data.a1.id, date: MONDAY, checkIn: "09:00" });

    assert.equal((await request(app).delete(`/api/attendance/${data.a1.id}/${MONDAY}`).set(hr)).status, 200);
    assert.equal(await prisma.attendance.count(), 0);
    assert.equal((await request(app).delete(`/api/attendance/${data.a1.id}/${MONDAY}`).set(hr)).status, 404);
    assert.equal((await request(app).delete(`/api/attendance/${data.a1.id}/nope`).set(hr)).status, 400);
  });
});

describe("who may use it", () => {
  test("managers cannot record or read everyone's attendance", async () => {
    const body = { employeeId: data.a1.id, date: MONDAY, checkIn: "09:00" };

    assert.equal((await request(app).put("/api/attendance").set(managerA).send(body)).status, 403);
    assert.equal((await request(app).get("/api/attendance").set(managerA)).status, 403);
    assert.equal((await request(app).delete(`/api/attendance/${data.a1.id}/${MONDAY}`).set(managerA)).status, 403);
  });

  test("HR admins have no team, so the manager endpoints refuse them", async () => {
    assert.equal((await request(app).get("/api/manager/attendance").set(hr)).status, 403);
  });

  test("everything needs a login", async () => {
    assert.equal((await request(app).get("/api/attendance")).status, 401);
    assert.equal((await request(app).get("/api/manager/attendance")).status, 401);
    assert.equal((await request(app).get(`/api/manager/team/${data.a1.id}/attendance`)).status, 401);
  });
});
