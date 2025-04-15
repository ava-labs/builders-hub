/*
  Warnings:

  - A unique constraint covering the columns `[hackathonId,email]` on the table `RegisterForm` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RegisterForm_hackathonId_email_key" ON "RegisterForm"("hackathonId", "email");
