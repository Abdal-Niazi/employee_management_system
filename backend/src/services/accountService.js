const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const authService = require("./authService");
const { generateTemporaryPassword } = require("../utils/temporaryPassword");

// HR looks after the logins of employees (accounts that belong to an employee: MANAGER or
// EMPLOYEE). HR admin accounts themselves are never reached from here.

const toAccountDto = (admin) =>
  admin && {
    email: admin.email,
    role: admin.role,
    status: admin.disabledAt ? "DISABLED" : "ACTIVE",
    // Still on the temporary password HR handed out
    mustChangePassword: admin.mustChangePassword,
    createdAt: admin.createdAt.toISOString(),
  };

const findAccount = (employeeId) => prisma.admin.findUnique({ where: { employeeId } });

const requireAccount = async (employeeId) => {
  const admin = await findAccount(employeeId);
  if (!admin) throw new AppError("This employee has no login", 404);
  return admin;
};

// A login for an employee, with a temporary password that is shown to HR once (only its hash is
// kept). The person has to choose their own at their first sign-in.
const createAccount = async (employee, { email, role }) => {
  if (employee.status !== "active") {
    throw new AppError("This employee isn't active, so they can't get a login", 409);
  }
  if (await findAccount(employee.id)) {
    throw new AppError("This employee already has a login", 409);
  }

  const loginEmail = (email ?? employee.email).toLowerCase();
  if (await prisma.admin.findUnique({ where: { email: loginEmail } })) {
    throw new AppError("That email is already used by another login", 409);
  }

  const temporaryPassword = generateTemporaryPassword();
  const admin = await prisma.admin.create({
    data: {
      email: loginEmail,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      role,
      employeeId: employee.id,
      passwordHash: await authService.hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
  });

  return { account: toAccountDto(admin), temporaryPassword };
};

// For a forgotten password: a new temporary one, shown to HR once. Every login the person had is
// signed out, and they have to choose their own again.
const resetPassword = async (employeeId) => {
  const existing = await requireAccount(employeeId);

  const temporaryPassword = generateTemporaryPassword();
  const admin = await prisma.admin.update({
    where: { id: existing.id },
    data: {
      passwordHash: await authService.hashPassword(temporaryPassword),
      tokenVersion: { increment: 1 },
      mustChangePassword: true,
    },
  });

  return { account: toAccountDto(admin), temporaryPassword };
};

// Turn a login off or on, and/or switch it between EMPLOYEE and MANAGER. Either one signs out the
// logins made before, so a person never keeps the old role or comes back from a turned-off login.
const updateAccount = async (employeeId, { role, disabled }) => {
  const existing = await requireAccount(employeeId);

  const data = {};
  if (role !== undefined && role !== existing.role) data.role = role;
  if (disabled !== undefined && disabled !== Boolean(existing.disabledAt)) {
    data.disabledAt = disabled ? new Date() : null;
  }
  if (Object.keys(data).length === 0) return toAccountDto(existing);

  const admin = await prisma.admin.update({
    where: { id: existing.id },
    data: { ...data, tokenVersion: { increment: 1 } },
  });

  return toAccountDto(admin);
};

module.exports = { toAccountDto, findAccount, createAccount, resetPassword, updateAccount };
