const prisma = require("../utils/prisma");
const { ENTITLEMENTS } = require("../utils/leavePolicy");

const dateFromKey = (key) => new Date(`${key}T00:00:00Z`);

// A request counts towards the calendar year it starts in.
const yearRange = (year) => ({ gte: dateFromKey(`${year}-01-01`), lte: dateFromKey(`${year}-12-31`) });

// DATE columns are read back as UTC midnight.
const yearOf = (date) => date.getUTCFullYear();

// Per kind of leave: what the person is entitled to, the days taken (approved) and the days waiting
// for a decision (pending). `rows` are one person's PENDING and APPROVED requests for one year.
// Waiting days are held back from `remaining`, so asking twice can't get past the limit.
const summarize = (rows) =>
  Object.entries(ENTITLEMENTS).map(([type, entitlement]) => {
    const sum = (status) => rows.filter((r) => r.type === type && r.status === status).reduce((n, r) => n + r.days, 0);
    const used = sum("APPROVED");
    const pending = sum("PENDING");

    return { type, entitlement, used, pending, remaining: Math.max(entitlement - used - pending, 0) };
  });

// One person's balance in `year`. Rejected and cancelled requests don't count. `db` is a
// transaction when the balance is checked before saving a request.
const getBalance = async (employeeId, year, db = prisma) => {
  const rows = await db.leaveRequest.findMany({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, startDate: yearRange(year) },
    select: { type: true, status: true, days: true },
  });

  return { year, balances: summarize(rows) };
};

// For the people deciding: the balance each PENDING request is measured against (its kind of leave,
// in the year it starts in), as a Map from the request's id. The waiting request's own days are
// already held back from `remaining`, so that is what is left if it is approved. One query for all.
const forPending = async (requests) => {
  const pending = requests.filter((r) => r.status === "PENDING");
  const balances = new Map();
  if (pending.length === 0) return balances;

  const pairs = new Map(pending.map((r) => [`${r.employeeId}:${yearOf(r.startDate)}`, { employeeId: r.employeeId, year: yearOf(r.startDate) }]));
  const rows = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      OR: [...pairs.values()].map(({ employeeId, year }) => ({ employeeId, startDate: yearRange(year) })),
    },
    select: { employeeId: true, type: true, status: true, days: true, startDate: true },
  });

  for (const request of pending) {
    const year = yearOf(request.startDate);
    const mine = rows.filter((r) => r.employeeId === request.employeeId && yearOf(r.startDate) === year);
    balances.set(request.id, { year, ...summarize(mine).find((b) => b.type === request.type) });
  }

  return balances;
};

module.exports = { summarize, getBalance, forPending };
