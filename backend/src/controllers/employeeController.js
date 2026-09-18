const employeeService = require("../services/employeeService");

const createEmployee = async (req, res) => {
  try {
    const employee = await employeeService.createEmployee(req.body);

    res.status(201).json({
      message: "Employee created successfully",
      employee,
    });
  } catch (error) {
    console.error("Create employee error:", error);

    res.status(500).json({
      message: "Failed to create employee",
    });
  }
};

module.exports = {
  createEmployee,
};