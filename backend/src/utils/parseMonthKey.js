const AppError = require("./AppError");

const MONTH_KEY = /^(20\d{2})-(0[1-9]|1[0-2])$/;

// A month written YYYY-MM (like 2026-10), or a 400.
const parseMonthKey = (value) => {
  if (typeof value !== "string" || !MONTH_KEY.test(value)) {
    throw new AppError("month must be a month like 2026-10", 400);
  }

  return value;
};

module.exports = parseMonthKey;
