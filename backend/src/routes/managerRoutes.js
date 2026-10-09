const express = require("express");
const managerController = require("../controllers/managerController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { decideLeaveSchema } = require("../validators/managerSchema");

const router = express.Router();

// Only MANAGER accounts; each one only ever sees its own team.
router.use(requireAuth, requireRole("MANAGER"));

router.get("/team", managerController.getTeam);

router.get("/team/:id", managerController.getTeamMember);

router.get("/team/:id/leave-requests", managerController.getMemberLeave);

router.get("/leave-requests", managerController.getLeaveRequests);

router.patch("/leave-requests/:id", validate(decideLeaveSchema), managerController.decideLeave);

module.exports = router;
