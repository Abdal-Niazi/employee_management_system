const { z } = require("zod");

// Every text field has a maximum length, so nobody can store megabytes in a name.
const requiredString = (field, max = 100) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`)
    .max(max, `${field} must be at most ${max} characters`);

const optionalString = (field, max = 200) =>
  z.string().trim().max(max, `${field} must be at most ${max} characters`).nullish();

const createEmployeeSchema = z.object({
  employeeId: requiredString("employeeId", 50),
  firstName: requiredString("firstName"),
  lastName: requiredString("lastName"),
  // Stored in lower case, so the unique check also catches the same email in other casing.
  email: z
    .string({ error: "email must be a valid email address" })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "email must be a valid email address" }).max(254, "email is too long")),
  phone: optionalString("phone", 50),
  department: optionalString("department"),
  position: optionalString("position"),
  hireDate: z
    .string({ error: "hireDate is required" })
    .refine((value) => !Number.isNaN(Date.parse(value)), "hireDate must be a valid date")
    .transform((value) => new Date(value)),
  status: z
    .enum(["active", "inactive", "terminated"], {
      error: "status must be one of: active, inactive, terminated",
    })
    .optional(),
  // The employee's manager; null removes the link.
  managerId: z
    .number({ error: "managerId must be a number" })
    .int("managerId must be a positive integer")
    .positive("managerId must be a positive integer")
    .nullish(),
});

// Any subset of the create fields, but at least one of them.
const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: "No valid fields provided to update",
  });

module.exports = { createEmployeeSchema, updateEmployeeSchema };
