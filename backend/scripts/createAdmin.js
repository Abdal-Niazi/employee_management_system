// Creates an HR admin account. Run from backend: npm run create-admin
require("dotenv").config({ quiet: true });

const readline = require("node:readline");
const prisma = require("../src/utils/prisma");
const authService = require("../src/services/authService");
const { createAdminSchema } = require("../src/validators/authSchema");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});

// Hide the password while it's typed
let muted = false;
const writeToOutput = rl._writeToOutput.bind(rl);
rl._writeToOutput = (text) => {
  if (!muted) writeToOutput(text);
};

const lines = rl[Symbol.asyncIterator]();

const ask = async (question, { hidden = false } = {}) => {
  process.stdout.write(question);
  muted = hidden;
  const { value = "" } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write("\n");
  return value;
};

const main = async () => {
  const input = {
    email: await ask("Email: "),
    name: await ask("Name: "),
    password: await ask("Password (min 8 characters): ", { hidden: true }),
  };

  const result = createAdminSchema.safeParse(input);

  if (!result.success) {
    result.error.issues.forEach((issue) => console.error(`- ${issue.message}`));
    process.exitCode = 1;
    return;
  }

  const { email, name, password } = result.data;

  if (await prisma.admin.findUnique({ where: { email } })) {
    console.error(`An admin with email ${email} already exists`);
    process.exitCode = 1;
    return;
  }

  const admin = await prisma.admin.create({
    data: { email, name, passwordHash: await authService.hashPassword(password) },
  });

  console.log(`Admin created: ${admin.email} (id ${admin.id})`);
};

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
