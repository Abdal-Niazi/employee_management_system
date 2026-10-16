const prisma = require("../utils/prisma");
const { CARRY_OVER, ENTITLEMENTS } = require("../utils/leavePolicy");

const dateFromKey = (key) => new Date(`${key}T00:00:00Z`);

// A request counts towards the calendar year it starts in.
const dateRange = (fromYear, toYear) => ({ gte: dateFromKey(`${fromYear}-01-01`), lte: dateFromKey(`${toYear}-12-31`) });

// DATE columns are read back as UTC midnight.
const yearOf = (date) => date.getUTCFullYear();

// The first year whose requests matter for the balance of `year`: that year itself, or an earlier
// one when days can be carried into it. Nothing carries into the year a person was hired, or into
// a year before the first one that gets carried days.
const firstYearNeeded = (year, hireYear) =>
  CARRY_OVER.days === 0 ? year : Math.min(year, Math.max(hireYear, CARRY_OVER.firstYear - 1));

// Days of annual leave carried into `year`: each earlier year leaves behind what was not taken,
// at most CARRY_OVER.days, and that adds to the next year's allowance. Days waiting for a decision
// count as taken. `rows` are one person's PENDING and APPROVED requests, covering the earlier years.
const carriedInto = (year, hireYear, rows) => {
  const { type, days: cap } = CARRY_OVER;
  if (cap === 0) return 0;

  const taken = new Map();
  for (const row of rows) {
    if (row.type === type) taken.set(yearOf(row.startDate), (taken.get(yearOf(row.startDate)) ?? 0) + row.days);
  }

  let carried = 0;
  for (let y = firstYearNeeded(year, hireYear); y < year; y++) {
    carried = Math.min(cap, Math.max(ENTITLEMENTS[type] + carried - (taken.get(y) ?? 0), 0));
  }

  return carried;
};

// Per kind of leave: what the person is entitled to, the days carried over from earlier years, the
// days taken (approved) and the days waiting for a decision (pending), in `year`. Waiting days are
// held back from `remaining`, so asking twice can't get past the limit.
const summarize = (rows, year, hireYear) => {
  const inYear = rows.filter((r) => yearOf(r.startDate) === year);
  const carried = carriedInto(year, hireYear, rows);

  return Object.entries(ENTITLEMENTS).map(([type, entitlement]) => {
    const sum = (status) => inYear.filter((r) => r.type === type && r.status === status).reduce((n, r) => n + r.days, 0);
    const used = sum("APPROVED");
    const pending = sum("PENDING");
    const carriedOver = type === CARRY_OVER.type ? carried : 0;

    return { type, entitlement, carriedOver, used, pending, remaining: Math.max(entitlement + carriedOver - used - pending, 0) };
  });
};

// One person's balance in `year`. Rejected and cancelled requests don't count. `db` is a
// transaction when the balance is checked before saving a request.
const getBalance = async (employeeId, year, db = prisma) => {
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { hireDate: true } });
  const hireYear = employee ? yearOf(employee.hireDate) : year;

  const rows = await db.leaveRequest.findMany({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: dateRange(firstYearNeeded(year, hireYear), year),
    },
    select: { type: true, status: true, days: true, startDate: true },
  });

  return { year, balances: summarize(rows, year, hireYear) };
};

// For the people deciding: the balance each PENDING request is measured against (its kind of leave,
// in the year it starts in), as a Map from the request's id. The waiting request's own days are
// already held back from `remaining`, so that is what is left if it is approved. One query each for
// the people and for their requests.
const forPending = async (requests) => {
  const pending = requests.filter((r) => r.status === "PENDING");
  const balances = new Map();
  if (pending.length === 0) return balances;

  const employeeIds = [...new Set(pending.map((r) => r.employeeId))];
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, hireDate: true },
  });
  const hireYears = new Map(employees.map((e) => [e.id, yearOf(e.hireDate)]));

  // Per person, the years from the earliest one that matters to the latest waiting request
  const spans = employeeIds.map((employeeId) => {
    const years = pending.filter((r) => r.employeeId === employeeId).map((r) => yearOf(r.startDate));
    const hireYear = hireYears.get(employeeId) ?? Math.min(...years);
    return { employeeId, hireYear, from: firstYearNeeded(Math.min(...years), hireYear), to: Math.max(...years) };
  });

  const rows = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      OR: spans.map(({ employeeId, from, to }) => ({ employeeId, startDate: dateRange(from, to) })),
    },
    select: { employeeId: true, type: true, status: true, days: true, startDate: true },
  });

  for (const request of pending) {
    const { hireYear } = spans.find((s) => s.employeeId === request.employeeId);
    const year = yearOf(request.startDate);
    const mine = rows.filter((r) => r.employeeId === request.employeeId);
    balances.set(request.id, { year, ...summarize(mine, year, hireYear).find((b) => b.type === request.type) });
  }

  return balances;
};

module.exports = { summarize, getBalance, forPending };
