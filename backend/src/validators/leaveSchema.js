const { z } = require("zod");
const { isRealDate } = require("./attendanceSchema");

const LEAVE_TYPES = ["Annual", "Sick", "Casual"];
const MAX_LEAVE_DAYS = 60;

const dateKey = (field) =>
  z.string({ error: `${field} is required` }).refine(isRealDate, `${field} must be a real date as YYYY-MM-DD`);

// Body of POST /api/me/leave-requests
const createLeaveSchema = z
  .object({
    type: z.enum(LEAVE_TYPES, { error: `type must be one of: ${LEAVE_TYPES.join(", ")}` }),
    startDate: dateKey("startDate"),
    endDate: dateKey("endDate"),
    reason: z.string().trim().max(500, "reason must be at most 500 characters").nullish(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ["endDate"],
    error: "endDate can't be before startDate",
  });

module.exports = { LEAVE_TYPES, MAX_LEAVE_DAYS, createLeaveSchema };
