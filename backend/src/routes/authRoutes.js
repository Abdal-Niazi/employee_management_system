const express = require("express");
const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { loginSchema } = require("../validators/authSchema");

const router = express.Router();

router.post("/login", validate(loginSchema), authController.login);

router.get("/me", requireAuth, authController.me);

module.exports = router;
