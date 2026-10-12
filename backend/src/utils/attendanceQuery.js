const AppError = require("./AppError");
const { isRealDate } = require("../validators/attendanceSchema");

const MAX_DAYS = 31;

// ?date=YYYY-MM-DD, or `fallback` (today) when it's missing.
const parseDateParam = (value, fallback, label = "date") => {
  if (value === undefined || value === "") return fallback;

  if (typeof value !== "string" || !isRealDate(value)) {
    throw new AppError(`${label} must be a real date as YYYY-MM-DD`, 400);
  }

  return value;
};

// ?days=7 — how many days back, today included.
const parseDays = (value, fallback = 7) => {
  if (value === undefined || value === "") return fallback;

  const days = Number(value);

  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new AppError(`days must be a whole number from 1 to ${MAX_DAYS}`, 400);
  }

  return days;
};

module.exports = { parseDateParam, parseDays };
