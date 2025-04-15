/*
  Warnings:

  - Made the column `total_prizes` on table `Hackathon` required. This step will fail if there are existing NULL values in that column.
  - Made the column `agenda` on table `Hackathon` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Hackathon" ALTER COLUMN "total_prizes" SET NOT NULL,
ALTER COLUMN "agenda" SET NOT NULL;
