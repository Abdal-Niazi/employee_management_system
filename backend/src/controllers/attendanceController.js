const attendanceService = require("../services/attendanceService");
const { parseDateParam } = require("../utils/attendanceQuery");
const parseId = require("../utils/parseId");

// Everyone's attendance for one day (default today).
const getAttendance = async (req, res) => {
  const now = new Date();
  const date = parseDateParam(req.query.date, attendanceService.localDateKey(now));
  const day = await attendanceService.getAllDay(date, now);

  res.status(200).json({
    message: "Attendance retrieved successfully",
    ...day,
  });
};

const recordAttendance = async (req, res) => {
  const record = await attendanceService.recordDay(req.body);

  res.status(200).json({
    message: "Attendance saved successfully",
    record,
  });
};

const clearAttendance = async (req, res) => {
  const employeeId = parseId(req.params.employeeId, "employeeId");
  const date = parseDateParam(req.params.date, undefined);

  await attendanceService.clearDay(employeeId, date);

  res.status(200).json({ message: "Attendance removed successfully" });
};

module.exports = { getAttendance, recordAttendance, clearAttendance };
