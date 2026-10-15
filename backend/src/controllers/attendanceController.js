const attendanceService = require("../services/attendanceService");
const { todayKey } = require("../utils/companyTime");
const parseDateKey = require("../utils/parseDateKey");
const parseId = require("../utils/parseId");

// Everyone's attendance for one day (default the company's today).
const getAttendance = async (req, res) => {
  const date = req.query.date === undefined ? todayKey() : parseDateKey(req.query.date);
  const day = await attendanceService.getAllDay(date);

  res.status(200).json({
    message: "Attendance retrieved successfully",
    ...day,
  });
};

// The signed-in HR admin is recorded as the one who made the change.
const recordAttendance = async (req, res) => {
  const record = await attendanceService.recordDay(req.admin.id, req.body);

  res.status(200).json({
    message: "Attendance saved successfully",
    record,
  });
};

const clearAttendance = async (req, res) => {
  const record = await attendanceService.clearDay(req.admin.id, {
    employeeId: parseId(req.params.employeeId, "Employee id"),
    date: parseDateKey(req.params.date),
    note: req.body.note,
  });

  res.status(200).json({
    message: "Check-in removed",
    record,
  });
};

module.exports = { getAttendance, recordAttendance, clearAttendance };
