const prisma = require("../utils/prisma");

const createEmployee = async (employeeData) => {
  const employee = await prisma.employee.create({
    data: employeeData,
  });

  return employee;
};

// One page of employees plus the total count.
const getEmployees = async ({ page, pageSize }) => {
  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      orderBy: {
        id: "asc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count(),
  ]);

  return { employees, total };
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