import { request } from "./client";

// Everything the manager screens need, all from /api/manager.
// The backend works out whose team it is from the signed-in manager account.

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

// Real: GET /api/manager/attendance?date=YYYY-MM-DD (no date = today on the server)
// -> { date, shift, rows: [{ employee, record }], counts }
export function getTeamAttendance(dateKey) {
  return request(managerUrl("/api/manager/attendance", { date: dateKey }));
}

// Real: GET /api/manager/team/:id/attendance?days=7 (newest first)
export async function getMemberAttendance(member, days = 7) {
  const { attendance } = await request(
    managerUrl(`/api/manager/team/${encodeURIComponent(member.id)}/attendance`, { days })
  );
  return attendance;
}

// Today's counts plus pending leave for the overview screen.
export async function getOverview() {
  const [team, leave, today] = await Promise.all([getTeam(), getLeaveRequests("PENDING"), getTeamAttendance()]);
  return { teamSize: team.length, counts: today.counts, pending: leave };
}
