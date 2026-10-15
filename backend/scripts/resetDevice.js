// HR: forgets an employee's registered phone (lost or replaced, or waiting and not theirs), so they
// can register their new one. The HR app does the same with "Reset phone" on the employee's screen.
// Run from backend: npm run reset-device -- EMP001   (the employee ID shown in the app)
require("dotenv").config({ quiet: true });

const prisma = require("../src/utils/prisma");
const deviceService = require("../src/services/deviceService");

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

const main = async () => {
  const code = (process.argv[2] ?? "").trim();
  if (!code) return fail("Give the employee ID shown in the app. Usage: npm run reset-device -- EMP001");

  const employee = await prisma.employee.findUnique({ where: { employeeId: code } });
  if (!employee) return fail(`No employee has the ID ${code}`);
  const { id } = employee;

  const name = `${employee.firstName} ${employee.lastName} (${employee.employeeId})`;
  try {
    await deviceService.resetDevice(id);
  } catch (error) {
    if (error.statusCode === 404) return fail(`${name} has no registered phone.`);
    throw error;
  }

  console.log(`Registered phone reset for ${name}. They can register their new phone now.`);
};

main()
  .catch((error) => {
    console.error("Failed to reset the phone:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
