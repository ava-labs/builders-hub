-- Collapsed migration: bundles schema-only changes originally split across
-- four migration files dated 2026-04-20 / 2026-04-21. All four were already
-- applied in production under their original filenames, so the orphan
-- entries in _prisma_migrations are harmless.
--
-- Statements are idempotent so the migration is safe to re-run on a fresh
-- DB. Do NOT add any data migration (INSERT/UPDATE/DELETE) here: this file
-- is intentionally restricted to schema modifiers.

-- 1. FormData indexes (originally 20260420170000_add_form_data_build_games_stage_indexes)
CREATE INDEX IF NOT EXISTS "FormData_project_id_origin_idx" ON "FormData"("project_id", "origin");
CREATE INDEX IF NOT EXISTS "FormData_origin_current_stage_idx" ON "FormData"("origin", "current_stage");

-- 2. New User social columns (originally 20260421120000_add_user_x_handle_and_linkedin_url).
--    These are renamed to x_account / linkedin_account by 20260505120000.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "x_handle" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;

-- 3. Drop the unused Prize table (originally 20260421130000_drop_prize_table).
--    CASCADE removes the FK constraint too.
DROP TABLE IF EXISTS "Prize" CASCADE;

-- 4. Drop the write-only Retro9000ReturningApplication table
--    (originally 20260421140000_drop_retro9000_returning_application).
DROP TABLE IF EXISTS "Retro9000ReturningApplication";
