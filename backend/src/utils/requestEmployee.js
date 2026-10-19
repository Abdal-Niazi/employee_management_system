const employeeService = require("../services/employeeService");
const AppError = require("./AppError");
const parseId = require("./parseId");

// The employee named by `:id` in the route, or a 404. For the HR routes that act on one person.
const requestEmployee = async (req) => {
  const employee = await employeeService.getEmployeeById(parseId(req.params.id, "Employee id"));

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
};

module.exports = requestEmployee;
