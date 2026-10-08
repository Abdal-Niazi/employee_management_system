const express = require("express");
const employeeController = require("../controllers/employeeController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { createEmployeeSchema, updateEmployeeSchema } = require("../validators/employeeSchema");

const router = express.Router();

// Every employee route requires a logged-in account. Managers can only read;
// HR admins can also create, update and delete.
router.use(requireAuth);

const hrAdminOnly = requireRole("HR_ADMIN");
const hrAdminOrManager = requireRole("HR_ADMIN", "MANAGER");

router.post("/", hrAdminOnly, validate(createEmployeeSchema), employeeController.createEmployee);

router.get("/", hrAdminOrManager, employeeController.getEmployees);

router.get("/:id", hrAdminOrManager, employeeController.getEmployeeById);

router.patch("/:id", hrAdminOnly, validate(updateEmployeeSchema), employeeController.updateEmployee);

router.delete("/:id", hrAdminOnly, employeeController.deleteEmployee);

module.exports = router;
