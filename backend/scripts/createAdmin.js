// Creates an HR admin or manager account. Run from backend: npm run create-admin
require("dotenv").config({ quiet: true });

const prisma = require("../src/utils/prisma");
const authService = require("../src/services/authService");
const { createAdminSchema } = require("../src/validators/authSchema");

// Input is read straight from stdin rather than through readline, whose line
// redrawing garbles prompts in some Windows terminals. Normal answers use the
// terminal's own line editing; the password switches to raw mode so each key
// can be shown as "*". Piped input (one answer per line) also works.
let pending = "";
let inputEnded = false;
let skipNextNewline = false;
let onInput = null;

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  pending += chunk;
  onInput?.();
});
process.stdin.on("end", () => {
  inputEnded = true;
  onInput?.();
});

const ask = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    const masked = hidden && process.stdin.isTTY;
    let answer = "";

    const finish = () => {
      onInput = null;
      process.stdin.pause();
      if (masked) {
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
      }
      resolve(answer);
    };

    onInput = () => {
      for (const char of pending) {
        pending = pending.slice(char.length);

        if (char === "\n" && skipNextNewline) {
          skipNextNewline = false;
          continue;
        }
        skipNextNewline = char === "\r";

        if (char === "\r" || char === "\n") return finish();

        if (char === "\u0003") {
          // Ctrl+C arrives as a character in raw mode
          process.stdin.setRawMode(false);
          process.stdout.write("\nCancelled\n");
          process.exit(130);
        }

        if (char === "\b" || char === "\u007f") {
          if (answer.length > 0) {
            answer = answer.slice(0, -1);
            if (masked) process.stdout.write("\b \b");
          }
          continue;
        }

        answer += char;
        if (masked) process.stdout.write("*");
      }

      if (inputEnded) finish();
    };

    process.stdout.write(question);
    if (masked) process.stdin.setRawMode(true);
    process.stdin.resume();
    onInput();
  });

const main = async () => {
  const input = {
    email: await ask("Email: "),
    name: await ask("Name: "),
    role: (await ask("Role (HR_ADMIN, MANAGER or EMPLOYEE) [HR_ADMIN]: ")).trim().toUpperCase() || "HR_ADMIN",
  };

  // Manager and employee accounts belong to one employee (a manager's team is the people reporting to them).
  if (input.role === "MANAGER" || input.role === "EMPLOYEE") {
    const answer = (await ask("Employee database id this account belongs to: ")).trim();
    input.employeeId = answer === "" ? null : Number(answer);
  }

  input.password = await ask("Password (min 8 characters): ", { hidden: true });

  const result = createAdminSchema.safeParse(input);

  if (!result.success) {
    result.error.issues.forEach((issue) => console.error(`- ${issue.message}`));
    process.exitCode = 1;
    return;
  }

  const { email, name, role, employeeId, password } = result.data;

  if (await prisma.admin.findUnique({ where: { email } })) {
    console.error(`An account with email ${email} already exists`);
    process.exitCode = 1;
    return;
  }

  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { account: true } });

    if (!employee) {
      console.error(`No employee has id ${employeeId}`);
      process.exitCode = 1;
      return;
    }

    if (employee.account) {
      console.error(`Employee ${employeeId} already has an account (${employee.account.email})`);
      process.exitCode = 1;
      return;
    }
  }

  const admin = await prisma.admin.create({
    data: { email, name, role, employeeId: employeeId ?? null, passwordHash: await authService.hashPassword(password) },
  });

  const linked = admin.employeeId ? `, employee ${admin.employeeId}` : "";
  console.log(`${admin.role} created: ${admin.email} (id ${admin.id}${linked})`);
};

main()
  .catch((error) => {
    console.error("Failed to create admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
