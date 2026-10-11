-- HR admins also change attendance directly, and each change is kept as an approved correction
-- (source HR). A correction without a check-in means HR removed that day's check-in.
ALTER TABLE "AttendanceCorrection" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANAGER';
ALTER TABLE "AttendanceCorrection" ALTER COLUMN "checkIn" DROP NOT NULL;
