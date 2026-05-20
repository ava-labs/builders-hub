-- Ecosystem Careers — one-shot schema for the careers feature.
-- Idempotent against re-runs (IF NOT EXISTS guards). Reaches the final state
-- on a fresh fork: per-team review fields on Project plus the JobListing
-- table with both relational (community) and denormalized (external/legacy)
-- company linkage.

-- ── Per-project careers review state on Project ──
-- Defaults to 'approved' so existing hackathon projects are unaffected;
-- community submissions transition the project to 'pending' on first listing
-- and a devrel approves at /admin/ecosystem-careers.
ALTER TABLE "Project"
    ADD COLUMN IF NOT EXISTS "careers_authorization_status"  TEXT NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS "careers_authorized_by_user_id" TEXT,
    ADD COLUMN IF NOT EXISTS "careers_authorized_at"         TIMESTAMPTZ(3),
    ADD COLUMN IF NOT EXISTS "careers_rejection_reason"      TEXT;

CREATE INDEX IF NOT EXISTS "Project_careers_authorization_status_idx"
    ON "Project"("careers_authorization_status");

-- ── JobListing table ──
-- source = 'community'  → project_id is set (FK to Project); company_* fields NULL
-- source = 'external'   → web3.career ingest (project_id NULL; company_* fields set)
-- source = 'legacy'     → original Getro seed, frozen (project_id NULL; company_* fields set)
CREATE TABLE IF NOT EXISTS "JobListing" (
    "id"                  TEXT NOT NULL,
    "source"              TEXT NOT NULL,
    "external_id"         TEXT,
    "project_id"          TEXT,
    "posted_by_user_id"   TEXT,
    "company_name"        TEXT,
    "company_logo"        TEXT,
    "company_website"     TEXT,
    "company_tags"        TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title"               TEXT NOT NULL,
    "short_description"   TEXT NOT NULL,
    "description"         TEXT,
    "location"            TEXT,
    "remote_type"         TEXT,
    "employment_type"     TEXT,
    "seniority"           TEXT,
    "tags"                TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apply_url"           TEXT NOT NULL,
    "source_url"          TEXT,
    "posted_at"           TIMESTAMPTZ(3),
    "last_seen_at"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active"           BOOLEAN NOT NULL DEFAULT true,
    "created_at"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

-- Indexes + unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "JobListing_source_external_id_key"
    ON "JobListing"("source", "external_id");

CREATE INDEX IF NOT EXISTS "JobListing_source_is_active_posted_at_idx"
    ON "JobListing"("source", "is_active", "posted_at");

CREATE INDEX IF NOT EXISTS "JobListing_project_id_idx"
    ON "JobListing"("project_id");

-- Foreign keys (DO blocks for idempotency — pg_constraint introspection
-- because Postgres has no native IF NOT EXISTS for constraints).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'JobListing_project_id_fkey'
    ) THEN
        ALTER TABLE "JobListing"
        ADD CONSTRAINT "JobListing_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "Project"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'JobListing_posted_by_user_id_fkey'
    ) THEN
        ALTER TABLE "JobListing"
        ADD CONSTRAINT "JobListing_posted_by_user_id_fkey"
        FOREIGN KEY ("posted_by_user_id") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
