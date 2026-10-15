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

const ipKey = (req) => `ip:${ipKeyGenerator(req.ip)}`;

// Failed sign-ins count per address AND email, so a few typos on a shared office Wi-Fi don't lock
// everyone else out while guessing one account's password is still cut off...
const loginKey = (req) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
  return `${ipKeyGenerator(req.ip)}|${email}`;
};

// ...and per address as well, with a bigger allowance, so one address can't try a password
// against every account.
const loginAccountLimiter = limiter(Number(process.env.LOGIN_RATE_LIMIT) || 10, 15 * 60 * 1000, {
  skipSuccessfulRequests: true,
  keyGenerator: loginKey,
  message: { message: "Too many failed sign-in attempts, please try again in 15 minutes" },
});
const loginAddressLimiter = limiter(Number(process.env.LOGIN_IP_RATE_LIMIT) || 50, 15 * 60 * 1000, {
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  message: { message: "Too many failed sign-in attempts from this network, please try again in 15 minutes" },
});
const loginLimiter = [loginAddressLimiter, loginAccountLimiter];

// Every API request counts per address before anything else, whatever token it carries (a made-up
// token doesn't get a fresh allowance). The allowance is big enough for an office on one address.
const addressLimiter = limiter(Number(process.env.IP_RATE_LIMIT) || 1000, 60 * 1000, { keyGenerator: ipKey });

// Once the token is verified, each signed-in account also has its own allowance (see requireAuth).
const userKey = (req) => `user:${req.admin.id}`;
const userLimiter = limiter(Number(process.env.API_RATE_LIMIT) || 300, 60 * 1000, { keyGenerator: userKey });

// Failed password changes count per account like failed sign-ins, so a login someone else got
// hold of can't be used to guess the password.
const passwordChangeLimiter = limiter(Number(process.env.LOGIN_RATE_LIMIT) || 10, 15 * 60 * 1000, {
  skipSuccessfulRequests: true,
  keyGenerator: userKey,
  message: { message: "Too many failed attempts, please try again in 15 minutes" },
});

module.exports = { loginLimiter, addressLimiter, userLimiter, passwordChangeLimiter, ipKey, loginKey, userKey };
