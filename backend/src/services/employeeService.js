const prisma = require("../utils/prisma");

const createEmployee = async (employeeData) => {
  const employee = await prisma.employee.create({
    data: employeeData,
  });

  return employee;
};

const getEmployees = async () => {
  const employees = await prisma.employee.findMany({
    orderBy: {
      id: "asc",
    },
  });

  return employees;
};

const getEmployeeById = async (id) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
  });

  return employee;
};

const updateEmployee = async (id, employeeData) => {
  const employee = await prisma.employee.update({
    where: { id },
    data: employeeData,
  });

  return employee;
};

const deleteEmployee = async (id) => {
  const employee = await prisma.employee.delete({
    where: { id },
  });

  return employee;
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};