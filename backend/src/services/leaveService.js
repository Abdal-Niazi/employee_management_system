const prisma = require("../utils/prisma");
const AppError = require("../utils/AppError");
const managerService = require("./managerService");

// ---------- HR admin: every employee's leave ----------

// All leave requests, optionally only one status. Pending first, soonest first.
const listAll = async (status) => {
  const rows = await prisma.leaveRequest.findMany({
    where: status ? { status } : {},
    include: managerService.leaveInclude,
  });

  return rows.map(managerService.toLeaveDto).sort(managerService.compareLeave);
};

// An HR admin approves or rejects any pending request, whoever the employee's manager is.
const decide = async (adminId, id, { status, note }) => {
  const existing = await prisma.leaveRequest.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError("Leave request not found", 404);
  }

  // Only a still-pending request changes, checked in the same statement as the update,
  // so a manager and HR can't both decide the same request.
  const { count } = await prisma.leaveRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status,
      decidedAt: new Date(),
      decidedById: null,
      decidedByAdminId: adminId,
      decisionNote: note || null,
    },
  });

  if (count === 0) {
    throw new AppError("This request has already been decided", 409);
  }

  const updated = await prisma.leaveRequest.findUnique({ where: { id }, include: managerService.leaveInclude });
  return managerService.toLeaveDto(updated);
};

module.exports = { listAll, decide };
