import { request } from "./client";

// Everything the HR admin screens need from /api/employees (HR admins only).

const PAGE_SIZE = 100; // the API's maximum

// The API pages its list, so keep asking until every employee is loaded.
export async function getAllEmployees() {
  const all = [];

  for (let page = 1; ; page++) {
    const { employees, pagination } = await request(`/api/employees?page=${page}&pageSize=${PAGE_SIZE}`);
    all.push(...employees);
    if (employees.length === 0 || all.length >= pagination.total) return all;
  }
}

export async function getEmployee(id) {
  const { employee } = await request(`/api/employees/${id}`);
  return employee;
}

export async function createEmployee(data) {
  const { employee } = await request("/api/employees", { method: "POST", body: JSON.stringify(data) });
  return employee;
}

export async function updateEmployee(id, data) {
  const { employee } = await request(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  return employee;
}

export async function deleteEmployee(id) {
  await request(`/api/employees/${id}`, { method: "DELETE" });
}

// The phone an employee checks in from. null when none is registered, otherwise
// { status: "PENDING" | "APPROVED", platform, registeredAt, approvedAt, approvedBy, lastUsedAt }.
export async function getEmployeeDevice(id) {
  const { device } = await request(`/api/employees/${id}/device`);
  return device;
}

// registeredAt is the waiting phone HR looked at; if another phone replaced it since, the server refuses.
export async function approveEmployeeDevice(id, registeredAt) {
  const { device } = await request(`/api/employees/${id}/device/approve`, {
    method: "POST",
    body: JSON.stringify({ registeredAt }),
  });
  return device;
}

// Rejects a waiting phone, or forgets a lost or replaced one, so the person can register again.
export async function resetEmployeeDevice(id) {
  await request(`/api/employees/${id}/device`, { method: "DELETE" });
}

// Leave: HR admins see everyone's requests and can decide any of them (managers decide their team's).

// status: PENDING, APPROVED or REJECTED (no status = all)
export async function getAllLeave(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const { leaveRequests } = await request(`/api/leave-requests${query}`);
  return leaveRequests;
}

export async function decideLeaveAsHr(id, decision, note) {
  const { leaveRequest } = await request(`/api/leave-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: decision, note: note?.trim() || null }),
  });
  return leaveRequest;
}

// Attendance: HR admins write and fix anyone's day directly (every change is kept in the history)
// and decide the corrections managers ask for. Managers read their team's through /api/manager.

// Everyone's record for one day (no date = the company's today, from the server):
// { date, today, workday, shift, rows: [{ employee, record }], counts }
export function getAttendanceDay(dateKey) {
  const query = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
  return request(`/api/attendance${query}`);
}

// Saves (or fixes) one person's check-in and check-out ("HH:MM") for a day. No check-out means none.
export async function saveAttendance({ employeeId, date, checkIn, checkOut, note }) {
  const { record } = await request("/api/attendance", {
    method: "PUT",
    body: JSON.stringify({ employeeId, date, checkIn, checkOut: checkOut || null, note: note?.trim() || null }),
  });
  return record;
}

// Removes a check-in made by mistake. The day then counts as absent again.
export async function removeAttendance(employeeId, date, note) {
  const { record } = await request(`/api/attendance/${encodeURIComponent(employeeId)}/${encodeURIComponent(date)}`, {
    method: "DELETE",
    body: JSON.stringify({ note: note?.trim() || null }),
  });
  return record;
}

// Managers' correction requests (status PENDING, APPROVED or REJECTED; none = all, waiting first)
export async function getCorrectionRequests(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const { corrections } = await request(`/api/attendance-corrections${query}`);
  return corrections;
}

// Approving changes the attendance record; rejecting leaves it as it was.
export async function decideCorrection(id, decision, note) {
  const { correction } = await request(`/api/attendance-corrections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: decision, note: note?.trim() || null }),
  });
  return correction;
}
