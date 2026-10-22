-- An employee's photo: the picture lives in its own table (so employee lists never load it) and
-- the employee only records when it was last set.
ALTER TABLE "Employee" ADD COLUMN "photoUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmployeePhoto" (
    "employeeId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',

    CONSTRAINT "EmployeePhoto_pkey" PRIMARY KEY ("employeeId")
);

-- AddForeignKey
ALTER TABLE "EmployeePhoto" ADD CONSTRAINT "EmployeePhoto_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
