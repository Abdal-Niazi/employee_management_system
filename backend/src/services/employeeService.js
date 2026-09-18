const prisma = require("../utils/prisma");

const createEmployee = async (employeeData) => {
  const employee = await prisma.employee.create({
    data: employeeData,
  });

  return employee;
};

module.exports = {
  createEmployee,
};