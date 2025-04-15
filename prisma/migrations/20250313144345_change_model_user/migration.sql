/*
  Warnings:

  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified",
ADD COLUMN     "authentication_mode" TEXT,
ADD COLUMN     "integration" TEXT,
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "user_name" TEXT;
