/*
  Warnings:

  - A unique constraint covering the columns `[email,project_id]` on the table `Member` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_project_id_key" ON "Member"("email", "project_id");
