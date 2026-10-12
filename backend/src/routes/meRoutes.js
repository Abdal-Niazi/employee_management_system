const express = require("express");
const meController = require("../controllers/meController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { registerDeviceSchema } = require("../validators/deviceSchema");
const { createLeaveSchema } = require("../validators/leaveSchema");

const router = express.Router();

// The signed-in person's own data only. Managers are employees too, so they check in here as
// well; HR admin accounts aren't employees.
router.use(requireAuth, requireRole("EMPLOYEE", "MANAGER"));

router.get("/", meController.getProfile);

router.get("/attendance/today", meController.getToday);

// Check-in and check-out need the registered phone's key in the X-Device-Key header.
router.post("/attendance/check-in", meController.checkIn);

router.post("/attendance/check-out", meController.checkOut);

router.get("/attendance", meController.getAttendance);

router.post("/device", validate(registerDeviceSchema), meController.registerDevice);

router.get("/leave-requests", meController.getLeaveRequests);

router.post("/leave-requests", validate(createLeaveSchema), meController.requestLeave);

router.delete("/leave-requests/:id", meController.cancelLeave);

module.exports = router;
