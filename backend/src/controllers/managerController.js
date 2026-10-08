const managerService = require("../services/managerService");
const AppError = require("../utils/AppError");
const parseId = require("../utils/parseId");
const { LEAVE_STATUSES } = require("../validators/managerSchema");

// Only HR admins can log in so far, so the caller says whose team they want
// with ?managerId=<employee id>. Once manager accounts exist, a signed-in
// manager's own employee id replaces this (and only admins may pass managerId).
const resolveManager = async (req) => {
  if (req.query.managerId === undefined) {
    throw new AppError("managerId is required until manager accounts exist", 400);
  }

  const manager = await managerService.getManager(parseId(req.query.managerId, "managerId"));

  if (!manager) {
    throw new AppError("Manager not found", 404);
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

module.exports = {
  getTeam,
  getTeamMember,
  getLeaveRequests,
  getMemberLeave,
  decideLeave,
};
