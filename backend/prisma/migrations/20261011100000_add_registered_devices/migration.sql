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
CREATE UNIQUE INDEX "RegisteredDevice_employeeId_key" ON "RegisteredDevice"("employeeId");

-- AddForeignKey
ALTER TABLE "RegisteredDevice" ADD CONSTRAINT "RegisteredDevice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

