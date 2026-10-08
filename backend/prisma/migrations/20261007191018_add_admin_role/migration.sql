-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HR_ADMIN', 'MANAGER');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'HR_ADMIN';
