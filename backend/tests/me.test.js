const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login, onApprovedPhone } = require("./helpers");
const attendanceService = require("../src/services/attendanceService");
const { createAdminSchema } = require("../src/validators/authSchema");
const { addDays, asDbDate, fromCompanyTime, isWeekend, todayKey } = require("../src/utils/companyTime");

// A fixed past week, so the rules are checked the same way on any day: Tuesday 10 March 2026
// is a work day, Saturday 14 March is not.
const TUESDAY = "2026-03-10";
const WEDNESDAY = "2026-03-11";
const THURSDAY = "2026-03-12";
const SATURDAY = "2026-03-14";

const at = (dateKey, time) => fromCompanyTime(dateKey, time);

after(() => prisma.$disconnect());

describe("employee accounts", () => {
  const account = (overrides) =>
    createAdminSchema.safeParse({ email: "e@example.com", name: "E", password: "long-enough-1", ...overrides });

  test("an EMPLOYEE account belongs to one employee, like a MANAGER account", () => {
    assert.equal(account({ role: "EMPLOYEE", employeeId: 3 }).success, true);
    assert.equal(account({ role: "EMPLOYEE" }).success, false);
    assert.equal(account({ role: "HR_ADMIN", employeeId: 3 }).success, false);
    assert.equal(account({ role: "OWNER" }).success, false);
  });
});

describe("checking in and out (fixed clock)", () => {
  let data;

  before(async () => {
    data = await seedFixtures();
  });

  test("a work day starts with the check-in button", async () => {
    const day = await attendanceService.getMyDay(data.a1, at(TUESDAY, "08:30"));

    assert.equal(day.today, TUESDAY);
    assert.equal(day.workday, true);
    assert.equal(day.record.status, "NOT_IN");
    assert.equal(day.canCheckIn, true);
    assert.equal(day.canCheckOut, false);
    assert.equal(day.notice, null);
    // Only managers ask HR for corrections
    assert.equal("correctable" in day.record, false);
  });

  test("check in on time, then check out", async () => {
    const checkedIn = await attendanceService.checkIn(data.a1, at(TUESDAY, "08:55"));
    assert.equal(checkedIn.record.status, "PRESENT");
    assert.equal(checkedIn.record.checkIn, "08:55");
    assert.equal(checkedIn.canCheckIn, false);
    assert.equal(checkedIn.canCheckOut, true);

    const checkedOut = await attendanceService.checkOut(data.a1, at(TUESDAY, "17:10"));
    assert.deepEqual([checkedOut.record.checkIn, checkedOut.record.checkOut], ["08:55", "17:10"]);
    assert.equal(checkedOut.canCheckOut, false);
  });

  test("once a day each way", async () => {
    await assert.rejects(attendanceService.checkIn(data.a1, at(TUESDAY, "12:00")), {
      statusCode: 409,
      message: /already checked in/,
    });
    await assert.rejects(attendanceService.checkOut(data.a1, at(TUESDAY, "18:00")), {
      statusCode: 409,
      message: /already checked out/,
    });
  });

  test("no check-out before a check-in", async () => {
    await assert.rejects(attendanceService.checkOut(data.a2, at(TUESDAY, "17:00")), {
      statusCode: 409,
      message: /haven't checked in/,
    });
  });

  test("late means more than the grace minutes after the shift start", async () => {
    const day = await attendanceService.checkIn(data.a2, at(WEDNESDAY, "09:06"));
    assert.equal(day.record.status, "LATE");
  });

  test("two taps at once make one record and one check-out", async () => {
    const twice = (action) => Promise.allSettled([action(), action()]);

    const checkIns = await twice(() => attendanceService.checkIn(data.b1, at(TUESDAY, "09:00")));
    assert.deepEqual(checkIns.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
    assert.equal(checkIns.find((r) => r.status === "rejected").reason.statusCode, 409);
    assert.equal(await prisma.attendance.count({ where: { employeeId: data.b1.id, date: asDbDate(TUESDAY) } }), 1);

    const checkOuts = await twice(() => attendanceService.checkOut(data.b1, at(TUESDAY, "17:00")));
    assert.deepEqual(checkOuts.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
  });

  test("someone who works a weekend checks in as usual, and is never late there", async () => {
    const weekend = await attendanceService.getMyDay(data.a1, at(SATURDAY, "10:00"));
    assert.equal(weekend.workday, false);
    assert.equal(weekend.canCheckIn, true);
    assert.equal(weekend.notice, null);

    const day = await attendanceService.checkIn(data.a1, at(SATURDAY, "11:30"));
    assert.equal(day.record.status, "PRESENT");
    await prisma.attendance.deleteMany({ where: { employeeId: data.a1.id, date: asDbDate(SATURDAY) } });
  });

  test("no check-in before the first day, when not active, or on leave", async () => {

    // Hired on Monday 15 January 2024; the Friday before is a work day but too early.
    await assert.rejects(attendanceService.checkIn(data.a1, at("2024-01-12", "09:00")), {
      statusCode: 400,
      message: /first day, 2024-01-15/,
    });

    await assert.rejects(attendanceService.checkIn({ ...data.a1, status: "inactive" }, at(THURSDAY, "09:00")), {
      statusCode: 403,
      message: /isn't active/,
    });

    await prisma.leaveRequest.create({
      data: {
        employeeId: data.a1.id,
        type: "Sick",
        startDate: asDbDate(THURSDAY),
        endDate: asDbDate(THURSDAY),
        days: 1,
        status: "APPROVED",
        decidedAt: new Date(),
      },
    });
    const onLeave = await attendanceService.getMyDay(data.a1, at(THURSDAY, "09:00"));
    assert.equal(onLeave.record.status, "ON_LEAVE");
    assert.equal(onLeave.canCheckIn, false);
    assert.match(onLeave.notice, /approved leave/);
    await assert.rejects(attendanceService.checkIn(data.a1, at(THURSDAY, "09:00")), { statusCode: 409 });
  });
});

describe("the /api/me API (real clock)", () => {
  let data;
  let employee;
  let manager;
  const today = todayKey();
  const workday = !isWeekend(today);

  before(async () => {
    data = await seedFixtures();

    // Signed in, on their registered phone (its key goes with every request)
    employee = await onApprovedPhone(await login("employee.a1@example.com"), data.a1.id);
    manager = await onApprovedPhone(await login("manager.a@example.com"), data.managerA.id);
  });

  test("today's card comes with the company's day", async () => {
    const res = await request(app).get("/api/me/attendance/today").set(employee);

    assert.equal(res.status, 200);
    assert.equal(res.body.today, today);
    assert.equal(res.body.workday, workday);
    assert.equal(res.body.shift.start, "09:00");
    // Weekends have no shift, but check-in is open every day
    assert.equal(res.body.canCheckIn, true);
    assert.equal(res.body.canCheckOut, false);
    assert.equal(res.body.deviceRegistered, true);
  });

  test("checking in and out through the API", async () => {
    const res = await request(app).post("/api/me/attendance/check-in").set(employee);

    assert.equal(res.status, 200);
    assert.equal(res.body.canCheckOut, true);
    assert.equal((await request(app).post("/api/me/attendance/check-in").set(employee)).status, 409);

    const out = await request(app).post("/api/me/attendance/check-out").set(employee);
    assert.equal(out.status, 200);
    assert.ok(out.body.record.checkOut);
  });

  test("a manager checks in for themselves", async () => {
    const res = await request(app).post("/api/me/attendance/check-in").set(manager);

    assert.equal(res.status, 200);
    const row = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: data.managerA.id, date: asDbDate(today) } },
    });
    assert.ok(row);
  });

  test("own history: newest first, without correctable", async () => {
    const res = await request(app).get("/api/me/attendance").set(employee);

    assert.equal(res.status, 200);
    assert.equal(res.body.today, today);
    assert.equal(res.body.records.length, 7);
    assert.equal(res.body.records[0].date, today);
    assert.equal(res.body.records[6].date, addDays(today, -6));
    assert.ok(res.body.records.every((record) => !("correctable" in record)));

    assert.equal((await request(app).get("/api/me/attendance?days=14").set(employee)).body.records.length, 14);
    assert.equal((await request(app).get("/api/me/attendance?days=40").set(employee)).status, 400);
  });
});
