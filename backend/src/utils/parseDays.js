const AppError = require("./AppError");

const MAX_HISTORY_DAYS = 31;

// How many days of attendance history to send (?days=), 7 when left out, or a 400.
const parseDays = (value) => {
  if (value === undefined) return 7;

  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
    throw new AppError(`days must be a whole number from 1 to ${MAX_HISTORY_DAYS}`, 400);
  }

  return days;
};

module.exports = parseDays;
