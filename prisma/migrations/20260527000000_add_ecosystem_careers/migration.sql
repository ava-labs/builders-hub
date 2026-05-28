ALTER TABLE "Project"
    ADD COLUMN IF NOT EXISTS "careers_approved" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "careers_rejected_at" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "Project_careers_approved_idx"
    ON "Project"("careers_approved");

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
    "rejected_at"         TIMESTAMPTZ(3),
    "created_at"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobListing_source_external_id_key"
    ON "JobListing"("source", "external_id");

CREATE INDEX IF NOT EXISTS "JobListing_source_is_active_posted_at_idx"
    ON "JobListing"("source", "is_active", "posted_at");

CREATE INDEX IF NOT EXISTS "JobListing_project_id_idx"
    ON "JobListing"("project_id");

CREATE INDEX IF NOT EXISTS "JobListing_rejected_at_idx"
    ON "JobListing"("rejected_at");

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
