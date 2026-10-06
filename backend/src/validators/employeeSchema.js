const { z } = require("zod");

const requiredString = (field) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`);

const optionalString = z.string().trim().nullish();

const createEmployeeSchema = z.object({
  employeeId: requiredString("employeeId"),
  firstName: requiredString("firstName"),
  lastName: requiredString("lastName"),
  email: z.email({ error: "email must be a valid email address" }),
  phone: optionalString,
  department: optionalString,
  position: optionalString,
  hireDate: z
    .string({ error: "hireDate is required" })
    .refine((value) => !Number.isNaN(Date.parse(value)), "hireDate must be a valid date")
    .transform((value) => new Date(value)),
  status: z
    .enum(["active", "inactive", "terminated"], {
      error: "status must be one of: active, inactive, terminated",
    })
    .optional(),
});

// Any subset of the create fields, but at least one of them.
const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: "No valid fields provided to update",
  });

module.exports = { createEmployeeSchema, updateEmployeeSchema };
