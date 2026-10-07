const prisma = require("../utils/prisma");

const getManager = async (managerId) => {
  const manager = await prisma.employee.findUnique({
    where: { id: managerId },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
  });

  return manager;
};

// Everyone whose manager is managerId.
const getTeam = async (managerId) => {
  const team = await prisma.employee.findMany({
    where: { managerId },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return team;
};

// One employee, but only if they're in managerId's team.
const getTeamMember = async (managerId, id) => {
  const employee = await prisma.employee.findFirst({
    where: { id, managerId },
  });

  return employee;
};

module.exports = {
  getManager,
  getTeam,
  getTeamMember,
};
