const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const serializable = require("../utils/serializable");
const managerService = require("./managerService");
const {
  addDays,
  asDbDate,
  fromCompanyTime,
  isWeekend,
  nowMinutes,
  toCompanyTime,
  toDateKey,
  toMinutes,
  todayKey,
} = require("../utils/companyTime");
const { SHIFT, CORRECTION_WINDOW_DAYS, STATUSES, attendanceStatus } = require("../utils/attendanceRules");

// ---------- Shared helpers ----------

const time = (instant) => (instant ? toCompanyTime(instant) : null);
const times = (checkIn, checkOut) => ({ checkIn: time(checkIn), checkOut: time(checkOut) });
const fullName = (person) => (person ? `${person.firstName} ${person.lastName}`.trim() : null);

// Who a correction is for, saved with it so the history still says so if the employee is deleted.
const whoFor = (employee) => ({ employeeId: employee.id, employeeCode: employee.employeeId, employeeName: fullName(employee) });

// The first day a manager can still ask HR to correct.
const windowStart = (now) => addDays(todayKey(now), -(CORRECTION_WINDOW_DAYS - 1));

const coversDay = (leave, dateKey) => toDateKey(leave.startDate) <= dateKey && dateKey <= toDateKey(leave.endDate);

// Only the fields the attendance screens show (`photoUpdatedAt` lets the list show the photo).
const toEmployeeDto = ({ id, employeeId, firstName, lastName, department, position, photoUpdatedAt }) => ({
  id,
  employeeId,
  firstName,
  lastName,
  department,
  position,
  photoUpdatedAt,
});

// A waiting correction matters most, then the latest approved one. `corrections` is newest first.
const pickCorrection = (corrections) =>
  corrections.find((c) => c.status === "PENDING") ?? corrections.find((c) => c.status === "APPROVED") ?? null;

// One person's day as the app shows it.
const toRecord = ({ employee, dateKey, row, onLeave, corrections, now }) => {
  const active = employee.status === "active";
  const hireDateKey = toDateKey(employee.hireDate);
  const status = attendanceStatus({ dateKey, hireDateKey, onLeave, record: row, active, now });
  const correction = pickCorrection(corrections);
  // A day that can be changed: from the hire date on, and not a day of approved leave unless a
  // check-in was saved anyway (for example the leave was approved afterwards). Weekends count.
  const open = dateKey >= hireDateKey && (!onLeave || Boolean(row));

  return {
    date: dateKey,
    status,
    ...times(row?.checkIn, row?.checkOut),
    correction: correction && { id: correction.id, status: correction.status },
    // Whether the manager may ask HR to fix this day now (never for someone who isn't active)
    correctable:
      active && open && dateKey >= windowStart(now) && dateKey <= todayKey(now) && correction?.status !== "PENDING",
    // Whether HR may write this day (HR also handles people who aren't active)
    editable: open,
  };
};

const countStatuses = (records) =>
  Object.fromEntries(STATUSES.map((status) => [status, records.filter((r) => r.status === status).length]));

const approvedLeaveOn = (date) => ({ status: "APPROVED", startDate: { lte: date }, endDate: { gte: date } });
const VISIBLE_CORRECTIONS = { status: { in: ["PENDING", "APPROVED"] } };

// A day of approved leave can't be given a check-in (one saved before the leave was approved can
// still be fixed, so callers only ask this when the day has none). `db` is a transaction.
const refuseLeaveDay = async (db, employeeId, date) => {
  if (await db.leaveRequest.findFirst({ where: { employeeId, ...approvedLeaveOn(date) } })) {
    throw new AppError("This employee is on approved leave that day", 409);
  }
};

// ---------- Viewing a day (managers and HR admins) ----------

// The records of everyone `loadPeople` returns for one day. `scope` limits the queries to
// those people (a manager's team), and `view` shapes each record for the screen asking.
const dayFor = async ({ loadPeople, scope, view }, dateKey, now) => {
  const today = todayKey(now);

  if (dateKey > today) {
    throw new AppError("date can't be in the future", 400);
  }

  const date = asDbDate(dateKey);

  const [people, rows, leave, corrections] = await Promise.all([
    loadPeople(),
    prisma.attendance.findMany({ where: { date, ...scope } }),
    prisma.leaveRequest.findMany({ where: { ...approvedLeaveOn(date), ...scope } }),
    prisma.attendanceCorrection.findMany({
      where: { date, ...VISIBLE_CORRECTIONS, ...scope },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Looked up by person, so a day costs one pass over each list, not one per person.
  const rowBy = new Map(rows.map((r) => [r.employeeId, r]));
  const onLeave = new Set(leave.map((l) => l.employeeId));
  const correctionsBy = new Map();
  for (const c of corrections) {
    // Still newest first, as they were read
    if (!correctionsBy.has(c.employeeId)) correctionsBy.set(c.employeeId, []);
    correctionsBy.get(c.employeeId).push(c);
  }

  const results = people.map((employee) => ({
    employee: toEmployeeDto(employee),
    record: view(
      toRecord({
        employee,
        dateKey,
        row: rowBy.get(employee.id) ?? null,
        onLeave: onLeave.has(employee.id),
        corrections: correctionsBy.get(employee.id) ?? [],
        now,
      })
    ),
  }));

  return {
    date: dateKey,
    // The company's own day, so the app never has to trust the phone's timezone.
    today,
    workday: !isWeekend(dateKey),
    shift: SHIFT,
    rows: results,
    counts: countStatuses(results.map((r) => r.record)),
  };
};

// Every team member's record for one day.
const getTeamDay = (managerId, dateKey, now = new Date()) =>
  dayFor(
    { loadPeople: () => managerService.getTeam(managerId), scope: { employee: { managerId } }, view: managerRecord },
    dateKey,
    now
  );

// The views of a record: a manager sees whether they may ask HR to correct it, HR whether it may
// write it, and the person themselves neither.
const managerRecord = ({ editable, ...record }) => record;
const ownRecord = ({ correctable, editable, ...record }) => record;
const hrRecord = ({ correctable, ...record }) => record;

// One person's last `days` days, newest first. Used by the manager's member page and by
// the person's own history.
const historyFor = async (employee, days, now) => {
  const employeeId = employee.id;
  const today = todayKey(now);
  const from = addDays(today, -(days - 1));
  const range = { gte: asDbDate(from), lte: asDbDate(today) };

  const [rows, leave, corrections] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId, date: range } }),
    prisma.leaveRequest.findMany({
      where: { employeeId, status: "APPROVED", startDate: { lte: range.lte }, endDate: { gte: range.gte } },
    }),
    prisma.attendanceCorrection.findMany({
      where: { employeeId, date: range, ...VISIBLE_CORRECTIONS },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const records = Array.from({ length: days }, (_, i) => {
    const dateKey = addDays(today, -i);
    return toRecord({
      employee,
      dateKey,
      row: rows.find((r) => toDateKey(r.date) === dateKey) ?? null,
      onLeave: leave.some((l) => coversDay(l, dateKey)),
      corrections: corrections.filter((c) => toDateKey(c.date) === dateKey),
      now,
    });
  });

  return { today, records };
};

// One team member's last `days` days, newest first, or null if they aren't in the team.
const getMemberHistory = async (managerId, employeeId, days, now = new Date()) => {
  const employee = await managerService.getTeamMember(managerId, employeeId);
  if (!employee) return null;

  const { today, records } = await historyFor(employee, days, now);
  return { employee: toEmployeeDto(employee), today, shift: SHIFT, records: records.map(managerRecord) };
};

// ---------- An employee's own attendance (employees and managers) ----------


// Why `employee` can't check in on `dateKey`, or null if they can. The card shows the same
// message, so the app and the API never disagree.
// Weekends have no shift, but someone who works one checks in as usual.
const checkInBlock = (employee, dateKey, onLeave) => {
  const firstDay = toDateKey(employee.hireDate);
  if (dateKey < firstDay) return new AppError(`You can check in from your first day, ${firstDay}`, 400);

  if (employee.status !== "active") {
    return new AppError("Your employee record isn't active, so you can't check in. Please contact HR.", 403);
  }
  if (onLeave) return new AppError("You're on approved leave today", 409);

  return null;
};

const findApprovedLeave = (employee, date) =>
  prisma.leaveRequest.findFirst({ where: { employeeId: employee.id, ...approvedLeaveOn(date) } });

const findOwnRow = (employee, date) =>
  prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: employee.id, date } } });

// Today for the check-in card: the record, and whether the person may check in or out now.
const getMyDay = async (employee, now = new Date()) => {
  const today = todayKey(now);
  const date = asDbDate(today);

  const [row, leave, corrections] = await Promise.all([
    findOwnRow(employee, date),
    findApprovedLeave(employee, date),
    prisma.attendanceCorrection.findMany({
      where: { employeeId: employee.id, date, ...VISIBLE_CORRECTIONS },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const onLeave = Boolean(leave);
  const block = row ? null : checkInBlock(employee, today, onLeave);

  return {
    today,
    workday: !isWeekend(today),
    shift: SHIFT,
    record: ownRecord(toRecord({ employee, dateKey: today, row, onLeave, corrections, now })),
    canCheckIn: !row && !block,
    canCheckOut: Boolean(row) && !row.checkOut,
    notice: block?.message ?? null,
  };
};

// Starts today's record with the server's clock; the phone's clock is never trusted.
const checkIn = async (employee, now = new Date()) => {
  const today = todayKey(now);
  const date = asDbDate(today);

  const block = checkInBlock(employee, today, Boolean(await findApprovedLeave(employee, date)));
  if (block) throw block;

  try {
    await prisma.attendance.create({ data: { employeeId: employee.id, date, checkIn: now } });
  } catch (error) {
    // One row per person per day (a unique key), so a second check-in fails here, even two at once.
    if (error.code === "P2002") throw new AppError("You've already checked in today", 409);
    throw error;
  }

  return getMyDay(employee, now);
};

// Ends today's record. A check-out can't be undone here; a wrong one is fixed through a correction.
const checkOut = async (employee, now = new Date()) => {
  const date = asDbDate(todayKey(now));

  // Only a row without a check-out changes, checked in the same statement, so two taps can't both win.
  const { count } = await prisma.attendance.updateMany({
    where: { employeeId: employee.id, date, checkOut: null },
    data: { checkOut: now },
  });

  if (count === 0) {
    const row = await findOwnRow(employee, date);
    throw new AppError(row ? "You've already checked out today" : "You haven't checked in today", 409);
  }

  return getMyDay(employee, now);
};

// The person's own last `days` days, newest first.
const getMyHistory = async (employee, days, now = new Date()) => {
  const { today, records } = await historyFor(employee, days, now);
  return { today, shift: SHIFT, records: records.map(ownRecord) };
};

// ---------- HR admins: everyone's day, changed directly ----------

// What the history says when HR leaves no note
const HR_REASON = "Changed by HR";
const HR_REMOVED_REASON = "Check-in removed by HR";


// Everyone's record for one day, except people who left (status "terminated").
const getAllDay = (dateKey, now = new Date()) =>
  dayFor(
    {
      loadPeople: () =>
        prisma.employee.findMany({
          where: { status: { not: "terminated" } },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
      scope: {},
      view: hrRecord,
    },
    dateKey,
    now
  );

// One person's record for one day, as HR sees it.
const hrRecordFor = async (employee, dateKey, now) => {
  const date = asDbDate(dateKey);
  const [row, leave, corrections] = await Promise.all([
    findOwnRow(employee, date),
    findApprovedLeave(employee, date),
    prisma.attendanceCorrection.findMany({
      where: { employeeId: employee.id, date, ...VISIBLE_CORRECTIONS },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return hrRecord(toRecord({ employee, dateKey, row, onLeave: Boolean(leave), corrections, now }));
};

const findEmployee = async (id) => {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new AppError("Employee not found", 404);
  return employee;
};

// The change HR made, saved like an approved correction (with the times before it) so it can be
// traced, and shown as "Corrected by HR" like one. `fixed` null means the check-in was removed.
const saveHrChange = (tx, adminId, { employee, date, current, fixed, note }) =>
  tx.attendanceCorrection.create({
    data: {
      ...whoFor(employee),
      date,
      checkIn: fixed?.checkIn ?? null,
      checkOut: fixed?.checkOut ?? null,
      reason: note || (fixed ? HR_REASON : HR_REMOVED_REASON),
      status: "APPROVED",
      source: "HR",
      decidedById: adminId,
      decidedAt: new Date(),
      previousCheckIn: current?.checkIn ?? null,
      previousCheckOut: current?.checkOut ?? null,
    },
  });

// An HR admin writes or fixes one person's check-in and check-out ("HH:MM", company time).
// Unlike a manager's request, an empty check-out means none.
const recordDay = async (adminId, { employeeId, date: dateKey, checkIn, checkOut, note }, now = new Date()) => {
  const employee = await findEmployee(employeeId);

  if (dateKey > todayKey(now)) {
    throw new AppError("Attendance can't be recorded for a day that hasn't happened yet", 400);
  }
  if (dateKey < toDateKey(employee.hireDate)) {
    throw new AppError("This day is before the employee was hired", 400);
  }
  if (dateKey === todayKey(now) && toMinutes(checkOut ?? checkIn) > nowMinutes(now)) {
    throw new AppError("Times can't be later than now", 400);
  }

  const date = asDbDate(dateKey);
  const fixed = {
    checkIn: fromCompanyTime(dateKey, checkIn),
    checkOut: checkOut ? fromCompanyTime(dateKey, checkOut) : null,
  };

  // Serializable, so the saved "before" times are the ones this change really replaced.
  await serializable(async (tx) => {
    const day = { employeeId_date: { employeeId, date } };
    const current = await tx.attendance.findUnique({ where: day });

    // A day of approved leave stays off, unless a check-in was saved anyway (leave approved
    // after the person checked in): then HR can still fix it.
    if (!current) await refuseLeaveDay(tx, employeeId, date);

    await saveHrChange(tx, adminId, { employee, date, current, fixed, note });
    await tx.attendance.upsert({ where: day, create: { employeeId, date, ...fixed }, update: fixed });
  });

  return hrRecordFor(employee, dateKey, now);
};

// An HR admin removes one person's check-in for a day (e.g. made by mistake). Kept in the history.
const clearDay = async (adminId, { employeeId, date: dateKey, note }, now = new Date()) => {
  const employee = await findEmployee(employeeId);
  const date = asDbDate(dateKey);

  await serializable(async (tx) => {
    const day = { employeeId_date: { employeeId, date } };
    const current = await tx.attendance.findUnique({ where: day });
    if (!current) throw new AppError("No check-in is recorded for that day", 404);

    await saveHrChange(tx, adminId, { employee, date, current, fixed: null, note });
    await tx.attendance.delete({ where: day });
  });

  return hrRecordFor(employee, dateKey, now);
};

// ---------- Correction requests ----------

// Requests come from managers; HR's own changes are kept in the same table but aren't requests.
const REQUESTS = { source: "MANAGER" };

const correctionInclude = {
  employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, department: true } },
  requestedBy: { select: { firstName: true, lastName: true } },
  decidedBy: { select: { name: true } },
};

// `current` is the person's Attendance row for that day right now (or null).
const toCorrectionDto = (row, current) => {
  // Once approved, the record already shows the new times, so "before" is what it said then.
  let before = null;
  if (row.status === "APPROVED") {
    if (row.previousCheckIn) before = times(row.previousCheckIn, row.previousCheckOut);
  } else if (current) {
    before = times(current.checkIn, current.checkOut);
  }

  return {
    id: row.id,
    // From the saved copy when the employee has been deleted since
    employeeId: row.employee?.employeeId ?? row.employeeCode,
    employeeDbId: row.employee?.id ?? null,
    employeeName: row.employee ? fullName(row.employee) : row.employeeName,
    department: row.employee?.department ?? null,
    date: toDateKey(row.date),
    requested: times(row.checkIn, row.checkOut),
    before,
    reason: row.reason,
    status: row.status,
    requestedBy: fullName(row.requestedBy),
    requestedAt: row.createdAt.toISOString(),
    decidedBy: row.decidedBy?.name ?? null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decisionNote: row.decisionNote,
  };
};

// Pending first (oldest day first, like a queue), then decided (most recent decision first).
const compareCorrections = (a, b) => {
  const aPending = a.status === "PENDING";
  const bPending = b.status === "PENDING";
  if (aPending !== bPending) return aPending ? -1 : 1;
  if (aPending) return a.date.localeCompare(b.date) || a.id - b.id;
  return (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "");
};

const listCorrections = async (where) => {
  const rows = await prisma.attendanceCorrection.findMany({ where, include: correctionInclude });
  if (rows.length === 0) return [];

  // The current record of each requested day, to show what would change: one query by the
  // people and days involved (matched up below), not one condition per request.
  const unique = (values) => [...new Set(values)];
  const current = await prisma.attendance.findMany({
    where: {
      employeeId: { in: unique(rows.map((r) => r.employeeId)) },
      date: { in: unique(rows.map((r) => r.date.getTime())).map((t) => new Date(t)) },
    },
  });
  const currentFor = (row) =>
    current.find((r) => r.employeeId === row.employeeId && r.date.getTime() === row.date.getTime()) ?? null;

  return rows.map((row) => toCorrectionDto(row, currentFor(row))).sort(compareCorrections);
};

// A manager's view: only their team's requests.
const listTeamCorrections = (managerId, status) =>
  listCorrections({ ...REQUESTS, employee: { managerId }, ...(status && { status }) });

// HR's view: every request about someone who is still an employee. Those of deleted employees stay
// in the table as history but aren't anything to act on.
const listAllCorrections = (status) => listCorrections({ ...REQUESTS, employeeId: { not: null }, ...(status && { status }) });

const getCorrection = async (id) => {
  const row = await prisma.attendanceCorrection.findUnique({ where: { id }, include: correctionInclude });
  const current = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: row.employeeId, date: row.date } },
  });
  return toCorrectionDto(row, current);
};

// A manager asks HR to fix one team member's day.
const requestCorrection = async (managerId, { employeeId, date: dateKey, checkIn, checkOut, reason }, now = new Date()) => {
  const employee = await managerService.getTeamMember(managerId, employeeId);
  if (!employee) {
    throw new AppError("Team member not found", 404);
  }
  if (employee.status !== "active") {
    throw new AppError("This employee isn't active, so HR handles their attendance directly", 409);
  }

  const today = todayKey(now);
  if (dateKey > today) {
    throw new AppError("You can't correct a day that hasn't happened yet", 400);
  }
  if (dateKey < windowStart(now)) {
    throw new AppError(`Corrections can only be requested for the last ${CORRECTION_WINDOW_DAYS} days`, 400);
  }
  if (dateKey < toDateKey(employee.hireDate)) {
    throw new AppError("This day is before the employee was hired", 400);
  }
  if (dateKey === today && toMinutes(checkOut ?? checkIn) > nowMinutes(now)) {
    throw new AppError("Times can't be later than now", 400);
  }

  const date = asDbDate(dateKey);

  // Checked and created in one Serializable transaction, so two requests sent at once can't
  // both pass the "already waiting" check.
  const created = await serializable(async (tx) => {
    const current = await tx.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (!current) await refuseLeaveDay(tx, employeeId, date);

    const waiting = await tx.attendanceCorrection.findFirst({ where: { employeeId, date, status: "PENDING" } });
    if (waiting) {
      throw new AppError("A correction for this day is already waiting for HR", 409);
    }

    return tx.attendanceCorrection.create({
      data: {
        ...whoFor(employee),
        date,
        checkIn: fromCompanyTime(dateKey, checkIn),
        checkOut: checkOut ? fromCompanyTime(dateKey, checkOut) : null,
        reason,
        requestedById: managerId,
      },
    });
  });

  return getCorrection(created.id);
};

// An HR admin approves or rejects a request. Only approving changes the attendance record, and
// only if the day can still be changed: things may have moved on since the manager asked.
const decideCorrection = async (adminId, id, { status, note }) => {
  await serializable(async (tx) => {
    // Only a still-pending request changes, checked in the same statement as the update,
    // so two decisions can't both win.
    const { count } = await tx.attendanceCorrection.updateMany({
      where: { id, status: "PENDING" },
      data: { status, decidedAt: new Date(), decidedById: adminId, decisionNote: note || null },
    });

    if (count === 0) {
      const exists = await tx.attendanceCorrection.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new AppError("Correction not found", 404);
      throw new AppError("This correction has already been decided", 409);
    }

    if (status !== "APPROVED") return;

    const correction = await tx.attendanceCorrection.findUnique({ where: { id } });
    const day = { employeeId_date: { employeeId: correction.employeeId, date: correction.date } };
    const current = await tx.attendance.findUnique({ where: day });

    const employee = await tx.employee.findUnique({ where: { id: correction.employeeId }, select: { status: true } });
    if (employee.status !== "active") {
      throw new AppError("This employee isn't active any more. Reject the request, or change the day directly.", 409);
    }
    if (!current) await refuseLeaveDay(tx, correction.employeeId, correction.date);

    // Keep what the record said, so the change can be traced later.
    await tx.attendanceCorrection.update({
      where: { id },
      data: { previousCheckIn: current?.checkIn ?? null, previousCheckOut: current?.checkOut ?? null },
    });

    // No check-out in the request keeps the recorded one, if it is still after the new check-in.
    const keptCheckOut = current?.checkOut > correction.checkIn ? current.checkOut : null;
    const fixed = { checkIn: correction.checkIn, checkOut: correction.checkOut ?? keptCheckOut };

    await tx.attendance.upsert({
      where: day,
      create: { employeeId: correction.employeeId, date: correction.date, ...fixed },
      update: fixed,
    });
  });

  return getCorrection(id);
};

module.exports = {
  getTeamDay,
  getMemberHistory,
  getMyDay,
  checkIn,
  checkOut,
  getMyHistory,
  getAllDay,
  recordDay,
  clearDay,
  listTeamCorrections,
  listAllCorrections,
  requestCorrection,
  decideCorrection,
};
