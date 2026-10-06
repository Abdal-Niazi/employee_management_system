const employeeService = require("../services/employeeService");

// Express 5 forwards rejected promises to the error handler,
// so these handlers don't need their own try/catch.
const createEmployee = async (req, res) => {
  const employee = await employeeService.createEmployee(req.body);

  res.status(201).json({
    message: "Employee created successfully",
    employee,
  });
};

const getEmployees = async (req, res) => {
  const employees = await employeeService.getEmployees();

  res.status(200).json({
    message: "Employees retrieved successfully",
    employees,
  });
};

module.exports = {
  createEmployee,
  getEmployees,
};
