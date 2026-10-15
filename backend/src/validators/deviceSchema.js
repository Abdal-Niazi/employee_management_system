const { z } = require("zod");

// Body of POST /api/me/device. The phone makes the key itself (32 random bytes, base64url) and
// saves it before sending, so a lost answer can't leave it registered without its key.
const registerDeviceSchema = z.object({
  platform: z.enum(["android", "ios"], { error: "platform must be android or ios" }).nullish(),
  key: z
    .string({ error: "key is required" })
    .regex(/^[A-Za-z0-9_-]{43,100}$/, { error: "key must be 43 to 100 letters, digits, - or _" }),
});

// Body of POST /api/employees/:id/device/approve. `registeredAt` is the waiting phone HR looked at;
// if another phone replaced it since, the approval is refused.
const approveDeviceSchema = z.object({
  registeredAt: z.iso.datetime({ error: "registeredAt must be a date and time" }).optional(),
});

module.exports = { registerDeviceSchema, approveDeviceSchema };
