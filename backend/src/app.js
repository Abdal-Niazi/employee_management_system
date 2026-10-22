const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const prisma = require("./utils/prisma");
const { addressLimiter, loginLimiter } = require("./middleware/rateLimits");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const managerRoutes = require("./routes/managerRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const correctionRoutes = require("./routes/correctionRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const meRoutes = require("./routes/meRoutes");
const photoRoutes = require("./routes/photoRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const isProduction = process.env.NODE_ENV === "production";

// Browsers may only call the API from these origins (comma separated in CORS_ORIGINS).
// Without it, development allows any localhost port (Expo web) and production allows none.
// Native apps send no Origin header, so CORS doesn't affect them.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isLocalhost = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = allowedOrigins.length > 0 ? allowedOrigins.includes(origin) : !isProduction && isLocalhost(origin);
    callback(null, allowed);
  },
};

const app = express();

app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(helmet());
app.use(cors(corsOptions));
// A photo is sent as base64 text and is bigger than any other request: its own, larger limit, set
// before the general one (which skips a body that is already read).
app.use("/api/photos", express.json({ limit: "400kb" }));
app.use(express.json({ limit: "100kb" }));

app.use("/api", addressLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/attendance-corrections", correctionRoutes);
app.use("/api/leave-requests", leaveRoutes);
app.use("/api/me", meRoutes);
app.use("/api/photos", photoRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Employee Management System API is running",
  });
});

// For uptime checks: says whether the API can reach the database, nothing more.
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({ status: "unavailable" });
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
