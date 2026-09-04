-- CreateTable
CREATE TABLE "AuditRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_project_id" TEXT,
    "project_name" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "project_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deployment_target" TEXT NOT NULL DEFAULT '',
    "multichain" BOOLEAN NOT NULL DEFAULT false,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "repos" JSONB NOT NULL DEFAULT '[]',
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nsloc" INTEGER,
    "doc_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "needed_by" TIMESTAMPTZ(3),
    "quote_deadline" TIMESTAMPTZ(3),
    "urgency" TEXT,
    "contact_name" TEXT NOT NULL DEFAULT '',
    "contact_email" TEXT NOT NULL DEFAULT '',
    "contact_handle" TEXT,
    "contact_calendar_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "accepted_quote_id" TEXT,
    "submitted_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditor" (
    "id" TEXT NOT NULL,
    "firm_name" TEXT NOT NULL,
    "quote_email" TEXT NOT NULL,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_login_at" TIMESTAMPTZ(3),
    "deactivated_at" TIMESTAMPTZ(3),
    "attio_ref" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Auditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditQuote" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "auditor_id" TEXT NOT NULL,
    "price_usd" INTEGER NOT NULL,
    "duration_weeks" INTEGER NOT NULL,
    "earliest_start" TIMESTAMPTZ(3) NOT NULL,
    "message" TEXT NOT NULL,
    "reaudit_included" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSubsidyDecision" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pct" INTEGER NOT NULL DEFAULT 0,
    "program_amount_usd" INTEGER NOT NULL DEFAULT 0,
    "project_amount_usd" INTEGER NOT NULL DEFAULT 0,
    "decided_by" TEXT,
    "note" TEXT,
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSubsidyDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFanoutDelivery" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "auditor_id" TEXT NOT NULL,
    "email_status" TEXT NOT NULL DEFAULT 'queued',
    "emailed_at" TIMESTAMPTZ(3),
    "last_reminder_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFanoutDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEventLog" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditRequest_accepted_quote_id_key" ON "AuditRequest"("accepted_quote_id");

-- CreateIndex
CREATE INDEX "AuditRequest_user_id_idx" ON "AuditRequest"("user_id");

-- CreateIndex
CREATE INDEX "AuditRequest_source_project_id_idx" ON "AuditRequest"("source_project_id");

-- CreateIndex
CREATE INDEX "AuditRequest_status_idx" ON "AuditRequest"("status");

-- CreateIndex
CREATE INDEX "AuditRequest_created_at_idx" ON "AuditRequest"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Auditor_quote_email_key" ON "Auditor"("quote_email");

-- CreateIndex
CREATE INDEX "Auditor_created_by_idx" ON "Auditor"("created_by");

-- CreateIndex
CREATE INDEX "Auditor_active_idx" ON "Auditor"("active");

-- CreateIndex
CREATE INDEX "Auditor_created_at_idx" ON "Auditor"("created_at");

-- CreateIndex
CREATE INDEX "AuditQuote_auditor_id_idx" ON "AuditQuote"("auditor_id");

-- CreateIndex
CREATE INDEX "AuditQuote_created_at_idx" ON "AuditQuote"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "AuditQuote_request_id_auditor_id_key" ON "AuditQuote"("request_id", "auditor_id");

-- CreateIndex
CREATE INDEX "AuditSubsidyDecision_request_id_idx" ON "AuditSubsidyDecision"("request_id");

-- CreateIndex
CREATE INDEX "AuditSubsidyDecision_quote_id_idx" ON "AuditSubsidyDecision"("quote_id");

-- CreateIndex
CREATE INDEX "AuditSubsidyDecision_decided_by_idx" ON "AuditSubsidyDecision"("decided_by");

-- CreateIndex
CREATE INDEX "AuditSubsidyDecision_created_at_idx" ON "AuditSubsidyDecision"("created_at");

-- CreateIndex
CREATE INDEX "AuditFanoutDelivery_auditor_id_idx" ON "AuditFanoutDelivery"("auditor_id");

-- CreateIndex
CREATE INDEX "AuditFanoutDelivery_created_at_idx" ON "AuditFanoutDelivery"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFanoutDelivery_request_id_auditor_id_key" ON "AuditFanoutDelivery"("request_id", "auditor_id");

-- CreateIndex
CREATE INDEX "AuditEventLog_request_id_idx" ON "AuditEventLog"("request_id");

-- CreateIndex
CREATE INDEX "AuditEventLog_action_idx" ON "AuditEventLog"("action");

-- CreateIndex
CREATE INDEX "AuditEventLog_created_at_idx" ON "AuditEventLog"("created_at");

-- AddForeignKey
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRequest" ADD CONSTRAINT "AuditRequest_source_project_id_fkey" FOREIGN KEY ("source_project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditor" ADD CONSTRAINT "Auditor_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditQuote" ADD CONSTRAINT "AuditQuote_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "AuditRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditQuote" ADD CONSTRAINT "AuditQuote_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "Auditor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubsidyDecision" ADD CONSTRAINT "AuditSubsidyDecision_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "AuditRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubsidyDecision" ADD CONSTRAINT "AuditSubsidyDecision_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "AuditQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubsidyDecision" ADD CONSTRAINT "AuditSubsidyDecision_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFanoutDelivery" ADD CONSTRAINT "AuditFanoutDelivery_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "AuditRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFanoutDelivery" ADD CONSTRAINT "AuditFanoutDelivery_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "Auditor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEventLog" ADD CONSTRAINT "AuditEventLog_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "AuditRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

