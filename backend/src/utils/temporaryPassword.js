const crypto = require("crypto");

// Letters and digits that can't be mistaken for each other when read out or typed (no 0/O, 1/l/I).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// A temporary password for HR to hand to someone: three groups of four, like "Kx7m-Qp3n-Rw9t"
// (12 random characters, about 69 bits). The person replaces it at their first sign-in.
const generateTemporaryPassword = () => {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("")
  );

  return groups.join("-");
};

module.exports = { generateTemporaryPassword };
