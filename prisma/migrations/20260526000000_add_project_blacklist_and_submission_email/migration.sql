-- AlterTable
ALTER TABLE "Project"
  ADD COLUMN "is_rejected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "submission_email_sent" BOOLEAN NOT NULL DEFAULT false;
