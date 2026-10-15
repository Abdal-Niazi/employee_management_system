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

// HR: let a waiting phone check in.
const approveDevice = async (req, res) => {
  const employee = await findEmployee(req);
  const device = await deviceService.approveDevice(employee.id, req.admin.id, req.body.registeredAt);

  res.status(200).json({
    message: "Phone approved",
    device,
  });
};

// HR: reject a waiting phone, or forget a lost or replaced one, so the person can register again.
const resetDevice = async (req, res) => {
  const employee = await findEmployee(req);
  await deviceService.resetDevice(employee.id);

  res.status(200).json({
    message: "Registered phone reset",
  });
};

module.exports = {
  getDevice,
  approveDevice,
  resetDevice,
};
