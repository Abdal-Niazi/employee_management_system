const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Behind a reverse proxy set TRUST_PROXY (e.g. 1) so req.ip is the real client's address,
// not the proxy's.
const limiter = (limit, windowMs, options = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later" },
    ...options,
  });

// Failed sign-ins count per address AND email. A whole office shares one address on its Wi-Fi,
// so a few typos must not lock everyone else out; guessing one account's password is still cut off.
const loginKey = (req) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
  return `${ipKeyGenerator(req.ip)}|${email}`;
};

// Signed-in requests count per login token, so an office behind one address doesn't share one
// allowance; everything else counts per address. Only a hash of the token is kept in memory.
const apiKey = (req) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme === "Bearer" && token) {
    return `token:${crypto.createHash("sha256").update(token).digest("base64url")}`;
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
};

// Failed logins only, so a brute-force attempt is cut off without locking out real users.
const loginLimiter = limiter(Number(process.env.LOGIN_RATE_LIMIT) || 10, 15 * 60 * 1000, {
  skipSuccessfulRequests: true,
  keyGenerator: loginKey,
  message: { message: "Too many failed sign-in attempts, please try again in 15 minutes" },
});

const apiLimiter = limiter(Number(process.env.API_RATE_LIMIT) || 300, 60 * 1000, { keyGenerator: apiKey });

module.exports = { loginLimiter, apiLimiter, loginKey, apiKey };
