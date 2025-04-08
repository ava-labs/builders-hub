/*
  Warnings:

  - You are about to drop the column `is_winner` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "is_winner",
ADD COLUMN     "prices" JSONB NOT NULL DEFAULT '[]';
