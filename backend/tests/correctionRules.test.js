const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { prisma, seedFixtures } = require("./helpers");
const { addDays, asDbDate, isWeekend, todayKey } = require("../src/utils/companyTime");
const attendanceService = require("../src/services/attendanceService");

// A work day inside the correction window, so the requests are allowed by the calendar.
const day = [1, 2, 3, 4, 5, 6].map((i) => addDays(todayKey(), -i)).find((d) => !isWeekend(d));
const date = asDbDate(day);

let data;
let hrId;

before(async () => {
  data = await seedFixtures();
  hrId = (await prisma.admin.findUnique({ where: { email: "hr@example.com" } })).id;
});
after(() => prisma.$disconnect());

beforeEach(async () => {
  await prisma.attendanceCorrection.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.leaveRequest.deleteMany({ where: { reason: "Correction rules test" } });
  await prisma.employee.update({ where: { id: data.a1.id }, data: { status: "active" } });
});

const ask = () =>
  attendanceService.requestCorrection(data.managerA.id, {
    employeeId: data.a1.id,
    date: day,
    checkIn: "09:00",
    checkOut: "17:00",
    reason: "Fingerprint machine was down",
  });

const approve = (id) => attendanceService.decideCorrection(hrId, id, { status: "APPROVED" });

describe("correction requests", () => {
  test("two requests for the same day sent at once: one is saved, the other refused", async () => {
    const results = await Promise.allSettled([ask(), ask(), ask()]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      assert.equal(r.reason.statusCode, 409);
    }
    assert.equal(await prisma.attendanceCorrection.count({ where: { employeeId: data.a1.id, date } }), 1);
  });

  test("approving is refused when the employee isn't active any more", async () => {
    const correction = await ask();
    await prisma.employee.update({ where: { id: data.a1.id }, data: { status: "inactive" } });

    await assert.rejects(approve(correction.id), { statusCode: 409, message: /isn't active/ });
    // Nothing changed: the request still waits, and there is no record
    assert.equal((await prisma.attendanceCorrection.findUnique({ where: { id: correction.id } })).status, "PENDING");
    assert.equal(await prisma.attendance.count({ where: { employeeId: data.a1.id, date } }), 0);

    // Rejecting still works
    const rejected = await attendanceService.decideCorrection(hrId, correction.id, { status: "REJECTED" });
    assert.equal(rejected.status, "REJECTED");
  });

  test("approving is refused when leave was approved for that day after the request", async () => {
    const correction = await ask();
    await prisma.leaveRequest.create({
      data: {
        employeeId: data.a1.id,
        type: "Sick",
        startDate: date,
        endDate: date,
        days: 1,
        reason: "Correction rules test",
        status: "APPROVED",
        decidedAt: new Date(),
      },
    });

    await assert.rejects(approve(correction.id), { statusCode: 409, message: /approved leave/ });
    assert.equal((await prisma.attendanceCorrection.findUnique({ where: { id: correction.id } })).status, "PENDING");
  });

  test("a day of leave that already has a check-in can still be corrected and approved", async () => {
    await prisma.attendance.create({ data: { employeeId: data.a1.id, date, checkIn: new Date(`${day}T05:00:00Z`) } });
    await prisma.leaveRequest.create({
      data: {
        employeeId: data.a1.id,
        type: "Sick",
        startDate: date,
        endDate: date,
        days: 1,
        reason: "Correction rules test",
        status: "APPROVED",
        decidedAt: new Date(),
      },
    });

    const correction = await ask();
    const approved = await approve(correction.id);
    assert.equal(approved.status, "APPROVED");
    assert.deepEqual(approved.requested, { checkIn: "09:00", checkOut: "17:00" });
  });

  test("the lists match each request with its own day's record", async () => {
    await prisma.attendance.create({ data: { employeeId: data.a1.id, date, checkIn: new Date(`${day}T05:00:00Z`) } });
    // Another person checked in on the same day; their record must not show on Amir's request
    await prisma.attendance.create({ data: { employeeId: data.a2.id, date, checkIn: new Date(`${day}T03:00:00Z`) } });
    await ask();

    const [listed] = await attendanceService.listAllCorrections("PENDING");
    assert.deepEqual(listed.before, { checkIn: "10:00", checkOut: null });
  });
});
