const attendanceService = require("../services/attendanceService");
const deviceService = require("../services/deviceService");
const employeeService = require("../services/employeeService");
const meService = require("../services/meService");
const AppError = require("../utils/AppError");
const parseDays = require("../utils/parseDays");
const parseId = require("../utils/parseId");
const { todayKey } = require("../utils/companyTime");

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
  // The phone sends its key, if it has one, to learn whether it is the registered phone.
  const device = await deviceService.ownDevice(employee.id, req.get(deviceService.DEVICE_KEY_HEADER));

  res.status(200).json({
    message: "Today retrieved successfully",
    ...day,
    deviceRegistered: Boolean(device),
    device,
  });
};

// The first time on a phone: asks for it to be the one this person checks in from. It can check
// in once an HR admin approves it.
const registerDevice = async (req, res) => {
  const device = await deviceService.registerDevice(await resolveSelf(req), req.body);

  res.status(201).json({
    message: "Phone registered. HR needs to approve it before you can check in.",
    device,
  });
};

// Check-in and check-out only count from the registered phone, checked before anything else.
const checkIn = async (req, res) => {
  const employee = await resolveSelf(req);
  const device = await deviceService.verifyDevice(employee, req.get(deviceService.DEVICE_KEY_HEADER));
  const day = await attendanceService.checkIn(employee);
  await deviceService.markUsed(device);

  res.status(200).json({
    message: "Checked in",
    ...day,
    deviceRegistered: true,
  });
};

const checkOut = async (req, res) => {
  const employee = await resolveSelf(req);
  const device = await deviceService.verifyDevice(employee, req.get(deviceService.DEVICE_KEY_HEADER));
  const day = await attendanceService.checkOut(employee);
  await deviceService.markUsed(device);

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
    // The same days under the name app builds from before this version read
    attendance: history.records,
  });
};

// ---------- Leave ----------

const getLeaveRequests = async (req, res) => {
  const employee = await resolveSelf(req);
  const result = await meService.listLeave(employee.id);

  res.status(200).json({ message: "Leave requests retrieved successfully", ...result });
};

// ?year=2026 (default: this year). Entitlements are the same for everyone.
const getLeaveBalance = async (req, res) => {
  const employee = await resolveSelf(req);
  const { year: text } = req.query;
  // "This year" is the company's, like every other day the API works out.
  const year = text === undefined ? Number(todayKey().slice(0, 4)) : Number(text);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError("year must be a year like 2026", 400);
  }

  const balance = await meService.getBalance(employee.id, year);

  res.status(200).json({ message: "Leave balance retrieved successfully", ...balance });
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
  getLeaveBalance,
  getLeaveRequests,
  requestLeave,
  cancelLeave,
};
