const attendanceService = require("../services/attendanceService");
const managerService = require("../services/managerService");
const AppError = require("../utils/AppError");
const { parseDateParam, parseDays } = require("../utils/attendanceQuery");
const parseId = require("../utils/parseId");
const { LEAVE_STATUSES } = require("../validators/managerSchema");

// The manager is always the signed-in MANAGER account's own employee, never a
// value from the request, so nobody can open another manager's team.
const resolveManager = async (req) => {
  const manager = req.admin.employeeId ? await managerService.getManager(req.admin.employeeId) : null;

  if (!manager) {
    throw new AppError("This manager account isn't linked to an employee", 403);
  }

  return manager;
};

const getTeam = async (req, res) => {
  const manager = await resolveManager(req);
  const team = await managerService.getTeam(manager.id);

  res.status(200).json({
    message: "Team retrieved successfully",
    manager,
    team,
  });
};

const getTeamMember = async (req, res) => {
  const manager = await resolveManager(req);
  const employee = await managerService.getTeamMember(manager.id, parseId(req.params.id, "Employee id"));

  if (!employee) {
    throw new AppError("Team member not found", 404);
  }

  res.status(200).json({
    message: "Team member retrieved successfully",
    employee,
  });
};

const getLeaveRequests = async (req, res) => {
  const manager = await resolveManager(req);
  const { status } = req.query;

  if (status !== undefined && !LEAVE_STATUSES.includes(status)) {
    throw new AppError(`status must be one of: ${LEAVE_STATUSES.join(", ")}`, 400);
  }

  const leaveRequests = await managerService.listLeave(manager.id, status);

  res.status(200).json({
    message: "Leave requests retrieved successfully",
    leaveRequests,
  });
};

const getMemberLeave = async (req, res) => {
  const manager = await resolveManager(req);
  const leaveRequests = await managerService.listMemberLeave(manager.id, parseId(req.params.id, "Employee id"));

  if (!leaveRequests) {
    throw new AppError("Team member not found", 404);
  }

  res.status(200).json({
    message: "Leave requests retrieved successfully",
    leaveRequests,
  });
};

const decideLeave = async (req, res) => {
  const manager = await resolveManager(req);
  const leaveRequest = await managerService.decideLeave(
    manager.id,
    parseId(req.params.id, "Leave request id"),
    req.body
  );

  res.status(200).json({
    message: `Leave request ${leaveRequest.status.toLowerCase()}`,
    leaveRequest,
  });
};

// The team's attendance for one day (default today).
const getAttendance = async (req, res) => {
  const manager = await resolveManager(req);
  const now = new Date();
  const date = parseDateParam(req.query.date, attendanceService.localDateKey(now));
  const day = await attendanceService.getTeamDay(manager.id, date, now);

  res.status(200).json({
    message: "Attendance retrieved successfully",
    ...day,
  });
};

// One team member's last few days, newest first.
const getMemberAttendance = async (req, res) => {
  const manager = await resolveManager(req);
  const days = parseDays(req.query.days);
  const attendance = await attendanceService.getMemberDays(manager.id, parseId(req.params.id, "Employee id"), days);

  if (!attendance) {
    throw new AppError("Team member not found", 404);
  }

  res.status(200).json({
    message: "Attendance retrieved successfully",
    attendance,
  });
};

module.exports = {
  getTeam,
  getTeamMember,
  getLeaveRequests,
  getMemberLeave,
  decideLeave,
  getAttendance,
  getMemberAttendance,
};
