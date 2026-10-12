// Fills the database with sample leave requests for local development.
// Run from backend: npm run seed. Employees who already have leave requests are skipped,
// so it is safe to run again after adding employees.
require("dotenv").config({ quiet: true });

const prisma = require("../src/utils/prisma");

const LEAVE_TYPES = ["Annual", "Sick", "Casual"];
const REASONS = {
  Annual: ["Family trip", "Visiting relatives", "Wedding in the family"],
  Sick: ["Fever and flu", "Medical appointment", "Recovering from a minor procedure"],
  Casual: ["Personal errand", "Moving house", "Bank and paperwork"],
};

// Deterministic hash (FNV-1a plus a murmur3 finalizer), so a person always gets
// the same sample requests.
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Days are handled as local "YYYY-MM-DD" keys.
const pad = (n) => String(n).padStart(2, "0");
const toKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (key, days) => {
  const date = fromKey(key);
  date.setDate(date.getDate() + days);
  return toKey(date);
};
const isWeekend = (key) => [0, 6].includes(fromKey(key).getDay());
const nextWeekday = (key) => {
  let day = key;
  while (isWeekend(day)) day = addDays(day, 1);
  return day;
};
// Last day of a leave that covers `days` working days starting on `start`.
const endAfterWorkingDays = (start, days) => {
  let end = start;
  for (let left = days - 1; left > 0; left--) end = nextWeekday(addDays(end, 1));
  return end;
};
// DATE columns hold the calendar day as UTC midnight.
const asDate = (key) => new Date(`${key}T00:00:00.000Z`);

function makeRequest(employee, n, { startOffset, days, status, requestedOffset }) {
  const h = hash(`${employee.employeeId}#${n}`);
  const type = LEAVE_TYPES[h % LEAVE_TYPES.length];
  const today = toKey(new Date());
  const hired = employee.hireDate.toISOString().slice(0, 10);
  const startDate = nextWeekday(addDays(today, startOffset));
  const requested = addDays(today, requestedOffset);
  const requestedKey = requested < hired ? hired : requested;

  return {
    employeeId: employee.id,
    type,
    startDate: asDate(startDate),
    endDate: asDate(endAfterWorkingDays(startDate, days)),
    days,
    reason: REASONS[type][h % REASONS[type].length],
    status,
    createdAt: fromKey(requestedKey),
    decidedAt: status === "PENDING" ? null : fromKey(addDays(requestedKey, 1)),
    decidedById: status === "PENDING" ? null : employee.managerId,
    decisionNote: status === "REJECTED" ? "Overlaps with a release week" : null,
  };
}

function sampleLeave(employee) {
  const h = hash(employee.employeeId);
  const today = toKey(new Date());
  const hired = employee.hireDate.toISOString().slice(0, 10);

  // An upcoming request waiting for the manager.
  const rows = [
    makeRequest(employee, 1, {
      startOffset: 3 + (h % 10),
      days: 1 + (h % 3),
      status: "PENDING",
      requestedOffset: -1 - (h % 3),
    }),
  ];

  // A past, already-decided request, only if the employee was hired by then.
  const pastRequestedOffset = -40 - (h % 10);
  if (addDays(today, pastRequestedOffset) >= hired) {
    rows.push(
      makeRequest(employee, 2, {
        startOffset: -25 - (h % 20),
        days: 1 + ((h >>> 4) % 2),
        status: (h >>> 1) % 2 === 0 ? "APPROVED" : "REJECTED",
        requestedOffset: pastRequestedOffset,
      })
    );
  }

  // About half the team also asks for the next working day.
  if ((h >>> 2) % 2 === 0) {
    rows.push(makeRequest(employee, 3, { startOffset: 1, days: 1, status: "PENDING", requestedOffset: 0 }));
  }

  return rows;
}

const main = async () => {
  const total = await prisma.employee.count();
  const employees = await prisma.employee.findMany({
    where: { leaveRequests: { none: {} } },
    orderBy: { id: "asc" },
  });

  let created = 0;
  for (const employee of employees) {
    const { count } = await prisma.leaveRequest.createMany({ data: sampleLeave(employee) });
    created += count;
  }

  console.log(
    `Leave requests: created ${created} for ${employees.length} employee(s); ` +
      `skipped ${total - employees.length} who already had some.`
  );
};

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
