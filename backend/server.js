// backend/.env, wherever the server is started from
require("dotenv").config({ path: require("path").join(__dirname, ".env"), quiet: true });

// Refuse to start with settings that would make the API unsafe or broken.
const configErrors = [];
if (!process.env.DATABASE_URL) configErrors.push("DATABASE_URL is not set.");
if (!process.env.JWT_SECRET) configErrors.push("JWT_SECRET is not set.");
else if (process.env.JWT_SECRET.length < 32) configErrors.push("JWT_SECRET must be at least 32 characters long.");

if (configErrors.length > 0) {
  configErrors.forEach((message) => console.error(message));
  console.error("Fix backend/.env (see .env.example) and start the server again.");
  process.exit(1);
}

const app = require("./src/app");
const prisma = require("./src/utils/prisma");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Finish in-flight requests and close the database pool before exiting.
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
