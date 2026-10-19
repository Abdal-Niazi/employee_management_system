const { z } = require("zod");
const { LINKED_ROLES, email } = require("./authSchema");

const role = z.enum(LINKED_ROLES, { error: "role must be MANAGER or EMPLOYEE" });

// Body of POST /api/employees/:id/account. Without an email, the employee's own is used.
const createAccountSchema = z.object({
  email: email.optional(),
  role,
});

// Body of PATCH /api/employees/:id/account: switch the role, turn the login off or on, or both
const updateAccountSchema = z
  .object({
    role: role.optional(),
    disabled: z.boolean({ error: "disabled must be true or false" }).optional(),
  })
  .refine((data) => data.role !== undefined || data.disabled !== undefined, {
    error: "Send a role, disabled, or both",
    path: ["role"],
  });

module.exports = { createAccountSchema, updateAccountSchema };
