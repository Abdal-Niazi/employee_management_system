import { request } from "./client";

// The signed-in person's own attendance, for employees and managers alike. The server works out
// who that is from the account, and its own clock sets the check-in and check-out times.

const toDay = ({ today, workday, shift, record, canCheckIn, canCheckOut, notice, deviceRegistered }) => ({
  today,
  workday,
  shift,
  record,
  canCheckIn,
  canCheckOut,
  notice,
  deviceRegistered,
});

// Check-in and check-out only count from the registered phone, which proves it with its key.
const withDeviceKey = (deviceKey) => ({ method: "POST", headers: { "X-Device-Key": deviceKey } });

// GET /api/me/attendance/today
// -> { today, workday, shift, record, canCheckIn, canCheckOut, notice, deviceRegistered }
export async function getMyDay() {
  return toDay(await request("/api/me/attendance/today"));
}

// POST /api/me/device -> { key, device }. The key is sent only this once.
export async function registerDevice(platform) {
  const { key, device } = await request("/api/me/device", {
    method: "POST",
    body: JSON.stringify({ platform }),
  });
  return { key, device };
}

// POST /api/me/attendance/check-in -> the updated day
export async function checkIn(deviceKey) {
  return toDay(await request("/api/me/attendance/check-in", withDeviceKey(deviceKey)));
}

// POST /api/me/attendance/check-out -> the updated day
export async function checkOut(deviceKey) {
  return toDay(await request("/api/me/attendance/check-out", withDeviceKey(deviceKey)));
}

// GET /api/me/attendance?days=7 -> { today, shift, records }, newest day first
export async function getMyAttendance(days = 7) {
  const { today, shift, records } = await request(`/api/me/attendance?days=${encodeURIComponent(days)}`);
  return { today, shift, records };
}
