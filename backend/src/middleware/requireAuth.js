const authService = require("../services/authService");
const AppError = require("../utils/AppError");
const { userLimiter } = require("./rateLimits");

// Expects "Authorization: Bearer <token>" and attaches the admin to req.admin. Then the
// account's own request allowance applies, keyed by the verified account, never by the token.
const requireAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authentication required", 401);
  }

  req.admin = await authService.getAdminFromToken(token);
  return userLimiter(req, res, next);
};

module.exports = requireAuth;
