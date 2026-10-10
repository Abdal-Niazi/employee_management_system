import { request } from "./client";

// What an employee sees about themselves, from /api/me. The server works out who
// they are from the signed-in account.

// { ...employee, manager: { firstName, lastName, position, ... } | null }
export async function getMyProfile() {
  const { employee } = await request("/api/me");
  return employee;
}

// The last `days` days, newest first.
export async function getMyAttendance(days = 14) {
  const { attendance } = await request(`/api/me/attendance?days=${days}`);
  return attendance;
}

export async function getMyLeave() {
  const { leaveRequests } = await request("/api/me/leave-requests");
  return leaveRequests;
}

// { type: "Annual" | "Sick" | "Casual", startDate, endDate, reason }
export async function requestLeave(data) {
  const { leaveRequest } = await request("/api/me/leave-requests", { method: "POST", body: JSON.stringify(data) });
  return leaveRequest;
}

// Only while the request is still pending.
export async function cancelLeave(id) {
  await request(`/api/me/leave-requests/${id}`, { method: "DELETE" });
}
