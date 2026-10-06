import { addDays, fromDateKey, isWeekend, todayKey } from "../utils/date";
import { fullName } from "../utils/status";

// Sample attendance and leave data for the manager screens. The backend has no
// Attendance or LeaveRequest models yet, so records are generated from the real
// team list (names line up) and leave decisions live in memory for the session.

export const SHIFT = { name: "General", start: "09:00", end: "17:00" };

export const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// Deterministic hash so the same employee + day always gets the same sample record.
// FNV-1a plus a murmur3 finalizer — without it, consecutive dates give correlated values.
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

const pad = (n) => String(n).padStart(2, "0");
const toTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const dayToIso = (key) => fromDateKey(key).toISOString();

// ---------- Leave requests ----------

const LEAVE_TYPES = ["Annual", "Sick", "Casual"];
const REASONS = {
  Annual: ["Family trip", "Visiting relatives", "Wedding in the family"],
  Sick: ["Fever and flu", "Medical appointment", "Recovering from a minor procedure"],
  Casual: ["Personal errand", "Moving house", "Bank and paperwork"],
};

const leaveRequests = [];
const seeded = new Set();

function nextWeekday(key) {
  let day = key;
  while (isWeekend(day)) day = addDays(day, 1);
  return day;
}

// Last day of a leave that covers `days` working days starting on `start`.
function endAfterWorkingDays(start, days) {
  let end = start;
  for (let left = days - 1; left > 0; left--) end = nextWeekday(addDays(end, 1));
  return end;
}

function makeRequest(employee, n, { startOffset, days, status, requestedOffset }) {
  const h = hash(`${employee.employeeId}#${n}`);
  const type = LEAVE_TYPES[h % LEAVE_TYPES.length];
  const today = todayKey();
  const startDate = nextWeekday(addDays(today, startOffset));
  const hired = employee.hireDate.slice(0, 10);
  const requested = addDays(today, requestedOffset);
  const requestedKey = requested < hired ? hired : requested;
  return {
    id: `LR-${employee.employeeId}-${n}`,
    employeeId: employee.employeeId,
    employeeDbId: employee.id,
    employeeName: fullName(employee),
    department: employee.department,
    type,
    startDate,
    endDate: endAfterWorkingDays(startDate, days),
    days,
    reason: REASONS[type][h % REASONS[type].length],
    status,
    requestedAt: dayToIso(requestedKey),
    decidedAt: status === "PENDING" ? null : dayToIso(addDays(requestedKey, 1)),
    decisionNote: status === "REJECTED" ? "Overlaps with a release week" : null,
  };
}

function seedLeave(team) {
  for (const employee of team) {
    if (seeded.has(employee.employeeId)) continue;
    seeded.add(employee.employeeId);
    const h = hash(employee.employeeId);
    leaveRequests.push(
      makeRequest(employee, 1, {
        startOffset: 3 + (h % 10),
        days: 1 + (h % 3),
        status: "PENDING",
        requestedOffset: -1 - (h % 3),
      })
    );

    // A past, already-decided request — only if the employee was hired by then.
    const pastRequestedOffset = -40 - (h % 10);
    if (addDays(todayKey(), pastRequestedOffset) >= employee.hireDate.slice(0, 10)) {
      leaveRequests.push(
        makeRequest(employee, 2, {
          startOffset: -25 - (h % 20),
          days: 1 + ((h >>> 4) % 2),
          status: (h >>> 1) % 2 === 0 ? "APPROVED" : "REJECTED",
          requestedOffset: pastRequestedOffset,
        })
      );
    }

    if ((h >>> 2) % 2 === 0) {
      leaveRequests.push(
        makeRequest(employee, 3, { startOffset: 1, days: 1, status: "PENDING", requestedOffset: 0 })
      );
    }
  }
}

export function listLeave(team, status) {
  seedLeave(team);
  const ids = new Set(team.map((e) => e.employeeId));
  return leaveRequests
    .filter((r) => ids.has(r.employeeId) && (!status || r.status === status))
    .sort((a, b) =>
      a.status === "PENDING" && b.status === "PENDING"
        ? a.startDate.localeCompare(b.startDate)
        : (b.decidedAt ?? b.requestedAt).localeCompare(a.decidedAt ?? a.requestedAt)
    )
    .map((r) => ({ ...r }));
}

export function decideLeave(id, decision, note) {
  const request = leaveRequests.find((r) => r.id === id);
  if (!request) throw new Error("Leave request not found");
  if (request.status !== "PENDING") throw new Error("This request has already been decided");
  Object.assign(request, {
    status: decision,
    decidedAt: new Date().toISOString(),
    decisionNote: note?.trim() || null,
  });
  return { ...request };
}

function onApprovedLeave(employeeId, dateKey) {
  return leaveRequests.some(
    (r) =>
      r.employeeId === employeeId &&
      r.status === "APPROVED" &&
      r.startDate <= dateKey &&
      dateKey <= r.endDate
  );
}

// ---------- Attendance ----------

export function attendanceFor(employee, dateKey) {
  const base = { employeeId: employee.employeeId, date: dateKey, shift: SHIFT, checkIn: null, checkOut: null };

  if (isWeekend(dateKey) || dateKey < employee.hireDate.slice(0, 10)) return { ...base, status: "OFF" };
  if (onApprovedLeave(employee.employeeId, dateKey)) return { ...base, status: "ON_LEAVE" };

  const roll = hash(`${employee.employeeId}|${dateKey}`) % 100;
  const isToday = dateKey === todayKey();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Nobody counts as absent until their shift is over.
  if (roll < 8) return { ...base, status: isToday && nowMinutes < 17 * 60 ? "NOT_IN" : "ABSENT" };

  const late = roll < 28;
  const checkIn = late ? 9 * 60 + 6 + (roll % 35) : 8 * 60 + 35 + (roll % 24);
  const checkOut = 17 * 60 + (roll % 50);
  const status = late ? "LATE" : "PRESENT";

  if (isToday) {
    if (nowMinutes < checkIn) return { ...base, status: "NOT_IN" };
    return { ...base, status, checkIn: toTime(checkIn), checkOut: nowMinutes >= checkOut ? toTime(checkOut) : null };
  }

  return { ...base, status, checkIn: toTime(checkIn), checkOut: toTime(checkOut) };
}

export function teamAttendance(team, dateKey) {
  seedLeave(team);
  return team.map((employee) => ({ employee, record: attendanceFor(employee, dateKey) }));
}

export function memberAttendance(employee, days) {
  seedLeave([employee]);
  const today = todayKey();
  return Array.from({ length: days }, (_, i) => attendanceFor(employee, addDays(today, -i)));
}

export function summarize(records) {
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, NOT_IN: 0, OFF: 0 };
  for (const record of records) counts[record.status] += 1;
  return counts;
}
