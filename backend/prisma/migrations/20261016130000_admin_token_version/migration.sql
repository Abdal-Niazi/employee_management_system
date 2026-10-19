-- Changing a password signs the account out everywhere else: each login (token) carries this
-- number, and a change raises it, so older logins stop working.
ALTER TABLE "Admin" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
