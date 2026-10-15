-- Attendance keeps the exact moment of a check-in and check-out (in UTC) instead of "HH:MM" text.
-- Rows saved so far were company time (Asia/Karachi, the COMPANY_TIMEZONE default), so each one is
-- converted from that day and time; nothing is lost and no reset is needed.
ALTER TABLE "Attendance"
    ALTER COLUMN "checkIn" TYPE TIMESTAMP(3)
        USING ((("date" + "checkIn"::time) AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'UTC'),
    ALTER COLUMN "checkOut" TYPE TIMESTAMP(3)
        USING ((("date" + "checkOut"::time) AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'UTC');

-- Changes to a day's times: a manager's request that only HR approves, or a change HR made
-- directly (source HR, saved already approved). No check-in means HR removed the day's check-in.
-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'MANAGER',
    "requestedById" INTEGER,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "previousCheckIn" TIMESTAMP(3),
    "previousCheckOut" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- Registered phones: each person checks in from one phone; only a hash of its key is stored.
-- CreateTable
CREATE TABLE "RegisteredDevice" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "keyHash" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "RegisteredDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceCorrection_status_idx" ON "AttendanceCorrection"("status");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_employeeId_date_idx" ON "AttendanceCorrection"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredDevice_employeeId_key" ON "RegisteredDevice"("employeeId");

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisteredDevice" ADD CONSTRAINT "RegisteredDevice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
