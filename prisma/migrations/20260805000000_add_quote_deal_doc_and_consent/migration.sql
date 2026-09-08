-- AlterTable
ALTER TABLE "AuditRequest" ADD COLUMN     "contact_consent_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "AuditQuote" ADD COLUMN     "deal_doc_url" TEXT;

