-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "employeeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_employeeId_key" ON "Admin"("employeeId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

