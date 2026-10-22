// What the server checks about its settings before it starts. `errors` stop it (they would make the
// API unsafe or broken); `warnings` are settings that are probably a mistake and are only printed.
const checkConfig = (env = process.env) => {
  const errors = [];
  const warnings = [];

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set.");
  if (!env.JWT_SECRET) errors.push("JWT_SECRET is not set.");
  else if (env.JWT_SECRET.length < 32) errors.push("JWT_SECRET must be at least 32 characters long.");

  if (env.NODE_ENV === "production") {
    if (!env.TRUST_PROXY) {
      warnings.push(
        "TRUST_PROXY is not set. Behind a proxy or load balancer (Render, Railway, nginx and the like) every user then counts as one address for the rate limits, so a few wrong passwords from one person lock everybody out. Set TRUST_PROXY=1 (the number of proxies in front of the server). Leave it unset only if the server is reached directly."
      );
    }
    if (env.DATABASE_URL && /@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL)) {
      warnings.push("DATABASE_URL points at this machine. Is that the database you want in production?");
    }
  }

  return { errors, warnings };
};

module.exports = { checkConfig };
