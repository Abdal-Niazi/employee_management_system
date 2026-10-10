const express = require("express");
const meController = require("../controllers/meController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

// The signed-in person's own attendance. Managers are employees too, so they check in here as well.
router.use(requireAuth, requireRole("EMPLOYEE", "MANAGER"));

router.get("/attendance/today", meController.getToday);

router.post("/attendance/check-in", meController.checkIn);

router.post("/attendance/check-out", meController.checkOut);

router.get("/attendance", meController.getAttendance);

module.exports = router;
