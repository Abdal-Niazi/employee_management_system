const authService = require("../services/authService");
const AppError = require("../utils/AppError");
const { userLimiter } = require("./rateLimits");

// With a temporary password from HR, only these are open: who you are, and choosing your own password.
const OPEN_WITH_TEMPORARY_PASSWORD = ["/api/auth/me", "/api/auth/change-password"];

// Expects "Authorization: Bearer <token>" and attaches the admin to req.admin. Then the
// account's own request allowance applies, keyed by the verified account, never by the token.
const requireAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authentication required", 401);
  }

  req.admin = await authService.getAdminFromToken(token);

  if (req.admin.mustChangePassword && !OPEN_WITH_TEMPORARY_PASSWORD.includes(req.originalUrl.split("?")[0])) {
    throw new AppError("Choose your own password first: you are using a temporary one", 403);
  }

  return userLimiter(req, res, next);
};

module.exports = requireAuth;
