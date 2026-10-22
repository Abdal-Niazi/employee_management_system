const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const leaveBalance = require("./leaveBalanceService");
const serializable = require("../utils/serializable");
const managerService = require("./managerService");
const { addDays, asDbDate, isWeekend, todayKey } = require("../utils/companyTime");
const { MAX_LEAVE_DAYS } = require("../validators/leaveSchema");

// Monday to Friday days from start to end, both included (the same weekend rule as attendance).
const countWorkingDays = (startKey, endKey) => {
  let days = 0;

  for (let key = startKey; key <= endKey; key = addDays(key, 1)) {
    if (!isWeekend(key)) days += 1;
  }

  return days;
};

// ---------- Profile ----------

const getProfile = async (employeeId) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      manager: { select: { id: true, employeeId: true, firstName: true, lastName: true, position: true, photoUpdatedAt: true } },
    },
  });

  return employee;
};

// ---------- Leave ----------

const { getBalance } = leaveBalance;

// The person's requests, plus the company's today so the app can start the form there.
const listLeave = async (employeeId, now = new Date()) => {
  const rows = await prisma.leaveRequest.findMany({
    where: { employeeId },
    include: managerService.leaveInclude,
  });

  return { today: todayKey(now), leaveRequests: rows.map(managerService.toLeaveDto).sort(managerService.compareLeave) };
};

const requestLeave = async (employeeId, { type, startDate, endDate, reason }) => {
  const calendarDays = (asDbDate(endDate) - asDbDate(startDate)) / 86_400_000 + 1;
  if (calendarDays > MAX_LEAVE_DAYS) {
    throw new AppError(`A leave request can cover at most ${MAX_LEAVE_DAYS} days`, 400);
  }

  const days = countWorkingDays(startDate, endDate);
  if (days === 0) {
    throw new AppError("That range has no working days (only weekend days)", 400);
  }

  // Checked and created in one Serializable transaction, so two requests sent at the same
  // moment (a double tap) can't both pass the balance or overlap check.
  const created = await serializable(async (tx) => {
    // Only as many days as are left this year (waiting requests are held back, so asking twice
    // can't get past the limit; cancelling one gives its days back).
    const year = Number(startDate.slice(0, 4));
    const { balances } = await getBalance(employeeId, year, tx);
    const balance = balances.find((b) => b.type === type);
    if (days > balance.remaining) {
      throw new AppError(
        `You only have ${balance.remaining} ${type} leave day${balance.remaining === 1 ? "" : "s"} left for ${year}, and this request is for ${days}`,
        409
      );
    }

    // Two open requests for the same day would be confusing to approve.
    const overlapping = await tx.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: asDbDate(endDate) },
        endDate: { gte: asDbDate(startDate) },
      },
    });
    if (overlapping) {
      throw new AppError("You already have a pending or approved leave request on those days", 409);
    }

    // Without `include`: Prisma would load the relations with parallel queries on the
    // transaction's one connection, which the pg driver warns about (and pg 9 refuses).
    return tx.leaveRequest.create({
      data: { employeeId, type, startDate: asDbDate(startDate), endDate: asDbDate(endDate), days, reason: reason || null },
    });
  });

  const saved = await prisma.leaveRequest.findUnique({ where: { id: created.id }, include: managerService.leaveInclude });
  return managerService.toLeaveDto(saved);
};

// Only your own request, and only while it is still pending.
const cancelLeave = async (employeeId, id) => {
  const existing = await prisma.leaveRequest.findFirst({ where: { id, employeeId } });
  if (!existing) throw new AppError("Leave request not found", 404);

  const { count } = await prisma.leaveRequest.deleteMany({ where: { id, employeeId, status: "PENDING" } });
  if (count === 0) throw new AppError("This request has already been decided and can't be cancelled", 409);
};

module.exports = { countWorkingDays, getProfile, getBalance, listLeave, requestLeave, cancelLeave };
