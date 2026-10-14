// How many working days of each kind of leave an employee gets per calendar year. Everyone gets
// the same amount; change it in backend/.env (LEAVE_ANNUAL_DAYS, LEAVE_SICK_DAYS, LEAVE_CASUAL_DAYS).
// Checked once at startup, like the other settings.
const readDays = (name, fallback) => {
  const text = process.env[name];
  if (text === undefined || text === "") return fallback;

  const days = Number(text);
  if (!Number.isInteger(days) || days < 0 || days > 366) {
    throw new Error(`${name} must be a whole number of days from 0 to 366 (got "${text}"). Fix backend/.env.`);
  }

  return days;
};

const ENTITLEMENTS = Object.freeze({
  Annual: readDays("LEAVE_ANNUAL_DAYS", 14),
  Sick: readDays("LEAVE_SICK_DAYS", 8),
  Casual: readDays("LEAVE_CASUAL_DAYS", 6),
});

module.exports = { ENTITLEMENTS, readDays };
