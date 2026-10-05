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

module.exports = {
  createEmployee,
  getEmployees,
};