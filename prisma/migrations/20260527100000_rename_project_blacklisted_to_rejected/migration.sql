-- Rename is_blacklisted → is_rejected on Project.
-- Handles three scenarios idempotently:
--   1. is_blacklisted exists  → rename it
--   2. Neither column exists  → add is_rejected (e.g. migration table was copied
--      from a branch where 20260526 ran with the old column name)
--   3. is_rejected already exists → no-op
-- Also ensures submission_email_sent exists for the same reason.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'is_blacklisted'
  ) THEN
    ALTER TABLE "Project" RENAME COLUMN "is_blacklisted" TO "is_rejected";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'is_rejected'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "is_rejected" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Project' AND column_name = 'submission_email_sent'
  ) THEN
    ALTER TABLE "Project" ADD COLUMN "submission_email_sent" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
