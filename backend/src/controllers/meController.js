const attendanceService = require("../services/attendanceService");
const deviceService = require("../services/deviceService");
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
  const employee = await resolveSelf(req);
  const day = await attendanceService.getMyDay(employee);

  res.status(200).json({
    message: "Today retrieved successfully",
    ...day,
    deviceRegistered: await deviceService.isRegistered(employee.id),
  });
};

// The first time on a phone: makes it the one this person checks in from.
const registerDevice = async (req, res) => {
  const result = await deviceService.registerDevice(await resolveSelf(req), req.body);

  res.status(201).json({
    message: "Phone registered",
    ...result,
  });
};

// Check-in and check-out only count from the registered phone, checked before anything else.
const checkIn = async (req, res) => {
  const employee = await resolveSelf(req);
  await deviceService.verifyDevice(employee, req.get(deviceService.DEVICE_KEY_HEADER));
  const day = await attendanceService.checkIn(employee);

  res.status(200).json({
    message: "Checked in",
    ...day,
    deviceRegistered: true,
  });
};

const checkOut = async (req, res) => {
  const employee = await resolveSelf(req);
  await deviceService.verifyDevice(employee, req.get(deviceService.DEVICE_KEY_HEADER));
  const day = await attendanceService.checkOut(employee);

  res.status(200).json({
    message: "Checked out",
    ...day,
    deviceRegistered: true,
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
  registerDevice,
  checkIn,
  checkOut,
  getAttendance,
};
