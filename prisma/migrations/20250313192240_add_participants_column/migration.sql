/*
  Warnings:

  - Added the required column `participants` to the `Hackathon` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Hackathon" ADD COLUMN     "participants" INTEGER NOT NULL;
