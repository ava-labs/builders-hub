-- Restore linkedin_url and x_handle on User.
-- These columns exist in production but were missing from schema.prisma,
-- which caused prisma db push to attempt dropping them with live data.
-- Using IF NOT EXISTS so this is safe to run in any environment.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "x_handle" TEXT;
