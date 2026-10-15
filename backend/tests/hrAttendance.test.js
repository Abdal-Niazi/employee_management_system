const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");
const { asDbDate, fromCompanyTime, todayKey } = require("../src/utils/companyTime");
const attendanceService = require("../src/services/attendanceService");

// A fixed past week: Tuesday 10 March 2026 is a work day, Saturday 14 March is not.
const TUESDAY = "2026-03-10";
const WEDNESDAY = "2026-03-11";
const SATURDAY = "2026-03-14";

let data;
let hr;
let hrId;
let managerA;
let employeeA1;

const put = (body, headers = hr) => request(app).put("/api/attendance").set(headers).send(body);
const remove = (employeeId, dateKey, body = undefined, headers = hr) => {
  const req = request(app).delete(`/api/attendance/${employeeId}/${dateKey}`).set(headers);
  return body ? req.send(body) : req;
};
const row = (employeeId, dateKey) =>
  prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: asDbDate(dateKey) } } });

before(async () => {
  data = await seedFixtures();
  hr = await login("hr@example.com");
  hrId = (await prisma.admin.findUnique({ where: { email: "hr@example.com" } })).id;
  managerA = await login("manager.a@example.com");
  employeeA1 = await login("employee.a1@example.com");

  // A-2 is on approved leave on Wednesday.
  await prisma.leaveRequest.create({
    data: {
      employeeId: data.a2.id,
      type: "Sick",
      startDate: asDbDate(WEDNESDAY),
      endDate: asDbDate(WEDNESDAY),
      days: 1,
      status: "APPROVED",
      decidedAt: new Date(),
    },
  });
});
beforeEach(async () => {
  await prisma.attendanceCorrection.deleteMany();
  await prisma.attendance.deleteMany();
});
after(() => prisma.$disconnect());

describe("HR admin: writing attendance directly", () => {
  test("saves a check-in, then fixes it without making a second row", async () => {
    const first = await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:30" });
    assert.equal(first.status, 200);
    assert.equal(first.body.record.status, "LATE");
    assert.equal(first.body.record.checkIn, "09:30");
    assert.equal(first.body.record.editable, true);

    const fixed = await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "08:55", checkOut: "17:10" });
    assert.equal(fixed.body.record.status, "PRESENT");
    assert.equal(fixed.body.record.checkOut, "17:10");
    assert.equal(await prisma.attendance.count({ where: { employeeId: data.a1.id } }), 1);

    const stored = await row(data.a1.id, TUESDAY);
    assert.equal(stored.checkIn.getTime(), fromCompanyTime(TUESDAY, "08:55").getTime());
  });

  test("an empty check-out means none", async () => {
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:00", checkOut: "17:00" });
    const res = await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:00", checkOut: null });

    assert.equal(res.body.record.checkOut, null);
    assert.equal((await row(data.a1.id, TUESDAY)).checkOut, null);
  });

  test("every change is kept with who made it and the times before it", async () => {
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:30" });
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "08:55", checkOut: "17:10", note: "Gate log" });

    const history = await prisma.attendanceCorrection.findMany({ orderBy: { id: "asc" } });
    assert.equal(history.length, 2);
    assert.ok(history.every((c) => c.source === "HR" && c.status === "APPROVED" && c.decidedById === hrId));
    assert.equal(history[0].reason, "Changed by HR");
    assert.equal(history[0].previousCheckIn, null);
    assert.equal(history[1].reason, "Gate log");
    assert.equal(history[1].previousCheckIn.getTime(), fromCompanyTime(TUESDAY, "09:30").getTime());
  });

  test("two changes at the same moment are both kept, each with what it really replaced", async () => {
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "08:00" });
    const results = await Promise.all(["09:00", "09:30"].map((checkIn) => put({ employeeId: data.a1.id, date: TUESDAY, checkIn })));
    assert.deepEqual(results.map((r) => r.status), [200, 200]);

    // In the order they were saved, each change's "before" is the change saved just before it.
    const history = await prisma.attendanceCorrection.findMany({ orderBy: { id: "asc" } });
    assert.equal(history.length, 3);
    for (let i = 1; i < history.length; i++) {
      assert.equal(history[i].previousCheckIn.getTime(), history[i - 1].checkIn.getTime());
    }
    assert.equal((await row(data.a1.id, TUESDAY)).checkIn.getTime(), history[2].checkIn.getTime());
  });

  test("the manager and the employee see it as corrected by HR", async () => {
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:00", checkOut: "17:00" });

    const team = await request(app).get(`/api/manager/attendance?date=${TUESDAY}`).set(managerA);
    const amir = team.body.rows.find((r) => r.employee.employeeId === "A-1").record;
    assert.equal(amir.correction.status, "APPROVED");
    assert.equal(amir.checkIn, "09:00");

    // HR's own changes aren't requests, so they don't appear in anyone's request list.
    const requests = await request(app).get("/api/manager/attendance-corrections").set(managerA);
    assert.deepEqual(requests.body.corrections, []);
    const hrRequests = await request(app).get("/api/attendance-corrections").set(hr);
    assert.deepEqual(hrRequests.body.corrections, []);
  });

  test("lists everyone for a day, with the company's today", async () => {
    await put({ employeeId: data.b1.id, date: TUESDAY, checkIn: "08:40" });

    const res = await request(app).get(`/api/attendance?date=${TUESDAY}`).set(hr);

    assert.equal(res.status, 200);
    assert.equal(res.body.today, todayKey());
    assert.equal(res.body.rows.find((r) => r.employee.employeeId === "B-1").record.status, "PRESENT");
    assert.equal(res.body.rows.length, 5);
    assert.ok(res.body.rows.every((r) => !("correctable" in r.record)));

    assert.equal((await request(app).get("/api/attendance").set(hr)).body.date, todayKey());
  });

  test("people who left aren't listed; inactive people are, as inactive", async () => {
    await prisma.employee.update({ where: { id: data.b1.id }, data: { status: "terminated" } });
    await prisma.employee.update({ where: { id: data.a2.id }, data: { status: "inactive" } });
    try {
      const res = await request(app).get(`/api/attendance?date=${TUESDAY}`).set(hr);
      const codes = res.body.rows.map((r) => r.employee.employeeId);
      assert.ok(!codes.includes("B-1"));
      assert.equal(res.body.rows.find((r) => r.employee.employeeId === "A-2").record.status, "INACTIVE");

      // HR still handles an inactive person's attendance.
      assert.equal((await put({ employeeId: data.a2.id, date: TUESDAY, checkIn: "09:00" })).status, 200);
    } finally {
      await prisma.employee.updateMany({ where: { id: { in: [data.a2.id, data.b1.id] } }, data: { status: "active" } });
    }
  });

  test("a weekend day can be written; a day of approved leave only if it has a check-in", async () => {
    const day = await request(app).get(`/api/attendance?date=${WEDNESDAY}`).set(hr);
    assert.equal(day.body.rows.find((r) => r.employee.employeeId === "A-2").record.editable, false);
    const onLeave = await put({ employeeId: data.a2.id, date: WEDNESDAY, checkIn: "09:00" });
    assert.equal(onLeave.status, 409);

    const saturday = await request(app).get(`/api/attendance?date=${SATURDAY}`).set(hr);
    assert.ok(saturday.body.rows.every((r) => r.record.status === "OFF" && r.record.editable));
    const weekend = await put({ employeeId: data.a1.id, date: SATURDAY, checkIn: "11:30", checkOut: "14:00" });
    assert.equal(weekend.status, 200);
    assert.equal(weekend.body.record.status, "PRESENT");
    assert.equal((await request(app).delete(`/api/attendance/${data.a1.id}/${SATURDAY}`).set(hr)).status, 200);

    // Leave approved after the person had checked in: the check-in shows and HR can still fix it
    await prisma.attendance.create({ data: { employeeId: data.a2.id, date: asDbDate(WEDNESDAY), checkIn: fromCompanyTime(WEDNESDAY, "09:40") } });
    const withCheckIn = (await request(app).get(`/api/attendance?date=${WEDNESDAY}`).set(hr)).body.rows.find(
      (r) => r.employee.employeeId === "A-2"
    ).record;
    assert.equal(withCheckIn.status, "LATE");
    assert.equal(withCheckIn.editable, true);
    assert.equal((await put({ employeeId: data.a2.id, date: WEDNESDAY, checkIn: "09:00" })).status, 200);
    await prisma.attendance.deleteMany({ where: { employeeId: data.a2.id, date: asDbDate(WEDNESDAY) } });
  });

  test("won't write the future, a day before the hire date, or an unknown employee", async () => {
    assert.equal((await put({ employeeId: data.a1.id, date: "2999-01-01", checkIn: "09:00" })).status, 400);
    assert.equal((await put({ employeeId: data.a1.id, date: "2023-12-01", checkIn: "09:00" })).status, 400);
    assert.equal((await put({ employeeId: 999999, date: TUESDAY, checkIn: "09:00" })).status, 404);
    assert.equal((await request(app).get("/api/attendance?date=2999-01-01").set(hr)).status, 400);
  });

  test("today's times can't be later than now", async () => {
    // Fixed clock: Tuesday at 10:00 company time
    const now = fromCompanyTime(TUESDAY, "10:00");
    const body = { employeeId: data.a1.id, date: TUESDAY, checkIn: "09:00" };

    await assert.rejects(attendanceService.recordDay(hrId, { ...body, checkOut: "17:00" }, now), /later than now/);
    const record = await attendanceService.recordDay(hrId, body, now);
    assert.equal(record.status, "PRESENT");
  });

  test("rejects bad input", async () => {
    assert.equal((await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "9:30" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "25:00" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "10:00", checkOut: "09:00" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: "2026-02-31", checkIn: "09:00" })).status, 422);
    assert.equal((await put({ date: TUESDAY, checkIn: "09:00" })).status, 422);
    assert.equal((await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:00", note: "x".repeat(501) })).status, 422);
  });
});

describe("HR admin: removing a check-in", () => {
  test("removes it, keeps it in the history, and says so when there is none", async () => {
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:10", checkOut: "17:00" });

    const res = await remove(data.a1.id, TUESDAY, { note: "Checked in by mistake" });
    assert.equal(res.status, 200);
    assert.equal(res.body.record.status, "ABSENT");
    assert.equal(res.body.record.checkIn, null);
    assert.equal(await row(data.a1.id, TUESDAY), null);

    const last = await prisma.attendanceCorrection.findFirst({ orderBy: { id: "desc" } });
    assert.equal(last.checkIn, null);
    assert.equal(last.reason, "Checked in by mistake");
    assert.equal(last.previousCheckIn.getTime(), fromCompanyTime(TUESDAY, "09:10").getTime());

    assert.equal((await remove(data.a1.id, TUESDAY)).status, 404);
    assert.equal((await remove(data.a1.id, "nope")).status, 400);

    // Without a note, the history still says what happened.
    await put({ employeeId: data.a1.id, date: TUESDAY, checkIn: "09:10" });
    await remove(data.a1.id, TUESDAY);
    const unnamed = await prisma.attendanceCorrection.findFirst({ orderBy: { id: "desc" } });
    assert.equal(unnamed.reason, "Check-in removed by HR");
    assert.equal((await remove("abc", TUESDAY)).status, 400);
    assert.equal((await remove(999999, TUESDAY)).status, 404);
  });
});

describe("who may use it", () => {
  test("only HR admins write or read everyone's attendance", async () => {
    const body = { employeeId: data.a1.id, date: TUESDAY, checkIn: "09:00" };

    for (const headers of [managerA, employeeA1]) {
      assert.equal((await put(body, headers)).status, 403);
      assert.equal((await request(app).get("/api/attendance").set(headers)).status, 403);
      assert.equal((await remove(data.a1.id, TUESDAY, undefined, headers)).status, 403);
    }
  });

  test("everything needs a login", async () => {
    assert.equal((await request(app).get("/api/attendance")).status, 401);
    assert.equal((await request(app).put("/api/attendance").send({})).status, 401);
    assert.equal((await request(app).delete(`/api/attendance/${data.a1.id}/${TUESDAY}`)).status, 401);
  });
});
