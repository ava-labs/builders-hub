/*
  Warnings:

  - You are about to drop the column `address` on the `Hackathon` table. All the data in the column will be lost.
  - You are about to drop the column `agenda` on the `Hackathon` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Hackathon` table. All the data in the column will be lost.
  - You are about to drop the column `partners` on the `Hackathon` table. All the data in the column will be lost.
  - You are about to drop the column `registration_deadline` on the `Hackathon` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Hackathon` table. All the data in the column will be lost.
  - You are about to drop the column `tracks` on the `Hackathon` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Hackathon" DROP COLUMN "address",
DROP COLUMN "agenda",
DROP COLUMN "date",
DROP COLUMN "partners",
DROP COLUMN "registration_deadline",
DROP COLUMN "status",
DROP COLUMN "tracks",
ADD COLUMN     "content" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "end_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "start_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';
