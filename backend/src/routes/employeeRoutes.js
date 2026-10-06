const express = require("express");
const employeeController = require("../controllers/employeeController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createEmployeeSchema, updateEmployeeSchema } = require("../validators/employeeSchema");

const router = express.Router();

// Every employee route requires a logged-in admin
router.use(requireAuth);

router.post("/", validate(createEmployeeSchema), employeeController.createEmployee);

router.get("/", employeeController.getEmployees);

router.get("/:id", employeeController.getEmployeeById);

router.patch("/:id", validate(updateEmployeeSchema), employeeController.updateEmployee);

router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
