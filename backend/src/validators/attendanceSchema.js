const { z } = require("zod");
const { isDateKey, isTime } = require("../utils/companyTime");

const CORRECTION_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const time = (field) => z.string({ error: `${field} is required` }).refine(isTime, `${field} must be a time like 09:05`);

const employeeId = z
  .number({ error: "employeeId must be a number" })
  .int("employeeId must be a positive integer")
  .positive("employeeId must be a positive integer")
  .max(2147483647, "employeeId is too large");

const date = z.string({ error: "date is required" }).refine(isDateKey, "date must be a date like 2026-10-09");

// "HH:MM" strings compare correctly as text
const checkOutAfterCheckIn = [
  (body) => !body.checkOut || body.checkOut > body.checkIn,
  { path: ["checkOut"], message: "checkOut must be after checkIn" },
];

// Body of POST /api/manager/attendance-corrections
const correctionRequestSchema = z
  .object({
    employeeId,
    date,
    checkIn: time("checkIn"),
    // Leave out to keep the check-out that is already recorded
    checkOut: time("checkOut").nullish(),
    reason: z
      .string({ error: "reason is required" })
      .trim()
      .min(3, "reason must be at least 3 characters")
      .max(500, "reason must be at most 500 characters"),
  })
  .refine(...checkOutAfterCheckIn);

// HR's optional note on a change it makes directly
const note = z.string().trim().max(500, "note must be at most 500 characters").nullish();

// Body of PUT /api/attendance (HR admins)
const recordAttendanceSchema = z
  .object({
    employeeId,
    date,
    checkIn: time("checkIn"),
    // Empty means no check-out
    checkOut: time("checkOut").nullish(),
    note,
  })
  .refine(...checkOutAfterCheckIn);

// Optional body of DELETE /api/attendance/:employeeId/:date (HR admins)
const clearAttendanceSchema = z.object({ note });

module.exports = { CORRECTION_STATUSES, correctionRequestSchema, recordAttendanceSchema, clearAttendanceSchema };
