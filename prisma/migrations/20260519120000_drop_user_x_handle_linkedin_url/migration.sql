-- Drop the legacy User.x_handle and User.linkedin_url columns.
--
-- Background: migration 20260505120000_normalize_user_social_accounts renamed
-- x_handle -> x_account and linkedin_url -> linkedin_account. A later migration
-- (20260513000000_restore_linkedin_x_handle_user) re-added both legacy columns
-- because the production DB still carried them and `prisma db push` would have
-- dropped the live data. Data has since been consolidated into the *_account
-- columns out-of-band (per the data-ops-outside-repo convention), so both
-- legacy columns are now empty everywhere and safe to drop.
--
-- Idempotent: IF EXISTS so this is a no-op in environments where the columns
-- have already been dropped.
ALTER TABLE "User" DROP COLUMN IF EXISTS "x_handle";
ALTER TABLE "User" DROP COLUMN IF EXISTS "linkedin_url";
