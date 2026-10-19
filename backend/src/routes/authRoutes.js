const express = require("express");
const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { passwordChangeLimiter } = require("../middleware/rateLimits");
const { changePasswordSchema, loginSchema } = require("../validators/authSchema");

const router = express.Router();

router.post("/login", validate(loginSchema), authController.login);

router.get("/me", requireAuth, authController.me);

// Any signed-in account (HR admin, manager or employee), for its own password only. Checked before
// the limiter, so a too-short new password doesn't use up the attempts.
router.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  passwordChangeLimiter,
  authController.changePassword
);

module.exports = router;
