const express = require("express");
const employeeController = require("../controllers/employeeController");
const validate = require("../middleware/validate");
const { createEmployeeSchema } = require("../validators/employeeSchema");

const router = express.Router();

router.post("/", validate(createEmployeeSchema), employeeController.createEmployee);

router.get("/", employeeController.getEmployees);

module.exports = router;
