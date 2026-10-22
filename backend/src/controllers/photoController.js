const photoService = require("../services/photoService");
const AppError = require("../utils/AppError");
const parseId = require("../utils/parseId");
const prisma = require("../utils/prisma");

const notFound = () => new AppError("Photo not found", 404);

// The picture itself. Whoever may not see it gets the same 404 as when there is none, so the answer
// doesn't say who has a photo.
const getPhoto = async (req, res) => {
  const employeeId = parseId(req.params.employeeId, "Employee id");
  if (!(await photoService.canSee(req.admin, employeeId))) throw notFound();

  const photo = await photoService.getPhoto(employeeId);
  if (!photo) throw notFound();

  res
    .status(200)
    // The apps ask for it with ?v=<when it was set>, so a new photo is a new address and may be kept
    .set({ "Content-Type": photo.contentType, "Cache-Control": "private, max-age=86400" })
    .send(Buffer.from(photo.data));
};

// HR: set or replace a person's photo.
const putPhoto = async (req, res) => {
  const employeeId = parseId(req.params.employeeId, "Employee id");
  const bytes = photoService.parseJpeg(req.body.image);

  if (!(await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }))) {
    throw new AppError("Employee not found", 404);
  }

  const photoUpdatedAt = await photoService.setPhoto(employeeId, bytes);

  res.status(200).json({ message: "Photo saved", photoUpdatedAt });
};

// HR: remove a person's photo (their initials show again).
const deletePhoto = async (req, res) => {
  const employeeId = parseId(req.params.employeeId, "Employee id");

  if (!(await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }))) {
    throw new AppError("Employee not found", 404);
  }

  await photoService.removePhoto(employeeId);

  res.status(200).json({ message: "Photo removed" });
};

module.exports = { getPhoto, putPhoto, deletePhoto };
