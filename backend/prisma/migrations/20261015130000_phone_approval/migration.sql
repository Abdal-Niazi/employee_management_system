-- A newly registered phone waits for an HR admin to approve it before it can check in.
ALTER TABLE "RegisteredDevice" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvedById" INTEGER,
ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Phones registered before approvals existed keep working.
UPDATE "RegisteredDevice" SET "status" = 'APPROVED', "approvedAt" = "createdAt";

-- AddForeignKey
ALTER TABLE "RegisteredDevice" ADD CONSTRAINT "RegisteredDevice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
