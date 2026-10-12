const express = require("express");
const attendanceController = require("../controllers/attendanceController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { recordAttendanceSchema } = require("../validators/attendanceSchema");

const router = express.Router();

// HR admins record and correct attendance; managers only read their own team's, through /api/manager.
router.use(requireAuth, requireRole("HR_ADMIN"));

router.get("/", attendanceController.getAttendance);

router.put("/", validate(recordAttendanceSchema), attendanceController.recordAttendance);

router.delete("/:employeeId/:date", attendanceController.clearAttendance);

module.exports = router;
