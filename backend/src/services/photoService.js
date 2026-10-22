const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");

// An employee's photo is a small JPEG kept in the database. The app crops it to a square and shrinks
// it before sending (about 30 to 60 KB), so a generous limit still keeps the database small.
const MAX_BYTES = 200_000;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// The bytes of a JPEG sent as base64 text, or a 400. Only the file's start is checked: it is served
// back as image/jpeg with nosniff, so whatever else it holds can never run.
const parseJpeg = (text) => {
  const compact = text.replace(/\s+/g, "");
  if (!compact || !BASE64.test(compact)) throw new AppError("image must be a JPEG photo sent as base64 text", 400);

  const bytes = Buffer.from(compact, "base64");
  if (bytes.length > MAX_BYTES) {
    throw new AppError(`The photo is too big (${Math.round(bytes.length / 1000)} KB, at most ${MAX_BYTES / 1000} KB). Choose a smaller one.`, 400);
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new AppError("That isn't a JPEG photo", 400);
  }

  return bytes;
};

// Sets or replaces the photo and records when, in one step.
const setPhoto = async (employeeId, bytes) => {
  const [, employee] = await prisma.$transaction([
    prisma.employeePhoto.upsert({
      where: { employeeId },
      create: { employeeId, data: bytes },
      update: { data: bytes },
    }),
    prisma.employee.update({ where: { id: employeeId }, data: { photoUpdatedAt: new Date() }, select: { photoUpdatedAt: true } }),
  ]);

  return employee.photoUpdatedAt;
};

const removePhoto = async (employeeId) => {
  await prisma.$transaction([
    prisma.employeePhoto.deleteMany({ where: { employeeId } }),
    prisma.employee.update({ where: { id: employeeId }, data: { photoUpdatedAt: null } }),
  ]);
};

const getPhoto = (employeeId) => prisma.employeePhoto.findUnique({ where: { employeeId } });

// Whether the signed-in account may see this person's photo: HR sees everyone's, a manager their
// team's and their own, an employee their own, and a person's manager's (shown on their profile).
const canSee = async (admin, employeeId) => {
  if (admin.role === "HR_ADMIN") return true;
  if (!admin.employeeId) return false;
  if (admin.employeeId === employeeId) return true;

  const related = await prisma.employee.findFirst({
    where:
      admin.role === "MANAGER"
        ? { id: employeeId, managerId: admin.employeeId }
        : { id: admin.employeeId, managerId: employeeId },
    select: { id: true },
  });

  return Boolean(related);
};

module.exports = { MAX_BYTES, parseJpeg, setPhoto, removePhoto, getPhoto, canSee };
