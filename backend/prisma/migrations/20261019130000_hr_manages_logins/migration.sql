-- HR creates and looks after the logins of employees: a temporary password has to be replaced at the
-- first sign-in (mustChangePassword), and a login can be turned off without deleting it (disabledAt).
ALTER TABLE "Admin" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "disabledAt" TIMESTAMP(3);
