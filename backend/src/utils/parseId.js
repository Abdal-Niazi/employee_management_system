const AppError = require("./AppError");

// Largest value a Postgres Int column can hold
const MAX_INT = 2147483647;

// Turns a route or query value into a positive Int id, or throws a 400.
const parseId = (value, label = "id") => {
  const id = Number(value);

  if (value === undefined || value === "" || !Number.isInteger(id) || id < 1 || id > MAX_INT) {
    throw new AppError(`${label} must be a positive integer`, 400);
  }

  return id;
};

module.exports = parseId;
