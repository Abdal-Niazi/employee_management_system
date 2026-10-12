const { z } = require("zod");

// Body of POST /api/me/device
const registerDeviceSchema = z.object({
  platform: z.enum(["android", "ios"], { error: "platform must be android or ios" }).nullish(),
});

module.exports = { registerDeviceSchema };
