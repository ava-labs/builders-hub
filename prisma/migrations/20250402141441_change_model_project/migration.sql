/*
  Warnings:

  - You are about to drop the column `open_source` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "open_source",
ADD COLUMN     "explanation" TEXT DEFAULT '',
ADD COLUMN     "is_preexisting_idea" BOOLEAN NOT NULL DEFAULT false;
