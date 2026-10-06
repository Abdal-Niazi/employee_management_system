const authService = require("../services/authService");
const AppError = require("../utils/AppError");

// Expects "Authorization: Bearer <token>" and attaches the admin to req.admin.
const requireAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authentication required", 401);
  }

  req.admin = await authService.getAdminFromToken(token);
  next();
};

module.exports = requireAuth;
