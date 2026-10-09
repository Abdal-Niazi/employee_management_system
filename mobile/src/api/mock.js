import { addDays, isWeekend, todayKey } from "../utils/date";

// Sample attendance for the manager screens. The backend has no Attendance model
// yet, so records are generated from the real team list (names line up). People on
// real approved leave (passed in from the backend) show as "On leave".

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

function onApprovedLeave(approvedLeave, employeeId, dateKey) {
  return approvedLeave.some(
    (r) =>
      r.employeeId === employeeId &&
      r.status === "APPROVED" &&
      r.startDate <= dateKey &&
      dateKey <= r.endDate
  );
}

export function attendanceFor(employee, dateKey, approvedLeave = []) {
  const base = { employeeId: employee.employeeId, date: dateKey, shift: SHIFT, checkIn: null, checkOut: null };

  if (isWeekend(dateKey) || dateKey < employee.hireDate.slice(0, 10)) return { ...base, status: "OFF" };
  if (onApprovedLeave(approvedLeave, employee.employeeId, dateKey)) return { ...base, status: "ON_LEAVE" };

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

export function teamAttendance(team, dateKey, approvedLeave = []) {
  return team.map((employee) => ({ employee, record: attendanceFor(employee, dateKey, approvedLeave) }));
}

export function memberAttendance(employee, days, approvedLeave = []) {
  const today = todayKey();
  return Array.from({ length: days }, (_, i) => attendanceFor(employee, addDays(today, -i), approvedLeave));
}

export function summarize(records) {
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, NOT_IN: 0, OFF: 0 };
  for (const record of records) counts[record.status] += 1;
  return counts;
}
