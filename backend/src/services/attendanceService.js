const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const managerService = require("./managerService");

// One shared shift for now. Times are the server's local wall-clock time.
const SHIFT = { name: "General", start: "09:00", end: "17:00" };
const GRACE_MINUTES = 5;

const employeeSelect = { id: true, employeeId: true, firstName: true, lastName: true, department: true, position: true, hireDate: true };

// ---------- Dates ----------

const pad = (n) => String(n).padStart(2, "0");

// "2026-10-05" for a Date, in the server's local time (what "today" means for the shift).
const localDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// DATE columns come back as UTC midnight.
const utcDateKey = (date) => date.toISOString().slice(0, 10);

const dateFromKey = (key) => new Date(`${key}T00:00:00Z`);

const isWeekend = (key) => {
  const day = dateFromKey(key).getUTCDay();
  return day === 0 || day === 6;
};

const addDays = (key, days) => {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date);
};

const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// ---------- Working out a day's record ----------

// The record the app shows for one employee on one day. Presence comes from a saved
// check-in; everything else (OFF, ON_LEAVE, NOT_IN, ABSENT) is worked out, so nobody
// counts as absent until their shift is over.
const buildRecord = ({ employee, dateKey, row, approvedLeave = [], now }) => {
  const base = {
    employeeId: employee.employeeId,
    date: dateKey,
    shift: SHIFT,
    checkIn: row?.checkIn ?? null,
    checkOut: row?.checkOut ?? null,
  };

  if (row) {
    const late = toMinutes(row.checkIn) > toMinutes(SHIFT.start) + GRACE_MINUTES;
    return { ...base, status: late ? "LATE" : "PRESENT" };
  }

  if (isWeekend(dateKey) || dateKey < utcDateKey(employee.hireDate)) return { ...base, status: "OFF" };

  const onLeave = approvedLeave.some(
    (leave) => leave.employeeId === employee.id && utcDateKey(leave.startDate) <= dateKey && dateKey <= utcDateKey(leave.endDate)
  );
  if (onLeave) return { ...base, status: "ON_LEAVE" };

  const today = localDateKey(now);
  if (dateKey > today) return { ...base, status: "NOT_IN" };
  if (dateKey === today && now.getHours() * 60 + now.getMinutes() < toMinutes(SHIFT.end)) {
    return { ...base, status: "NOT_IN" };
  }

  return { ...base, status: "ABSENT" };
};

const summarize = (records) => {
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, NOT_IN: 0, OFF: 0 };
  for (const record of records) counts[record.status] += 1;
  return counts;
};

const rowsFor = (employeeIds, from, to) =>
  prisma.attendance.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
  });

const approvedLeaveFor = (employeeIds, from, to) =>
  prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "APPROVED",
      startDate: { lte: dateFromKey(to) },
      endDate: { gte: dateFromKey(from) },
    },
  });

// Every given employee's record for one day.
const dayFor = async (employees, dateKey, now) => {
  const ids = employees.map((e) => e.id);
  const [rows, approvedLeave] = await Promise.all([rowsFor(ids, dateKey, dateKey), approvedLeaveFor(ids, dateKey, dateKey)]);
  const rowByEmployee = new Map(rows.map((row) => [row.employeeId, row]));

  const result = employees.map((employee) => ({
    employee: { id: employee.id, employeeId: employee.employeeId, firstName: employee.firstName, lastName: employee.lastName, department: employee.department, position: employee.position },
    record: buildRecord({ employee, dateKey, row: rowByEmployee.get(employee.id), approvedLeave, now }),
  }));

  return { date: dateKey, shift: SHIFT, rows: result, counts: summarize(result.map((r) => r.record)) };
};

// ---------- Manager (read) ----------

const getTeamDay = async (managerId, dateKey, now = new Date()) => {
  const team = await prisma.employee.findMany({
    where: { managerId },
    select: employeeSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return dayFor(team, dateKey, now);
};

// The last `days` days of an employee, newest first.
const getEmployeeDays = async (employee, days, now = new Date()) => {
  const today = localDateKey(now);
  const from = addDays(today, -(days - 1));
  const [rows, approvedLeave] = await Promise.all([rowsFor([employee.id], from, today), approvedLeaveFor([employee.id], from, today)]);
  const rowByDate = new Map(rows.map((row) => [utcDateKey(row.date), row]));

  return Array.from({ length: days }, (_, i) => {
    const dateKey = addDays(today, -i);
    return buildRecord({ employee, dateKey, row: rowByDate.get(dateKey), approvedLeave, now });
  });
};

// Same for one team member, or null if they aren't in the manager's team.
const getMemberDays = async (managerId, employeeId, days, now = new Date()) => {
  const member = await managerService.getTeamMember(managerId, employeeId);
  if (!member) return null;

  return getEmployeeDays(member, days, now);
};

// ---------- HR admin ----------

const getAllDay = async (dateKey, now = new Date()) => {
  const employees = await prisma.employee.findMany({
    where: { status: { not: "terminated" } },
    select: employeeSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return dayFor(employees, dateKey, now);
};

// Saves (or corrects) one employee's check-in and check-out for a day.
const recordDay = async ({ employeeId, date, checkIn, checkOut }, now = new Date()) => {
  if (date > localDateKey(now)) {
    throw new AppError("Attendance can't be recorded for a future date", 400);
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError("Employee not found", 404);

  if (date < utcDateKey(employee.hireDate)) {
    throw new AppError("Attendance can't be recorded before the hire date", 400);
  }

  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date: dateFromKey(date) } },
    create: { employeeId, date: dateFromKey(date), checkIn, checkOut: checkOut ?? null },
    update: { checkIn, checkOut: checkOut ?? null },
  });

  return buildRecord({
    employee,
    dateKey: date,
    row: { checkIn, checkOut: checkOut ?? null },
    now,
  });
};

const clearDay = async (employeeId, date) => {
  const { count } = await prisma.attendance.deleteMany({ where: { employeeId, date: dateFromKey(date) } });

  if (count === 0) throw new AppError("No attendance is recorded for that employee on that day", 404);
};

// ---------- Employee (themselves) ----------

// "08:52" in the server's local time. The server's clock is used, not the phone's, so the
// time can't be set by hand.
const timeKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const assertCanCheckIn = (employee) => {
  if (employee.status !== "active") {
    throw new AppError("Only active employees can check in", 403);
  }
};

// Today's record, with the check-in time set to now.
const checkInSelf = async (employee, now = new Date()) => {
  assertCanCheckIn(employee);

  const today = localDateKey(now);
  const checkIn = timeKey(now);

  try {
    await prisma.attendance.create({ data: { employeeId: employee.id, date: dateFromKey(today), checkIn } });
  } catch (error) {
    // The unique (employee, day) row already exists
    if (error.code === "P2002") throw new AppError("You have already checked in today", 409);
    throw error;
  }

  return buildRecord({ employee, dateKey: today, row: { checkIn, checkOut: null }, now });
};

// Sets today's check-out to now. It is never earlier than the check-in.
const checkOutSelf = async (employee, now = new Date()) => {
  assertCanCheckIn(employee);

  const today = localDateKey(now);
  const row = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: dateFromKey(today) } },
  });

  if (!row) throw new AppError("Check in first", 409);
  if (row.checkOut) throw new AppError("You have already checked out today", 409);

  const nowTime = timeKey(now);
  const checkOut = nowTime > row.checkIn ? nowTime : row.checkIn;

  // Only a still-open day changes, so two taps can't both win.
  const { count } = await prisma.attendance.updateMany({ where: { id: row.id, checkOut: null }, data: { checkOut } });
  if (count === 0) throw new AppError("You have already checked out today", 409);

  return buildRecord({ employee, dateKey: today, row: { checkIn: row.checkIn, checkOut }, now });
};

module.exports = {
  SHIFT,
  buildRecord,
  localDateKey,
  getTeamDay,
  getEmployeeDays,
  getMemberDays,
  getAllDay,
  recordDay,
  clearDay,
  checkInSelf,
  checkOutSelf,
};
