const express = require("express");
const managerController = require("../controllers/managerController");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Every manager route requires a login
router.use(requireAuth);

router.get("/team", managerController.getTeam);

router.get("/team/:id", managerController.getTeamMember);

module.exports = router;
