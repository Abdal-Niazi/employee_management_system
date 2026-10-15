const express = require("express");
const attendanceController = require("../controllers/attendanceController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { recordAttendanceSchema, clearAttendanceSchema } = require("../validators/attendanceSchema");

const router = express.Router();

// HR admins write and fix anyone's attendance directly (every change is kept in the history).
// Managers only read their own team's, through /api/manager, and ask HR to correct it.
router.use(requireAuth, requireRole("HR_ADMIN"));

router.get("/", attendanceController.getAttendance);

router.put("/", validate(recordAttendanceSchema), attendanceController.recordAttendance);

router.delete("/:employeeId/:date", validate(clearAttendanceSchema), attendanceController.clearAttendance);

module.exports = router;
