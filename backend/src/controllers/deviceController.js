const deviceService = require("../services/deviceService");
const employeeService = require("../services/employeeService");
const AppError = require("../utils/AppError");
const parseId = require("../utils/parseId");

const findEmployee = async (req) => {
  const employee = await employeeService.getEmployeeById(parseId(req.params.id, "Employee id"));

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
};

// HR: whether an employee has a registered phone, and when it was last used. The key never leaves.
const getDevice = async (req, res) => {
  const employee = await findEmployee(req);
  const device = await deviceService.getDevice(employee.id);

  res.status(200).json({
    message: "Registered phone retrieved successfully",
    registered: Boolean(device),
    device: deviceService.toDeviceDto(device),
  });
};

// HR: forget a lost or replaced phone, so the person can register their new one.
const resetDevice = async (req, res) => {
  const employee = await findEmployee(req);
  await deviceService.resetDevice(employee.id);

  res.status(200).json({
    message: "Registered phone reset",
  });
};

module.exports = {
  getDevice,
  resetDevice,
};
