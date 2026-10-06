const employeeService = require("../services/employeeService");
const AppError = require("../utils/AppError");

// Largest value a Postgres Int column can hold
const MAX_INT = 2147483647;

const parseId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1 || id > MAX_INT) {
    throw new AppError("Employee id must be a positive integer", 400);
  }

  return id;
};

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

const getEmployeeById = async (req, res) => {
  const employee = await employeeService.getEmployeeById(parseId(req.params.id));

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  res.status(200).json({
    message: "Employee retrieved successfully",
    employee,
  });
};

const updateEmployee = async (req, res) => {
  const employee = await employeeService.updateEmployee(parseId(req.params.id), req.body);

  res.status(200).json({
    message: "Employee updated successfully",
    employee,
  });
};

const deleteEmployee = async (req, res) => {
  const employee = await employeeService.deleteEmployee(parseId(req.params.id));

  res.status(200).json({
    message: "Employee deleted successfully",
    employee,
  });
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
