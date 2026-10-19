const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const { SHIFT, attendanceStatus } = require("../utils/attendanceRules");
const { addDays, asDbDate, isWeekend, toDateKey, todayKey } = require("../utils/companyTime");

// One month of everyone's attendance, counted the way the day screens show it (the same status of
// each day), for HR. Only days up to today are counted. People who left (status "terminated") are
// left out, like on the day screen, and so is anyone hired after the month.

// OFF (weekends and days before the hire date) isn't a count of its own.
const COUNTED = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "NOT_IN", "INACTIVE"];

const lastDayOfMonth = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
};

const emptyCounts = () => Object.fromEntries(COUNTED.map((status) => [status, 0]));

const toEmployeeDto = ({ id, employeeId, firstName, lastName, department, position }) => ({
  id,
  employeeId,
  firstName,
  lastName,
  department,
  position,
});

// `now` is only for tests.
const getMonthReport = async (monthKey, now = new Date()) => {
  const today = todayKey(now);
  const first = `${monthKey}-01`;
  if (first > today) throw new AppError("That month hasn't started yet", 400);

  const last = lastDayOfMonth(monthKey);
  const to = last < today ? last : today;

  const days = [];
  for (let day = first; day <= to; day = addDays(day, 1)) days.push(day);

  const [people, records, leave] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { not: "terminated" }, hireDate: { lt: asDbDate(addDays(to, 1)) } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.attendance.findMany({ where: { date: { gte: asDbDate(first), lte: asDbDate(to) } } }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: asDbDate(to) }, endDate: { gte: asDbDate(first) } },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ]);

  // Looked up by person and day, so the month costs one pass over each list
  const recordAt = new Map(records.map((r) => [`${r.employeeId}:${toDateKey(r.date)}`, r]));
  const leaveOf = new Map();
  for (const l of leave) {
    if (!leaveOf.has(l.employeeId)) leaveOf.set(l.employeeId, []);
    leaveOf.get(l.employeeId).push({ from: toDateKey(l.startDate), to: toDateKey(l.endDate) });
  }

  const rows = people.map((employee) => {
    const hireDateKey = toDateKey(employee.hireDate);
    const leaves = leaveOf.get(employee.id) ?? [];
    const counts = emptyCounts();
    let scheduledDays = 0;
    let workedMinutes = 0;
    let openDays = 0;

    for (const day of days) {
      const record = recordAt.get(`${employee.id}:${day}`) ?? null;
      const status = attendanceStatus({
        dateKey: day,
        hireDateKey,
        onLeave: leaves.some((l) => l.from <= day && day <= l.to),
        record,
        active: employee.status === "active",
        now,
      });

      if (status in counts) counts[status] += 1;
      if (day >= hireDateKey && !isWeekend(day)) scheduledDays += 1;

      if (record?.checkOut) workedMinutes += Math.round((record.checkOut - record.checkIn) / 60_000);
      // Checked in, never out: a past day shows what to fix (today may still be going)
      else if (record && day < today) openDays += 1;
    }

    return {
      employee: toEmployeeDto(employee),
      scheduledDays,
      counts,
      daysWorked: counts.PRESENT + counts.LATE,
      workedMinutes,
      openDays,
    };
  });

  const totals = {
    scheduledDays: 0,
    counts: emptyCounts(),
    daysWorked: 0,
    workedMinutes: 0,
    openDays: 0,
  };
  for (const row of rows) {
    totals.scheduledDays += row.scheduledDays;
    totals.daysWorked += row.daysWorked;
    totals.workedMinutes += row.workedMinutes;
    totals.openDays += row.openDays;
    for (const status of COUNTED) totals.counts[status] += row.counts[status];
  }

  return {
    month: monthKey,
    from: first,
    to,
    today,
    // The month isn't over yet: only the days so far are counted
    partial: to < last,
    // Monday to Friday days in the counted range
    workdays: days.filter((day) => !isWeekend(day)).length,
    shift: SHIFT,
    rows,
    totals,
  };
};

// ---------- CSV ----------

// A cell for a spreadsheet. A value that starts with = + - @ (or a tab or return) would run as a
// formula when the file is opened, so it gets a ' in front; quotes, commas and line breaks are
// wrapped the usual way.
const cell = (value) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const hours = (minutes) => (minutes / 60).toFixed(1);

const HEADER = [
  "Employee ID",
  "Name",
  "Department",
  "Position",
  "Scheduled days",
  "Present",
  "Late",
  "Absent",
  "On leave",
  "Days worked",
  "Hours worked",
  "Days without check-out",
];

// The report as a CSV file's text: one row per person and a Total row. It starts with a byte order
// mark so Excel reads accented letters right, and uses Windows line endings.
const toCsv = (report) => {
  const lines = report.rows.map(({ employee, scheduledDays, counts, daysWorked, workedMinutes, openDays }) => [
    employee.employeeId,
    `${employee.firstName} ${employee.lastName}`.trim(),
    employee.department,
    employee.position,
    scheduledDays,
    counts.PRESENT,
    counts.LATE,
    counts.ABSENT,
    counts.ON_LEAVE,
    daysWorked,
    hours(workedMinutes),
    openDays,
  ]);

  const { totals } = report;
  lines.push([
    "",
    "Total",
    "",
    "",
    totals.scheduledDays,
    totals.counts.PRESENT,
    totals.counts.LATE,
    totals.counts.ABSENT,
    totals.counts.ON_LEAVE,
    totals.daysWorked,
    hours(totals.workedMinutes),
    totals.openDays,
  ]);

  return `﻿${[HEADER, ...lines].map((line) => line.map(cell).join(",")).join("\r\n")}\r\n`;
};

module.exports = { getMonthReport, toCsv };
