const attendanceService = require("../services/attendanceService");
const reportService = require("../services/attendanceReportService");
const AppError = require("../utils/AppError");
const { todayKey } = require("../utils/companyTime");
const parseDateKey = require("../utils/parseDateKey");
const parseId = require("../utils/parseId");
const parseMonthKey = require("../utils/parseMonthKey");

// Everyone's attendance for one day (default the company's today).
const getAttendance = async (req, res) => {
  const date = req.query.date === undefined ? todayKey() : parseDateKey(req.query.date);
  const day = await attendanceService.getAllDay(date);

  res.status(200).json({
    message: "Attendance retrieved successfully",
    ...day,
  });
};

// One month of everyone's attendance (default the company's current month), as JSON or, with
// ?format=csv, as a file to open in a spreadsheet.
const getReport = async (req, res) => {
  const { format } = req.query;
  if (format !== undefined && !["json", "csv"].includes(format)) {
    throw new AppError("format must be json or csv", 400);
  }

  const month = req.query.month === undefined ? todayKey().slice(0, 7) : parseMonthKey(req.query.month);
  const report = await reportService.getMonthReport(month);

  if (format === "csv") {
    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${month}.csv"`,
      })
      .send(reportService.toCsv(report));
    return;
  }

  res.status(200).json({ message: "Attendance report retrieved successfully", ...report });
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

module.exports = { getAttendance, getReport, recordAttendance, clearAttendance };
