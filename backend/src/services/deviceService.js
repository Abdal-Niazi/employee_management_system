const crypto = require("crypto");
const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");

// Each person checks in from one registered phone. When it registers, the phone gets a random key
// (shown only that once) and sends it with every check-in and check-out in this header. The server
// keeps only the key's SHA-256 hash, so even someone who reads the database can't check anyone in.
const DEVICE_KEY_HEADER = "X-Device-Key";

const hashKey = (key) => crypto.createHash("sha256").update(key).digest();

const toDeviceDto = (device) =>
  device && {
    platform: device.platform,
    registeredAt: device.createdAt.toISOString(),
    lastUsedAt: device.lastUsedAt ? device.lastUsedAt.toISOString() : null,
  };

const getDevice = (employeeId) => prisma.registeredDevice.findUnique({ where: { employeeId } });

const isRegistered = async (employeeId) => Boolean(await getDevice(employeeId));

// Registers the phone this person will check in from, and returns its key (only this once).
const registerDevice = async (employee, { platform }) => {
  const key = crypto.randomBytes(32).toString("base64url");

  try {
    const device = await prisma.registeredDevice.create({
      data: { employeeId: employee.id, keyHash: hashKey(key).toString("hex"), platform: platform ?? null },
    });
    return { key, device: toDeviceDto(device) };
  } catch (error) {
    // One phone per person (a unique key), so a second registration fails here, even two at once.
    if (error.code === "P2002") {
      throw new AppError("A phone is already registered for you. If you changed phones, ask HR to reset it.", 409);
    }
    throw error;
  }
};

// Throws unless `key` is the key of this person's registered phone.
const verifyDevice = async (employee, key) => {
  const device = await getDevice(employee.id);
  if (!device) {
    throw new AppError("Register this phone before checking in", 403);
  }

  // Compared in constant time, so the answer's timing gives nothing away.
  const matches =
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 100 &&
    crypto.timingSafeEqual(Buffer.from(device.keyHash, "hex"), hashKey(key));

  if (!matches) {
    throw new AppError("Check in from your registered phone. If you changed phones, ask HR to reset it.", 403);
  }

  await prisma.registeredDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
};

// HR: forget a lost or replaced phone, so the person can register their new one.
const resetDevice = async (employeeId) => {
  const { count } = await prisma.registeredDevice.deleteMany({ where: { employeeId } });
  if (count === 0) {
    throw new AppError("This employee has no registered phone", 404);
  }
};

module.exports = {
  DEVICE_KEY_HEADER,
  toDeviceDto,
  getDevice,
  isRegistered,
  registerDevice,
  verifyDevice,
  resetDevice,
};
