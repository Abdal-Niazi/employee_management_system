const crypto = require("crypto");
const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const serializable = require("../utils/serializable");

// Each person checks in from one registered phone. The phone makes a random key, saves it in its
// secure storage first and then registers it; it sends the key with every check-in and check-out
// in this header. The server keeps only the key's SHA-256 hash, so even someone who reads the
// database can't check anyone in. A new phone waits until an HR admin approves it, so knowing
// someone's password isn't enough to register a phone for them.
const DEVICE_KEY_HEADER = "X-Device-Key";

const hashKey = (key) => crypto.createHash("sha256").update(key).digest();

// Whether `key` is this device's key, compared in constant time so the timing gives nothing away.
const keyMatches = (device, key) =>
  typeof key === "string" &&
  key.length > 0 &&
  key.length <= 100 &&
  crypto.timingSafeEqual(Buffer.from(device.keyHash, "hex"), hashKey(key));

const approverName = (device) => device.approvedBy?.name ?? null;

const toDeviceDto = (device) =>
  device && {
    status: device.status,
    platform: device.platform,
    registeredAt: device.createdAt.toISOString(),
    approvedAt: device.approvedAt ? device.approvedAt.toISOString() : null,
    approvedBy: approverName(device),
    lastUsedAt: device.lastUsedAt ? device.lastUsedAt.toISOString() : null,
  };

const getDevice = (employeeId) =>
  prisma.registeredDevice.findUnique({ where: { employeeId }, include: { approvedBy: { select: { name: true } } } });

// For the person's own Today card: the phone's status, and whether `key` (sent by the phone
// asking, if it has one) is the registered one. Null when no phone is registered.
const ownDevice = async (employeeId, key) => {
  const device = await getDevice(employeeId);
  if (!device) return null;

  return { status: device.status, platform: device.platform, thisPhone: keyMatches(device, key) };
};

// Registers the phone this person will check in from; it waits for HR. Registering again while it
// still waits replaces it (for example when the first attempt's answer never arrived); an approved
// phone stays until HR resets it.
const registerDevice = async (employee, { platform, key }) => {
  const device = await serializable(async (tx) => {
    const existing = await tx.registeredDevice.findUnique({ where: { employeeId: employee.id } });
    if (existing?.status === "APPROVED") {
      throw new AppError("A phone is already registered for you. If you changed phones, ask HR to reset it.", 409);
    }

    const data = { keyHash: hashKey(key).toString("hex"), platform: platform ?? null, status: "PENDING", createdAt: new Date() };
    return existing
      ? tx.registeredDevice.update({ where: { id: existing.id }, data })
      : tx.registeredDevice.create({ data: { employeeId: employee.id, ...data } });
  });

  return toDeviceDto({ ...device, approvedBy: null });
};

// Throws unless `key` is the key of this person's approved phone; returns that phone.
const verifyDevice = async (employee, key) => {
  const device = await getDevice(employee.id);
  if (!device) {
    throw new AppError("Register this phone before checking in", 403);
  }

  if (!keyMatches(device, key)) {
    throw new AppError("Check in from your registered phone. If you changed phones, ask HR to reset it.", 403);
  }

  if (device.status !== "APPROVED") {
    throw new AppError("This phone is waiting for HR to approve it", 403);
  }

  return device;
};

// After a check-in or check-out went through (not a refused one), so HR sees when it was last used.
// updateMany, so a phone HR reset a moment ago doesn't turn a saved check-in into an error.
const markUsed = (device) => prisma.registeredDevice.updateMany({ where: { id: device.id }, data: { lastUsedAt: new Date() } });

// HR: lets the waiting phone HR looked at (registered at `registeredAt`) check in. Checked in the
// same statement as the change, so it can't approve a phone that was just reset or replaced.
const approveDevice = async (employeeId, adminId, registeredAt) => {
  const { count } = await prisma.registeredDevice.updateMany({
    where: { employeeId, status: "PENDING", createdAt: new Date(registeredAt) },
    data: { status: "APPROVED", approvedById: adminId, approvedAt: new Date() },
  });

  if (count === 0) {
    const device = await getDevice(employeeId);
    if (!device) throw new AppError("This employee has no phone waiting for approval", 404);
    if (device.status === "APPROVED") throw new AppError("This phone is already approved", 409);
    throw new AppError("The waiting phone changed since you opened this screen. Check it again.", 409);
  }

  return toDeviceDto(await getDevice(employeeId));
};

// HR: rejects a waiting phone, or forgets a lost or replaced one, so the person can register again.
// With `registeredAt` (the phone HR looked at) only that phone goes, checked in the same statement.
const resetDevice = async (employeeId, registeredAt) => {
  const { count } = await prisma.registeredDevice.deleteMany({
    where: { employeeId, ...(registeredAt && { createdAt: new Date(registeredAt) }) },
  });
  if (count === 0) {
    if (registeredAt && (await getDevice(employeeId))) {
      throw new AppError("The phone changed since you opened this screen. Check it again.", 409);
    }
    throw new AppError("This employee has no registered phone", 404);
  }
};

module.exports = {
  DEVICE_KEY_HEADER,
  toDeviceDto,
  getDevice,
  ownDevice,
  registerDevice,
  verifyDevice,
  markUsed,
  approveDevice,
  resetDevice,
};
