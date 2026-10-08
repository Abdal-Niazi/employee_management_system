const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");

const BCRYPT_ROUNDS = 12;

// Compared against when the email doesn't exist, so a wrong email takes
// as long as a wrong password and doesn't reveal which emails are admins.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const toPublicAdmin = ({ id, email, name, role }) => ({ id, email, name, role });

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

const login = async (email, password) => {
  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  const passwordMatches = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);

  if (!admin || !passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.sign({ sub: String(admin.id) }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

  return { token, admin: toPublicAdmin(admin) };
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

  if (!admin) {
    throw new AppError("Invalid or expired token", 401);
  }

  return toPublicAdmin(admin);
};

module.exports = {
  hashPassword,
  login,
  getAdminFromToken,
};
