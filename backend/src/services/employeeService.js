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
      include: { device: { select: { status: true } } },
    }),
    prisma.employee.count(),
  ]);

  // phoneStatus: null (no phone), PENDING (waiting for HR) or APPROVED, so the list can flag waiting ones
  return { employees: employees.map(({ device, ...employee }) => ({ ...employee, phoneStatus: device?.status ?? null })), total };
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

// Their leave, attendance and phone go with them. Attendance changes are history and stay (with
// the person's name and ID saved on each one); only requests still waiting for HR are removed,
// since nobody can decide them any more.
const deleteEmployee = async (id) => {
  const [, employee] = await prisma.$transaction([
    prisma.attendanceCorrection.deleteMany({ where: { employeeId: id, status: "PENDING" } }),
    prisma.employee.delete({ where: { id } }),
  ]);

  return employee;
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};