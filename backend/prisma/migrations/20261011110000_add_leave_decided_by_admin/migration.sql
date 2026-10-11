-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "decidedByAdminId" INTEGER;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedByAdminId_fkey" FOREIGN KEY ("decidedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
