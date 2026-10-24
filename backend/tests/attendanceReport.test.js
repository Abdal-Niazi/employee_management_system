const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");
const { fromCompanyTime, todayKey } = require("../src/utils/companyTime");
const reportService = require("../src/services/attendanceReportService");

let hr;
let manager;
let employee;

// September 2026 is over, has 22 weekdays (Tuesday 1st to Wednesday 30th), and is the same on every run.
const MONTH = "2026-09";

const report = (query = `month=${MONTH}`, headers = hr) => request(app).get(`/api/attendance/report?${query}`).set(headers);
const rowOf = (res, code) => res.body.rows.find((r) => r.employee.employeeId === code);

let counter = 0;
const person = (data = {}) => {
  counter += 1;
  return prisma.employee.create({
    data: {
      employeeId: `RPT-${counter}`,
      firstName: `Person${String(counter).padStart(2, "0")}`,
      lastName: "Test",
      email: `rpt-${counter}@example.com`,
      hireDate: new Date("2024-01-15"),
      ...data,
    },
  });
};

const checkIn = (employeeId, day, from, to) =>
  prisma.attendance.create({
    data: {
      employeeId,
      date: new Date(`${day}T00:00:00Z`),
      checkIn: fromCompanyTime(day, from),
      checkOut: to ? fromCompanyTime(day, to) : null,
    },
  });

before(async () => {
  await seedFixtures();
  hr = await login("hr@example.com");
  manager = await login("manager.a@example.com");
  employee = await login("employee.a1@example.com");
});
after(() => prisma.$disconnect());

describe("who may open the report", () => {
  test("needs a login, and only an HR admin gets in", async () => {
    assert.equal((await request(app).get("/api/attendance/report")).status, 401);
    assert.equal((await report(`month=${MONTH}`, manager)).status, 403);
    assert.equal((await report(`month=${MONTH}`, employee)).status, 403);
    assert.equal((await report(`month=${MONTH}&format=csv`, manager)).status, 403);
  });

  test("refuses a month that isn't YYYY-MM, one that hasn't started, and a format it doesn't know", async () => {
    for (const month of ["2026-13", "2026-00", "26-09", "2026-9", "abc", ""]) {
      assert.equal((await report(`month=${month}`)).status, 400, month);
    }
    const future = await report("month=2099-01");
    assert.equal(future.status, 400);
    assert.match(future.body.message, /hasn't started/);
    assert.equal((await report(`month=${MONTH}&format=xml`)).status, 400);
  });

  test("without a month it is the company's current month", async () => {
    const res = await report("");

    assert.equal(res.status, 200);
    assert.equal(res.body.month, todayKey().slice(0, 7));
  });
});

describe("a month of one person", () => {
  let anna; // on time, late, on leave, absent, a weekend, and a day without a check-out

  before(async () => {
    anna = await person({ firstName: "Anna" });
    // On time (09:00-17:00): 1-4 and 7-9, 11, 14 September, 8 hours each (9 days)
    for (const day of ["01", "02", "03", "04", "07", "08", "09", "11", "14"]) await checkIn(anna.id, `2026-09-${day}`, "09:00", "17:00");
    // Checked in and never out
    await checkIn(anna.id, "2026-09-10", "09:00", null);
    // Late: after 09:05 (2 days of 8 hours)
    await checkIn(anna.id, "2026-09-15", "09:30", "17:30");
    await checkIn(anna.id, "2026-09-16", "09:30", "17:30");
    // A Saturday worked: counts as present, 2 hours
    await checkIn(anna.id, "2026-09-05", "10:00", "12:00");
    // Approved leave, Monday 21st to Friday 25th
    await prisma.leaveRequest.create({
      data: { employeeId: anna.id, type: "Annual", startDate: new Date("2026-09-21"), endDate: new Date("2026-09-25"), days: 5, status: "APPROVED" },
    });
    // A request that isn't approved changes nothing
    await prisma.leaveRequest.create({
      data: { employeeId: anna.id, type: "Casual", startDate: new Date("2026-09-17"), endDate: new Date("2026-09-17"), days: 1, status: "PENDING" },
    });
  });

  test("counts each kind of day, the hours, and the days left without a check-out", async () => {
    const res = await report();
    const row = rowOf(res, anna.employeeId);

    assert.equal(res.status, 200);
    // 22 weekdays = 10 on time + 2 late + 5 on leave + 5 without a check-in (17, 18, 28, 29, 30 September)
    assert.deepEqual(row.counts, { PRESENT: 11, LATE: 2, ABSENT: 5, ON_LEAVE: 5, NOT_IN: 0, INACTIVE: 0 });
    assert.equal(row.scheduledDays, 22);
    // The Saturday counts as a day worked, on top of the 10 weekdays on time
    assert.equal(row.daysWorked, 13);
    // 9 x 8 + 2 x 8 + 2 hours (the day without a check-out adds none)
    assert.equal(row.workedMinutes, (72 + 16 + 2) * 60);
    assert.equal(row.openDays, 1);
  });

  test("the answer says which days were counted", async () => {
    const res = await report();

    assert.equal(res.body.month, MONTH);
    assert.equal(res.body.from, "2026-09-01");
    assert.equal(res.body.to, "2026-09-30");
    assert.equal(res.body.partial, false);
    assert.equal(res.body.workdays, 22);
    assert.equal(res.body.shift.start, "09:00");
  });

  test("the totals add up the rows", async () => {
    const res = await report();
    const sum = (pick) => res.body.rows.reduce((n, r) => n + pick(r), 0);

    assert.equal(res.body.totals.daysWorked, sum((r) => r.daysWorked));
    assert.equal(res.body.totals.workedMinutes, sum((r) => r.workedMinutes));
    assert.equal(res.body.totals.counts.ABSENT, sum((r) => r.counts.ABSENT));
    assert.equal(res.body.totals.scheduledDays, sum((r) => r.scheduledDays));
  });

  test("shows only what HR needs of a person: no email or phone", async () => {
    const row = rowOf(await report(), anna.employeeId);

    assert.deepEqual(Object.keys(row.employee).sort(), [
      "department",
      "employeeId",
      "firstName",
      "id",
      "lastName",
      "photoUpdatedAt",
      "position",
    ]);
  });

  test("carries the date of a person's photo, so the list can show it", async () => {
    const withPhoto = await person({ firstName: "Photo", photoUpdatedAt: new Date("2026-09-10T08:00:00Z") });
    const res = await report();

    assert.equal(rowOf(res, withPhoto.employeeId).employee.photoUpdatedAt, "2026-09-10T08:00:00.000Z");
    assert.equal(rowOf(res, anna.employeeId).employee.photoUpdatedAt, null);
  });
});

describe("who is in the month", () => {
  test("someone hired mid-month counts from the hire date; one hired after it, or who left, is left out", async () => {
    const mid = await person({ firstName: "Bilal", hireDate: new Date("2026-09-15") });
    const later = await person({ firstName: "Chand", hireDate: new Date("2026-10-05") });
    const gone = await person({ firstName: "Dania", status: "terminated" });
    const res = await report();

    // Tuesday 15th to Wednesday 30th: 4 + 5 + 3 weekdays, none with a check-in
    const row = rowOf(res, mid.employeeId);
    assert.equal(row.scheduledDays, 12);
    assert.deepEqual([row.counts.ABSENT, row.counts.PRESENT], [12, 0]);
    assert.equal(rowOf(res, later.employeeId), undefined);
    assert.equal(rowOf(res, gone.employeeId), undefined);
  });

  test("someone not active is not counted absent", async () => {
    const away = await person({ firstName: "Eman", status: "inactive" });
    const row = rowOf(await report(), away.employeeId);

    assert.deepEqual([row.counts.INACTIVE, row.counts.ABSENT], [22, 0]);
  });

  test("people are listed by name", async () => {
    const names = (await report()).body.rows.map((r) => r.employee.firstName);

    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("a month that isn't over", () => {
  test("counts only the days up to today, and today isn't absent until the shift is over", async () => {
    // Wednesday 14 October 2026, midday: 1-2 and 5-9 and 12-14 October are weekdays so far (10)
    const noon = await reportService.getMonthReport("2026-10", fromCompanyTime("2026-10-14", "12:00"));
    const someone = noon.rows.find((r) => r.employee.employeeId === "MGR-A");

    assert.equal(noon.partial, true);
    assert.equal(noon.to, "2026-10-14");
    assert.equal(noon.workdays, 10);
    assert.deepEqual([someone.counts.ABSENT, someone.counts.NOT_IN], [9, 1]);

    const evening = await reportService.getMonthReport("2026-10", fromCompanyTime("2026-10-14", "17:30"));
    assert.deepEqual(
      [evening.rows.find((r) => r.employee.employeeId === "MGR-A").counts.ABSENT, evening.rows.find((r) => r.employee.employeeId === "MGR-A").counts.NOT_IN],
      [10, 0]
    );
  });

  test("today's open check-in is not yet a day without a check-out", async () => {
    const worker = await person({ firstName: "Farah" });
    await checkIn(worker.id, "2026-10-14", "09:00", null);
    await checkIn(worker.id, "2026-10-13", "09:00", null);
    const res = await reportService.getMonthReport("2026-10", fromCompanyTime("2026-10-14", "12:00"));

    // Yesterday's can be fixed; today's may still be going
    assert.equal(res.rows.find((r) => r.employee.id === worker.id).openDays, 1);
  });
});

describe("the CSV file", () => {
  test("comes as a download named for the month, with a header, a row per person and a total", async () => {
    const res = await report(`month=${MONTH}&format=csv`);

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.equal(res.headers["content-disposition"], 'attachment; filename="attendance-2026-09.csv"');

    const text = res.text;
    // Starts with a byte order mark (so Excel reads accents), uses Windows line endings
    assert.equal(text.charCodeAt(0), 0xfeff);
    const lines = text.slice(1).split("\r\n");
    assert.equal(lines[0], "Employee ID,Name,Department,Position,Scheduled days,Present,Late,Absent,On leave,Days worked,Hours worked,Days without check-out");
    assert.equal(lines.at(-1), "");
    assert.match(lines.at(-2), /^,Total,,,/);

    const anna = lines.find((line) => line.includes("Anna Test"));
    assert.match(anna, /^RPT-\d+,Anna Test,,,22,11,2,5,5,13,90\.0,1$/);
  });

  test("a name that would run as a formula is neutralised, and commas and quotes are escaped", async () => {
    await person({ firstName: "=SUM(1)", department: 'R&D, "Core"', position: "+Lead" });
    const text = (await report(`month=${MONTH}&format=csv`)).text;

    assert.ok(text.includes("'=SUM(1) Test"), "formula in a name");
    assert.ok(text.includes('"R&D, ""Core"""'), "comma and quotes in a department");
    assert.ok(text.includes("'+Lead"), "formula in a position");
    assert.ok(!/(^|,)=SUM/m.test(text.slice(1)), "no cell may start with =");
  });
});
