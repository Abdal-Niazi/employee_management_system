import { request } from "./client";

// The signed-in person's own attendance, for employees and managers alike. The server works out
// who that is from the account, and its own clock sets the check-in and check-out times.

const toDay = ({ today, workday, shift, record, canCheckIn, canCheckOut, notice, device }) => ({
  today,
  workday,
  shift,
  record,
  canCheckIn,
  canCheckOut,
  notice,
  device,
});

// Check-in and check-out only count from the registered phone, which proves it with its key.
const withDeviceKey = (deviceKey) => ({ method: "POST", headers: { "X-Device-Key": deviceKey } });

// GET /api/me/attendance/today
// -> { today, workday, shift, record, canCheckIn, canCheckOut, notice, device }
// device: null (no phone registered) or { status: "PENDING" | "APPROVED", platform, thisPhone }.
// The phone sends its key, if it has one, so the server can say whether it is the registered one.
export async function getMyDay(deviceKey) {
  return toDay(await request("/api/me/attendance/today", deviceKey ? { headers: { "X-Device-Key": deviceKey } } : {}));
}

// POST /api/me/device with the key this phone made (and already saved) -> the device, waiting
// for HR to approve it.
export async function registerDevice(platform, key) {
  const { device } = await request("/api/me/device", {
    method: "POST",
    body: JSON.stringify({ platform, key }),
  });
  return device;
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

// GET /api/me -> { ...employee, manager: { firstName, lastName, position, ... } | null }
export async function getMyProfile() {
  const { employee } = await request("/api/me");
  return employee;
}

// GET /api/me/leave-requests -> { today, leaveRequests }, pending first
export async function getMyLeave() {
  const { today, leaveRequests } = await request("/api/me/leave-requests");
  return { today, leaveRequests };
}

// GET /api/me/leave-balance?year= -> { year, balances: [{ type, entitlement, used, pending, remaining }] }
// (no year = this year). Days waiting for a decision are already taken out of `remaining`.
export async function getMyLeaveBalance(year) {
  const query = year ? `?year=${encodeURIComponent(year)}` : "";
  const { year: shown, balances } = await request(`/api/me/leave-balance${query}`);
  return { year: shown, balances };
}

// { type: "Annual" | "Sick" | "Casual", startDate, endDate, reason }
export async function requestLeave(data) {
  const { leaveRequest } = await request("/api/me/leave-requests", { method: "POST", body: JSON.stringify(data) });
  return leaveRequest;
}

// Only while the request is still pending.
export async function cancelLeave(id) {
  await request(`/api/me/leave-requests/${encodeURIComponent(id)}`, { method: "DELETE" });
}
