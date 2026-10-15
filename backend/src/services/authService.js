const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");

const BCRYPT_ROUNDS = 12;

// Compared against when the email doesn't exist, so a wrong email takes
// as long as a wrong password and doesn't reveal which emails are admins.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

// employeeId is set for MANAGER and EMPLOYEE accounts: the employee the account belongs to.
const toPublicAdmin = ({ id, email, name, role, employeeId }) => ({ id, email, name, role, employeeId });

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

// A login token. It carries the account's tokenVersion, so raising that (a password change) ends
// every login made before.
const signToken = (admin) =>
  jwt.sign({ sub: String(admin.id), v: admin.tokenVersion }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

const login = async (email, password) => {
  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  const passwordMatches = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);

  if (!admin || !passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  return { token: signToken(admin), admin: toPublicAdmin(admin) };
};

// Returns the admin the token belongs to, or throws a 401.
const getAdminFromToken = async (token) => {
  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }

  const admin = await prisma.admin.findUnique({
    where: { id: Number(payload.sub) },
  });

  // Tokens from before versions existed carry none, which counts as 0 (no change yet).
  if (!admin || (payload.v ?? 0) !== admin.tokenVersion) {
    throw new AppError("Invalid or expired token", 401);
  }

  return toPublicAdmin(admin);
};

// The signed-in account changes its own password. Every other login of the account ends, and
// this one gets a new token back, so it stays signed in.
const changePassword = async (adminId, { currentPassword, newPassword }) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });

  // Not 401: the app signs out on a 401, and a typo shouldn't do that.
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw new AppError("Your current password isn't right", 400);
  }

  // Only if the password is still the one just checked, so of two changes sent at once only one
  // goes through (the other could otherwise undo it with its own new password).
  const { count } = await prisma.admin.updateMany({
    where: { id: adminId, passwordHash: admin.passwordHash },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  if (count === 0) {
    throw new AppError("Your password was just changed somewhere else. Sign in again with the new one.", 409);
  }

  const updated = await prisma.admin.findUnique({ where: { id: adminId } });
  return { token: signToken(updated), admin: toPublicAdmin(updated) };
};

module.exports = {
  hashPassword,
  login,
  getAdminFromToken,
  changePassword,
};
