const { z } = require("zod");

// "2026-10-05" that is a real calendar day (not 2026-02-31).
const isRealDate = (text) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

const dateKey = z.string({ error: "date is required" }).refine(isRealDate, "date must be a real date as YYYY-MM-DD");

const timeOfDay = (field) =>
  z.string({ error: `${field} must be a time as HH:MM` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${field} must be a time as HH:MM (24-hour)`);

// Body of PUT /api/attendance
const recordAttendanceSchema = z
  .object({
    employeeId: z
      .number({ error: "employeeId must be a number" })
      .int("employeeId must be a positive integer")
      .positive("employeeId must be a positive integer"),
    date: dateKey,
    checkIn: timeOfDay("checkIn"),
    checkOut: timeOfDay("checkOut").nullish(),
  })
  .refine((data) => !data.checkOut || data.checkOut > data.checkIn, {
    path: ["checkOut"],
    error: "checkOut must be after checkIn",
  });

module.exports = { isRealDate, recordAttendanceSchema };
