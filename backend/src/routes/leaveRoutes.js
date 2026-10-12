const express = require("express");
const leaveController = require("../controllers/leaveController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { decideLeaveSchema } = require("../validators/managerSchema");

const router = express.Router();

// HR admins see and decide everyone's leave. Managers only handle their own team's, through /api/manager.
router.use(requireAuth, requireRole("HR_ADMIN"));

router.get("/", leaveController.getLeaveRequests);

router.patch("/:id", validate(decideLeaveSchema), leaveController.decideLeave);

module.exports = router;
