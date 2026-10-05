const express = require("express");
const employeeController = require("../controllers/employeeController");

const router = express.Router();

router.post("/", employeeController.createEmployee);

router.get("/", employeeController.getEmployees);

module.exports = router;