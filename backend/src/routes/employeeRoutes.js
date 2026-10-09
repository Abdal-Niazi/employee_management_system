const express = require("express");
const employeeController = require("../controllers/employeeController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { createEmployeeSchema, updateEmployeeSchema } = require("../validators/employeeSchema");

const router = express.Router();

// HR admins only. Managers see just their own team, through /api/manager, so they
// can't read every employee's personal details.
router.use(requireAuth, requireRole("HR_ADMIN"));

router.post("/", validate(createEmployeeSchema), employeeController.createEmployee);

router.get("/", employeeController.getEmployees);

router.get("/:id", employeeController.getEmployeeById);

router.patch("/:id", validate(updateEmployeeSchema), employeeController.updateEmployee);

router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
