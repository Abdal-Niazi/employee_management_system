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

const readYear = (name, fallback) => {
  const text = process.env[name];
  if (text === undefined || text === "") return fallback;

  const year = Number(text);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`${name} must be a year from 2000 to 2100 (got "${text}"). Fix backend/.env.`);
  }

  return year;
};

const ENTITLEMENTS = Object.freeze({
  Annual: readDays("LEAVE_ANNUAL_DAYS", 14),
  Sick: readDays("LEAVE_SICK_DAYS", 8),
  Casual: readDays("LEAVE_CASUAL_DAYS", 6),
});

// Days of Annual leave nobody took in a year move into the next one, up to LEAVE_CARRY_OVER_DAYS
// (0 turns carry-over off). The first year that gets carried days is LEAVE_CARRY_OVER_FIRST_YEAR,
// so earlier years keep the balance they always showed. Sick and casual days never carry over.
const CARRY_OVER = Object.freeze({
  type: "Annual",
  days: readDays("LEAVE_CARRY_OVER_DAYS", 5),
  firstYear: readYear("LEAVE_CARRY_OVER_FIRST_YEAR", 2027),
});

module.exports = { ENTITLEMENTS, CARRY_OVER, readDays };
