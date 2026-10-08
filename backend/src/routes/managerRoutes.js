const express = require("express");
const managerController = require("../controllers/managerController");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const { decideLeaveSchema } = require("../validators/managerSchema");

const router = express.Router();

// Every manager route requires a login
router.use(requireAuth);

router.get("/team", managerController.getTeam);

router.get("/team/:id", managerController.getTeamMember);

router.get("/team/:id/leave-requests", managerController.getMemberLeave);

router.get("/leave-requests", managerController.getLeaveRequests);

router.patch("/leave-requests/:id", validate(decideLeaveSchema), managerController.decideLeave);

module.exports = router;
