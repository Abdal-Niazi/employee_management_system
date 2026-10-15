-- Attendance changes are history, so they stay when the employee is deleted: each row keeps who
-- it was for (employee ID and name), and only the link to the employee becomes null.
ALTER TABLE "AttendanceCorrection" ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "employeeName" TEXT;

UPDATE "AttendanceCorrection" AS c
SET "employeeCode" = e."employeeId", "employeeName" = TRIM(e."firstName" || ' ' || e."lastName")
FROM "Employee" AS e
WHERE e."id" = c."employeeId";

-- AlterTable
ALTER TABLE "AttendanceCorrection" ALTER COLUMN "employeeId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "AttendanceCorrection" DROP CONSTRAINT "AttendanceCorrection_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
