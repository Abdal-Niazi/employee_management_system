const express = require("express");
const meController = require("../controllers/meController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { createLeaveSchema } = require("../validators/leaveSchema");

const router = express.Router();

// Your own data only. Employee and manager accounts are people too; HR admin accounts aren't employees.
router.use(requireAuth, requireRole("EMPLOYEE", "MANAGER"));

router.get("/", meController.getProfile);

router.get("/attendance", meController.getAttendance);

router.get("/leave-requests", meController.getLeaveRequests);

router.post("/leave-requests", validate(createLeaveSchema), meController.requestLeave);

router.delete("/leave-requests/:id", meController.cancelLeave);

module.exports = router;
