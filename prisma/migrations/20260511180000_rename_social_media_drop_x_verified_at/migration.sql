-- 1. Rename additional_social_media -> additional_social_accounts so the
--    column matches the *_account naming convention used for the typed
--    social fields (x_account, github_account, linkedin_account,
--    telegram_account).
ALTER TABLE "User" RENAME COLUMN "additional_social_media" TO "additional_social_accounts";

-- 2. Drop the x_verified_at column. There is no longer an X OAuth flow on
--    Builder Hub (X linking was removed alongside this rename), so the
--    timestamp it tracked has no consumer. x_account remains as a plain
--    optional URL field that users can fill in manually.
ALTER TABLE "User" DROP COLUMN IF EXISTS "x_verified_at";
