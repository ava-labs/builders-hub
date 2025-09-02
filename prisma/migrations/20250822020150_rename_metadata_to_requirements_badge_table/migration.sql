/*
  Warnings:

  - You are about to drop the column `metadata` on the `Badge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Badge" DROP COLUMN "metadata",
ADD COLUMN     "requirements" JSONB[] DEFAULT ARRAY[]::JSONB[];
