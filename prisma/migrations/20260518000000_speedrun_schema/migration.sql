-- SPEEDRUN schema additions.
--
-- Three additions, all guarded with IF [NOT] EXISTS so the migration is
-- idempotent against environments where columns were added manually.
--
-- 1. Project.stack  -- discrete, multi-select tech-stack tokens. Existing
--    Project.tech_stack is a free-form String and cannot be filtered.
-- 2. Member.visibility -- per-member contact-visibility flags for the
--    public gallery (country/email/telegram/x/github). JSON over five
--    booleans so future fields (LinkedIn, Discord) do not need another
--    migration. Orthogonal to Project.visibility from the prior
--    add_project_visibility migration (project-level tier).
-- 3. ApiKey -- partner API keys with per-hackathon scope + revocation.
--    Replaces the single HACKATHON_PROJECTS_API_KEY env var (which stays
--    as a fallback in lib/auth/permissions.ts).

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "stack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "visibility" JSONB;

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"            TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "prefix"        TEXT NOT NULL,
  "hashed_key"    TEXT NOT NULL,
  "hackathon_id"  TEXT NOT NULL,
  "created_by"    TEXT NOT NULL,
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at"    TIMESTAMPTZ(3),
  "last_used_at"  TIMESTAMPTZ(3),
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_hashed_key_key" ON "ApiKey"("hashed_key");
CREATE INDEX IF NOT EXISTS "ApiKey_hackathon_id_idx" ON "ApiKey"("hackathon_id");
CREATE INDEX IF NOT EXISTS "ApiKey_prefix_idx" ON "ApiKey"("prefix");
CREATE INDEX IF NOT EXISTS "ApiKey_revoked_at_idx" ON "ApiKey"("revoked_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_hackathon_id_fkey'
  ) THEN
    ALTER TABLE "ApiKey"
      ADD CONSTRAINT "ApiKey_hackathon_id_fkey"
      FOREIGN KEY ("hackathon_id") REFERENCES "Hackathon"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_created_by_fkey'
  ) THEN
    ALTER TABLE "ApiKey"
      ADD CONSTRAINT "ApiKey_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
