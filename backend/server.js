// backend/.env, wherever the server is started from
require("dotenv").config({ path: require("path").join(__dirname, ".env"), quiet: true });

// Refuse to start with settings that would make the API unsafe or broken, and warn about the ones
// that are probably a mistake.
const { errors: configErrors, warnings: configWarnings } = require("./src/utils/config").checkConfig();

configWarnings.forEach((message) => console.warn(`Warning: ${message}`));

if (configErrors.length > 0) {
  configErrors.forEach((message) => console.error(message));
  console.error("Fix backend/.env (see .env.example), or the settings of your host, and start the server again.");
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
