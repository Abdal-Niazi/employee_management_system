const { z } = require("zod");

const email = z
  .string({ error: "email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "email must be a valid email address" }));

const loginSchema = z.object({
  email,
  password: z.string({ error: "password is required" }).min(1, "password is required"),
});

const createAdminSchema = z.object({
  email,
  name: z.string({ error: "name is required" }).trim().min(1, "name is required"),
  password: z
    .string({ error: "password is required" })
    .min(8, "password must be at least 8 characters"),
});

module.exports = { loginSchema, createAdminSchema };
