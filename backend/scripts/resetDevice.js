// HR: forgets an employee's registered phone (lost or replaced), so they can register their new one.
// Run from backend: npm run reset-device -- <employee database id>
require("dotenv").config({ quiet: true });

const prisma = require("../src/utils/prisma");
const deviceService = require("../src/services/deviceService");
const parseId = require("../src/utils/parseId");

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

const main = async () => {
  let id;
  try {
    id = parseId(process.argv[2], "The employee database id");
  } catch (error) {
    return fail(`${error.message}. Usage: npm run reset-device -- <employee database id>`);
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return fail(`No employee has id ${id}`);

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
