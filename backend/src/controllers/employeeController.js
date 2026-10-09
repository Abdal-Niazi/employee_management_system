const employeeService = require("../services/employeeService");
const AppError = require("../utils/AppError");
const parseIdValue = require("../utils/parseId");

const parseId = (value) => parseIdValue(value, "Employee id");

// ?page=&pageSize= on the list; a page is never bigger than MAX_PAGE_SIZE.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const parsePage = (value, fallback, label) => {
  if (value === undefined) return fallback;
  return parseIdValue(value, label);
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
  const page = parsePage(req.query.page, 1, "page");
  const pageSize = parsePage(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize");

  if (pageSize > MAX_PAGE_SIZE) {
    throw new AppError(`pageSize must be at most ${MAX_PAGE_SIZE}`, 400);
  }

  const { employees, total } = await employeeService.getEmployees({ page, pageSize });

  res.status(200).json({
    message: "Employees retrieved successfully",
    employees,
    pagination: { page, pageSize, total },
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
  const id = parseId(req.params.id);

  if (req.body.managerId === id) {
    throw new AppError("An employee can't be their own manager", 400);
  }

  const employee = await employeeService.updateEmployee(id, req.body);

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
