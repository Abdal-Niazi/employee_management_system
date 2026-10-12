const attendanceService = require("../services/attendanceService");
const deviceService = require("../services/deviceService");
const employeeService = require("../services/employeeService");
const meService = require("../services/meService");
const AppError = require("../utils/AppError");
const parseDays = require("../utils/parseDays");
const parseId = require("../utils/parseId");

// The employee is always the signed-in account's own, never a value from the request,
// so nobody can check someone else in or read their attendance.
const notLinked = () => new AppError("This account isn't linked to an employee", 403);

const resolveSelf = async (req) => {
  const employee = req.admin.employeeId ? await employeeService.getEmployeeById(req.admin.employeeId) : null;
  if (!employee) throw notLinked();

  return employee;
};

// ---------- Profile ----------

// The person's own details and who they report to.
const getProfile = async (req, res) => {
  const employee = req.admin.employeeId ? await meService.getProfile(req.admin.employeeId) : null;
  if (!employee) throw notLinked();

  res.status(200).json({ message: "Profile retrieved successfully", employee });
};

// ---------- Attendance ----------

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

// ---------- Leave ----------

const getLeaveRequests = async (req, res) => {
  const employee = await resolveSelf(req);
  const result = await meService.listLeave(employee.id);

  res.status(200).json({ message: "Leave requests retrieved successfully", ...result });
};

const requestLeave = async (req, res) => {
  const employee = await resolveSelf(req);
  const leaveRequest = await meService.requestLeave(employee.id, req.body);

  res.status(201).json({ message: "Leave requested successfully", leaveRequest });
};

const cancelLeave = async (req, res) => {
  const employee = await resolveSelf(req);
  await meService.cancelLeave(employee.id, parseId(req.params.id, "Leave request id"));

  res.status(200).json({ message: "Leave request cancelled" });
};

module.exports = {
  getProfile,
  getToday,
  registerDevice,
  checkIn,
  checkOut,
  getAttendance,
  getLeaveRequests,
  requestLeave,
  cancelLeave,
};
