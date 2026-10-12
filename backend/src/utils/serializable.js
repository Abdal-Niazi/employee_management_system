const prisma = require("./prisma");

const ATTEMPTS = 5;

// PostgreSQL refused the transaction because of another one running at the same time
// (serialization failure or deadlock). Prisma reports it as P2034, or, when it happens on a query
// inside the transaction, as the driver adapter's TransactionWriteConflict.
const isWriteConflict = (error) => error?.code === "P2034" || error?.cause?.kind === "TransactionWriteConflict";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs `work(tx)` in a Serializable transaction. PostgreSQL then refuses one of two transactions
// that would each act on what the other is changing (say, two overlapping leave requests sent at
// the same moment); the refused one runs again, after a short random pause, and sees the other's
// result.
const serializable = async (work) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isWriteConflict(error) || attempt === ATTEMPTS) throw error;
      await pause(Math.random() * 20 * attempt);
    }
  }
};

module.exports = serializable;
