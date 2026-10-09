import { todayKey } from "../utils/date";
import { request } from "./client";
import * as mock from "./mock";

// Everything the manager screens need. Team and leave data are real; attendance
// is sample data (see mock.js) until GET /api/manager/attendance exists.
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

const approvedOnly = (leave) => leave.filter((r) => r.status === "APPROVED");

// Sample, but people on real approved leave show as "On leave".
// Later: GET /api/manager/attendance?date=YYYY-MM-DD
export async function getTeamAttendance(dateKey) {
  const [team, approved] = await Promise.all([getTeam(), getLeaveRequests("APPROVED")]);
  await mock.delay();
  const rows = mock.teamAttendance(team, dateKey, approved);
  return { rows, counts: mock.summarize(rows.map((r) => r.record)) };
}

// Sample. `leave` is the member's real leave history (from getMemberLeave).
// Later: GET /api/manager/team/:id/attendance?days=7
export async function getMemberAttendance(member, days = 7, leave = []) {
  await mock.delay();
  return mock.memberAttendance(member, days, approvedOnly(leave));
}

// Team size and pending leave are real; today's attendance is sample.
export async function getOverview() {
  const [team, leave] = await Promise.all([getTeam(), getLeaveRequests()]);
  await mock.delay();
  const today = mock.teamAttendance(team, todayKey(), approvedOnly(leave));
  return {
    teamSize: team.length,
    counts: mock.summarize(today.map((r) => r.record)),
    pending: leave.filter((r) => r.status === "PENDING"),
  };
}
