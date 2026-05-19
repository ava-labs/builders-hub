-- Create EcosystemCompany + JobListing for the Ecosystem Careers feature.
-- Schema mirrors prisma/schema.prisma; IF NOT EXISTS keeps this idempotent.

CREATE TABLE IF NOT EXISTS "EcosystemCompany" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_slug" TEXT,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "website" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jobs_count" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "EcosystemCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobListing" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "company_id" TEXT NOT NULL,
    "posted_by_user_id" TEXT,
    "title" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "remote_type" TEXT,
    "employment_type" TEXT,
    "seniority" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apply_url" TEXT NOT NULL,
    "source_url" TEXT,
    "posted_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

-- Indexes & unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "EcosystemCompany_project_id_key"
    ON "EcosystemCompany"("project_id");

CREATE UNIQUE INDEX IF NOT EXISTS "EcosystemCompany_source_external_slug_key"
    ON "EcosystemCompany"("source", "external_slug");

CREATE INDEX IF NOT EXISTS "EcosystemCompany_source_idx"
    ON "EcosystemCompany"("source");

CREATE UNIQUE INDEX IF NOT EXISTS "JobListing_source_external_id_key"
    ON "JobListing"("source", "external_id");

CREATE INDEX IF NOT EXISTS "JobListing_is_active_posted_at_idx"
    ON "JobListing"("is_active", "posted_at");

CREATE INDEX IF NOT EXISTS "JobListing_company_id_idx"
    ON "JobListing"("company_id");

-- Foreign keys (added separately to allow IF NOT EXISTS-style idempotency via DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EcosystemCompany_project_id_fkey'
    ) THEN
        ALTER TABLE "EcosystemCompany"
        ADD CONSTRAINT "EcosystemCompany_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "Project"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'JobListing_company_id_fkey'
    ) THEN
        ALTER TABLE "JobListing"
        ADD CONSTRAINT "JobListing_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "EcosystemCompany"("id")
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
