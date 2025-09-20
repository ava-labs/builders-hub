/*
  Warnings:

  - Added the required column `status` to the `ProjectBadge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `UserBadge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Badge" ADD COLUMN     "current_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProjectBadge" ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "requirements_snapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "requirements_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" SMALLINT NOT NULL;

-- AlterTable
ALTER TABLE "UserBadge" ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "requirements_snapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "requirements_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" SMALLINT NOT NULL;
