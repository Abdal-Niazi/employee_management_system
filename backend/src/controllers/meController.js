const attendanceService = require("../services/attendanceService");
const employeeService = require("../services/employeeService");
const AppError = require("../utils/AppError");
const parseDays = require("../utils/parseDays");

// The employee is always the signed-in account's own, never a value from the request,
// so nobody can check someone else in or read their attendance.
const resolveSelf = async (req) => {
  const employee = req.admin.employeeId ? await employeeService.getEmployeeById(req.admin.employeeId) : null;

  if (!employee) {
    throw new AppError("This account isn't linked to an employee", 403);
  }

  return employee;
};

const getToday = async (req, res) => {
  const day = await attendanceService.getMyDay(await resolveSelf(req));

  res.status(200).json({
    message: "Today retrieved successfully",
    ...day,
  });
};

const checkIn = async (req, res) => {
  const day = await attendanceService.checkIn(await resolveSelf(req));

  res.status(200).json({
    message: "Checked in",
    ...day,
  });
};

const checkOut = async (req, res) => {
  const day = await attendanceService.checkOut(await resolveSelf(req));

  res.status(200).json({
    message: "Checked out",
    ...day,
  });
};

const getAttendance = async (req, res) => {
  const employee = await resolveSelf(req);
  const history = await attendanceService.getMyHistory(employee, parseDays(req.query.days));

  res.status(200).json({
    message: "Attendance retrieved successfully",
    ...history,
  });
};

module.exports = {
  getToday,
  checkIn,
  checkOut,
  getAttendance,
};
