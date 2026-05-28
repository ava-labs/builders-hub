-- AlterTable
ALTER TABLE "Project" ADD COLUMN "careers_rejected_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "JobListing" ADD COLUMN "rejected_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "JobListing_rejected_at_idx" ON "JobListing"("rejected_at");
