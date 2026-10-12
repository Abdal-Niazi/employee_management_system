import { request } from "./client";

// Everything the manager screens need, all from the backend. It works out whose team
// it is from the signed-in manager account.

function managerUrl(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return query ? `${path}?${query}` : path;
}

// Real: GET /api/manager/team
export async function getTeam() {
  const { team } = await request(managerUrl("/api/manager/team"));
  return team;
}

// Real: GET /api/manager/team/:id
export async function getTeamMember(id) {
  const { employee } = await request(managerUrl(`/api/manager/team/${encodeURIComponent(id)}`));
  return employee;
}

// Real: GET /api/manager/leave-requests?status=PENDING (no status = all)
export async function getLeaveRequests(status) {
  const { leaveRequests } = await request(managerUrl("/api/manager/leave-requests", { status }));
  return leaveRequests;
}

// Real: GET /api/manager/team/:id/leave-requests
export async function getMemberLeave(member) {
  const { leaveRequests } = await request(managerUrl(`/api/manager/team/${encodeURIComponent(member.id)}/leave-requests`));
  return leaveRequests;
}

// Real: PATCH /api/manager/leave-requests/:id  { status, note }
export async function decideLeave(id, decision, note) {
  const { leaveRequest } = await request(managerUrl(`/api/manager/leave-requests/${encodeURIComponent(id)}`), {
    method: "PATCH",
    body: JSON.stringify({ status: decision, note: note?.trim() || null }),
  });
  return leaveRequest;
}

// GET /api/manager/attendance?date=YYYY-MM-DD, or no date for the company's own today.
// -> { date, today, workday, shift, rows: [{ employee, record }], counts }
// `today` is the company's day (Asia/Karachi), which can differ from the phone's day,
// so the screens use it instead of the device clock.
export async function getTeamAttendance(dateKey) {
  const { date, today, workday, shift, rows, counts } = await request(
    managerUrl("/api/manager/attendance", { date: dateKey })
  );
  return { date, today, workday, shift, rows, counts };
}

// GET /api/manager/team/:id/attendance?days=7 -> newest day first
export async function getMemberAttendance(member, days = 7) {
  const { today, records } = await request(
    managerUrl(`/api/manager/team/${encodeURIComponent(member.id)}/attendance`, { days })
  );
  return { today, records };
}

// Today's attendance plus the leave requests waiting for the manager. Sending no date
// lets the server pick its own today.
export async function getOverview() {
  const [day, pending] = await Promise.all([getTeamAttendance(), getLeaveRequests("PENDING")]);
  return {
    date: day.date,
    teamSize: day.rows.length,
    workday: day.workday,
    counts: day.counts,
    pending,
  };
}

// Managers can't change attendance; they ask HR to correct a day.
// POST /api/manager/attendance-corrections  { employeeId, date, checkIn, checkOut, reason }
export async function requestCorrection({ employeeId, date, checkIn, checkOut, reason }) {
  const { correction } = await request(managerUrl("/api/manager/attendance-corrections"), {
    method: "POST",
    body: JSON.stringify({ employeeId, date, checkIn, checkOut: checkOut || null, reason: reason.trim() }),
  });
  return correction;
}

// GET /api/manager/attendance-corrections?status=PENDING (no status = all)
export async function getCorrections(status) {
  const { corrections } = await request(managerUrl("/api/manager/attendance-corrections", { status }));
  return corrections;
}
