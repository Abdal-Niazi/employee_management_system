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

// Attendance (HR admins record it; managers read their team's through /api/manager).

// Everyone's record for one day: { date, shift, rows: [{ employee, record }], counts }
export function getAttendanceDay(dateKey) {
  return request(`/api/attendance?date=${encodeURIComponent(dateKey)}`);
}

// Saves (or corrects) one employee's check-in and check-out for a day.
export async function saveAttendance({ employeeId, date, checkIn, checkOut }) {
  const { record } = await request("/api/attendance", {
    method: "PUT",
    body: JSON.stringify({ employeeId, date, checkIn, checkOut: checkOut || null }),
  });
  return record;
}

export async function removeAttendance(employeeId, date) {
  await request(`/api/attendance/${employeeId}/${date}`, { method: "DELETE" });
}
