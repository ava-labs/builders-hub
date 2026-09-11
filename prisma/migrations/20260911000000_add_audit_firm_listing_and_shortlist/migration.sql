-- AlterTable
ALTER TABLE "Auditor" ADD COLUMN "website" TEXT;
ALTER TABLE "Auditor" ADD COLUMN "logo_url" TEXT;

-- AlterTable
ALTER TABLE "AuditRequest" ADD COLUMN "shortlist_auditor_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
