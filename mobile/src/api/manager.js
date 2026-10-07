import { todayKey } from "../utils/date";
import { ApiError, request } from "./client";
import * as mock from "./mock";

// Everything the manager screens need. Team data is real; attendance and leave
// are sample data (see mock.js) until the backend endpoints noted below exist.

// Manager accounts don't exist yet, so an admin login views the team of the
// employee set in mobile/.env. Once managers can sign in, the backend uses the
// signed-in manager and this setting goes away.
function managerQuery() {
  const managerId = process.env.EXPO_PUBLIC_MANAGER_ID;
  if (!managerId) {
    throw new ApiError(
      "Set EXPO_PUBLIC_MANAGER_ID in mobile/.env to the id of the manager whose team you want to see.",
      0
    );
  }
  return `?managerId=${encodeURIComponent(managerId)}`;
}

// Real: GET /api/manager/team
export async function getTeam() {
  const { team } = await request(`/api/manager/team${managerQuery()}`);
  return team;
}

// Real: GET /api/manager/team/:id
export async function getTeamMember(id) {
  const { employee } = await request(`/api/manager/team/${encodeURIComponent(id)}${managerQuery()}`);
  return employee;
}

// Sample. Later: GET /api/manager/attendance?date=YYYY-MM-DD
export async function getTeamAttendance(dateKey) {
  const team = await getTeam();
  await mock.delay();
  const rows = mock.teamAttendance(team, dateKey);
  return { rows, counts: mock.summarize(rows.map((r) => r.record)) };
}

// Sample. Later: GET /api/manager/team/:id/attendance?days=7
export async function getMemberAttendance(member, days = 7) {
  await mock.delay();
  return mock.memberAttendance(member, days);
}

// Sample. Later: GET /api/manager/leave-requests?status=PENDING
export async function getLeaveRequests(status) {
  const team = await getTeam();
  await mock.delay();
  return mock.listLeave(team, status);
}

// Sample. Later: GET /api/manager/team/:id/leave-requests
export async function getMemberLeave(member) {
  await mock.delay();
  return mock.listLeave([member]);
}

// Sample. Later: PATCH /api/manager/leave-requests/:id  { status, note }
export async function decideLeave(id, decision, note) {
  await mock.delay();
  return mock.decideLeave(id, decision, note);
}

// Team size is real; today's attendance and pending leave are sample.
export async function getOverview() {
  const team = await getTeam();
  await mock.delay();
  const today = mock.teamAttendance(team, todayKey());
  return {
    teamSize: team.length,
    counts: mock.summarize(today.map((r) => r.record)),
    pending: mock.listLeave(team, "PENDING"),
  };
}
