const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg(
  {
    connectionString: process.env.DATABASE_URL,
    // Wait at most this long for a database connection, instead of for ever. A hosted database that
    // went to sleep takes a moment to wake up.
    connectionTimeoutMillis: 15_000,
  },
  {
    // A dropped idle connection (say a hosted database going to sleep) is replaced by the pool on the
    // next request. Say so in the logs, so it shows up on the host.
    onPoolError: (error) => console.error("Database connection error:", error.message),
    onConnectionError: (error) => console.error("Database connection error:", error.message),
  }
);

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;