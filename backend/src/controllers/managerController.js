const managerService = require("../services/managerService");
const AppError = require("../utils/AppError");
const parseId = require("../utils/parseId");

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

module.exports = {
  getTeam,
  getTeamMember,
};
