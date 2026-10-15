const express = require("express");
const employeeController = require("../controllers/employeeController");
const deviceController = require("../controllers/deviceController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { approveDeviceSchema } = require("../validators/deviceSchema");
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

// A person's registered phone (they check in from it). A new one waits for approval; delete it
// to reject it, or to reset a lost or replaced one.
router.get("/:id/device", deviceController.getDevice);

router.post("/:id/device/approve", validate(approveDeviceSchema), deviceController.approveDevice);

router.delete("/:id/device", deviceController.resetDevice);

module.exports = router;
