const express = require("express");
const employeeController = require("../controllers/employeeController");
const deviceController = require("../controllers/deviceController");
const accountController = require("../controllers/accountController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { createAccountSchema, updateAccountSchema } = require("../validators/accountSchema");
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

// A person's login (their account in the app). HR creates it with a temporary password, resets a
// forgotten one, turns the login off or on, and switches it between employee and manager.
router.get("/:id/account", accountController.getAccount);

router.post("/:id/account", validate(createAccountSchema), accountController.createAccount);

router.patch("/:id/account", validate(updateAccountSchema), accountController.updateAccount);

router.post("/:id/account/reset-password", accountController.resetPassword);

module.exports = router;
