const { z } = require("zod");

const email = z
  .string({ error: "email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "email must be a valid email address" }).max(254, "email is too long"));

const loginSchema = z.object({
  email,
  // Capped so a huge body can't be fed to bcrypt; real passwords are far shorter.
  password: z
    .string({ error: "password is required" })
    .min(1, "password is required")
    .max(200, "password is too long"),
});

const createAdminSchema = z
  .object({
    email,
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, "name is required")
      .max(100, "name must be at most 100 characters"),
    role: z.enum(["HR_ADMIN", "MANAGER", "EMPLOYEE"], { error: "role must be HR_ADMIN, MANAGER or EMPLOYEE" }),
    // The employee a MANAGER or EMPLOYEE account belongs to (their database id)
    employeeId: z
      .number({ error: "employeeId must be a number" })
      .int("employeeId must be a positive integer")
      .positive("employeeId must be a positive integer")
      .nullish(),
    password: z
      .string({ error: "password is required" })
      .min(8, "password must be at least 8 characters")
      // bcrypt ignores everything after 72 bytes, so longer passwords would be silently cut.
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "password must be at most 72 bytes"),
  })
  .refine((data) => data.role === "HR_ADMIN" || data.employeeId, {
    error: "A MANAGER or EMPLOYEE account needs the employeeId of the employee it belongs to",
    path: ["employeeId"],
  })
  .refine((data) => data.role !== "HR_ADMIN" || !data.employeeId, {
    error: "Only MANAGER and EMPLOYEE accounts are linked to an employee",
    path: ["employeeId"],
  });

module.exports = { loginSchema, createAdminSchema };
