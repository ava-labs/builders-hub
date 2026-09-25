-- AlterTable
ALTER TABLE "AuditQuote" ADD COLUMN     "submitted_by_email" TEXT;

-- CreateTable
CREATE TABLE "AuditorMember" (
    "id" TEXT NOT NULL,
    "auditor_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "added_by" TEXT,
    "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditorMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditorMember_email_key" ON "AuditorMember"("email");

-- CreateIndex
CREATE INDEX "AuditorMember_auditor_id_idx" ON "AuditorMember"("auditor_id");

-- CreateIndex
CREATE INDEX "AuditorMember_added_by_idx" ON "AuditorMember"("added_by");

-- AddForeignKey
ALTER TABLE "AuditorMember" ADD CONSTRAINT "AuditorMember_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "Auditor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditorMember" ADD CONSTRAINT "AuditorMember_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

