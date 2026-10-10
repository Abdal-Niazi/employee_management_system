import { request } from "./client";

// The signed-in person's own attendance, for employees and managers alike. The server works out
// who that is from the account, and its own clock sets the check-in and check-out times.

const toDay = ({ today, workday, shift, record, canCheckIn, canCheckOut, notice }) => ({
  today,
  workday,
  shift,
  record,
  canCheckIn,
  canCheckOut,
  notice,
});

// GET /api/me/attendance/today
// -> { today, workday, shift, record, canCheckIn, canCheckOut, notice }
export async function getMyDay() {
  return toDay(await request("/api/me/attendance/today"));
}

// POST /api/me/attendance/check-in -> the updated day
export async function checkIn() {
  return toDay(await request("/api/me/attendance/check-in", { method: "POST" }));
}

// POST /api/me/attendance/check-out -> the updated day
export async function checkOut() {
  return toDay(await request("/api/me/attendance/check-out", { method: "POST" }));
}

// GET /api/me/attendance?days=7 -> { today, shift, records }, newest day first
export async function getMyAttendance(days = 7) {
  const { today, shift, records } = await request(`/api/me/attendance?days=${encodeURIComponent(days)}`);
  return { today, shift, records };
}
