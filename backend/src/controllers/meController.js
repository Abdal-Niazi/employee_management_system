const attendanceService = require("../services/attendanceService");
const meService = require("../services/meService");
const AppError = require("../utils/AppError");
const { parseDays } = require("../utils/attendanceQuery");
const parseId = require("../utils/parseId");

const notLinked = () => new AppError("This account isn't linked to an employee", 403);

// The employee is always the signed-in account's own, never a value from the request.
const ownEmployee = async (req) => {
  if (!req.admin.employeeId) throw notLinked();

  const employee = await meService.getProfile(req.admin.employeeId);
  if (!employee) throw notLinked();

  return employee;
};

const getProfile = async (req, res) => {
  const employee = await ownEmployee(req);

  res.status(200).json({ message: "Profile retrieved successfully", employee });
};

const getAttendance = async (req, res) => {
  const employee = await ownEmployee(req);
  const attendance = await attendanceService.getEmployeeDays(employee, parseDays(req.query.days));

  res.status(200).json({ message: "Attendance retrieved successfully", attendance });
};

const getLeaveRequests = async (req, res) => {
  const employee = await ownEmployee(req);
  const leaveRequests = await meService.listLeave(employee.id);

  res.status(200).json({ message: "Leave requests retrieved successfully", leaveRequests });
};

const requestLeave = async (req, res) => {
  const employee = await ownEmployee(req);
  const leaveRequest = await meService.requestLeave(employee.id, req.body);

  res.status(201).json({ message: "Leave requested successfully", leaveRequest });
};

const cancelLeave = async (req, res) => {
  const employee = await ownEmployee(req);
  await meService.cancelLeave(employee.id, parseId(req.params.id, "Leave request id"));

  res.status(200).json({ message: "Leave request cancelled" });
};

module.exports = { getProfile, getAttendance, getLeaveRequests, requestLeave, cancelLeave };
