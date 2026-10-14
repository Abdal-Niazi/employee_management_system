const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const managerService = require("./managerService");
const { ENTITLEMENTS } = require("../utils/leavePolicy");
const { MAX_LEAVE_DAYS } = require("../validators/leaveSchema");

const dateFromKey = (key) => new Date(`${key}T00:00:00Z`);

// Monday to Friday days from start to end, both included (the same weekend rule as attendance).
const countWorkingDays = (startKey, endKey) => {
  let days = 0;
  const end = dateFromKey(endKey);

  for (const day = dateFromKey(startKey); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }

  return days;
};

// ---------- Profile ----------

const getProfile = async (employeeId) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { manager: { select: { id: true, employeeId: true, firstName: true, lastName: true, position: true } } },
  });

  return employee;
};

// ---------- Leave ----------

// A request counts towards the calendar year it starts in.
const yearRange = (year) => ({ gte: dateFromKey(`${year}-01-01`), lte: dateFromKey(`${year}-12-31`) });

// Days taken (approved) and days waiting for a decision (pending) per kind of leave in `year`,
// next to what the person is entitled to. Rejected and cancelled requests don't count.
const getBalance = async (employeeId, year) => {
  const rows = await prisma.leaveRequest.findMany({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, startDate: yearRange(year) },
    select: { type: true, status: true, days: true },
  });

  const balances = Object.entries(ENTITLEMENTS).map(([type, entitlement]) => {
    const sum = (status) => rows.filter((r) => r.type === type && r.status === status).reduce((n, r) => n + r.days, 0);
    const used = sum("APPROVED");
    const pending = sum("PENDING");

    return { type, entitlement, used, pending, remaining: Math.max(entitlement - used - pending, 0) };
  });

  return { year, balances };
};

const listLeave = async (employeeId) => {
  const rows = await prisma.leaveRequest.findMany({
    where: { employeeId },
    include: managerService.leaveInclude,
  });

  return rows.map(managerService.toLeaveDto).sort(managerService.compareLeave);
};

const requestLeave = async (employeeId, { type, startDate, endDate, reason }) => {
  const calendarDays = (dateFromKey(endDate) - dateFromKey(startDate)) / 86_400_000 + 1;
  if (calendarDays > MAX_LEAVE_DAYS) {
    throw new AppError(`A leave request can cover at most ${MAX_LEAVE_DAYS} days`, 400);
  }

  const days = countWorkingDays(startDate, endDate);
  if (days === 0) {
    throw new AppError("That range has no working days (only weekend days)", 400);
  }

  // Only as many days as are left this year (waiting requests are held back, so asking twice
  // can't get past the limit; cancelling one gives its days back).
  const year = Number(startDate.slice(0, 4));
  const { balances } = await getBalance(employeeId, year);
  const balance = balances.find((b) => b.type === type);
  if (days > balance.remaining) {
    throw new AppError(
      `You only have ${balance.remaining} ${type} leave day${balance.remaining === 1 ? "" : "s"} left for ${year}, and this request is for ${days}`,
      409
    );
  }

  // Two open requests for the same day would be confusing to approve.
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: dateFromKey(endDate) },
      endDate: { gte: dateFromKey(startDate) },
    },
  });
  if (overlapping) {
    throw new AppError("You already have a pending or approved leave request on those days", 409);
  }

  const created = await prisma.leaveRequest.create({
    data: { employeeId, type, startDate: dateFromKey(startDate), endDate: dateFromKey(endDate), days, reason: reason || null },
    include: managerService.leaveInclude,
  });

  return managerService.toLeaveDto(created);
};

// Only your own request, and only while it is still pending.
const cancelLeave = async (employeeId, id) => {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, employeeId } });
  if (!existing) throw new AppError("Leave request not found", 404);

  const { count } = await prisma.leaveRequest.deleteMany({ where: { id, employeeId, status: "PENDING" } });
  if (count === 0) throw new AppError("This request has already been decided and can't be cancelled", 409);
};

module.exports = { countWorkingDays, getProfile, getBalance, listLeave, requestLeave, cancelLeave };
