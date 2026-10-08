const AppError = require("../utils/AppError");

// Use after requireAuth: only lets accounts with one of the given roles through.
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      throw new AppError("You do not have permission to do this", 403);
    }
    next();
  };

module.exports = requireRole;
