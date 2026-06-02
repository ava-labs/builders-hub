-- Schema-only: rename profile social columns to the canonical *_account names.
-- The companion data normalization (parsing legacy additional_social_media
-- entries into the typed columns) lives in
--   scripts/data-migrations/normalize-user-social-accounts.sql
-- and must be run once per environment. It is already applied on production.
--
-- Idempotent: re-applying after the columns have been renamed is a no-op,
-- so this migration is safe to replay if a stale checksum row gets dropped
-- from _prisma_migrations.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'github'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "github" TO "github_account";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'social_media'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "social_media" TO "additional_social_media";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'x_handle'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "x_handle" TO "x_account";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'linkedin_url'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "linkedin_url" TO "linkedin_account";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'telegram_user'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "telegram_user" TO "telegram_account";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'RegisterForm' AND column_name = 'telegram_user'
  ) THEN
    ALTER TABLE "RegisterForm" RENAME COLUMN "telegram_user" TO "telegram_account";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'additional_social_media'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "additional_social_media" SET DEFAULT ARRAY[]::TEXT[];
    UPDATE "User" SET "additional_social_media" = ARRAY[]::TEXT[] WHERE "additional_social_media" IS NULL;
    ALTER TABLE "User" ALTER COLUMN "additional_social_media" SET NOT NULL;
  END IF;
END
$$;
