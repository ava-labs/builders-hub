-- Forward SQL (scope: only items tagged "# Falta migración" in 2026-05-07 report)
-- Branch context: pr-4158
-- Safe-ish execution: uses IF NOT EXISTS and guarded FK creation.

-- ============================================================================
-- 0) Missing columns (schema.prisma vs tracked migration.sql)
-- ============================================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "github" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "noun_avatar_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "noun_avatar_seed" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "user_type" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wallet" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notification_means" JSONB DEFAULT '{}'::jsonb;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "other_category" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "website" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "socials" JSONB;
ALTER TABLE "Project" ALTER COLUMN "hackaton_id" DROP NOT NULL;

ALTER TABLE "FormData" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'unknown';

-- ============================================================================
-- 1) Contract
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Contract" (
    "id" INTEGER NOT NULL,
    "deployer_address" TEXT,
    "timestamp" TEXT,
    "address" TEXT,
    "chain_id" INTEGER,
    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Contract_address_key" ON "Contract"("address");

-- ============================================================================
-- 2) Notification + NotificationEmailState + NotificationInboxState + NotificationTemplate
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "audience" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "content_type" TEXT,
    "short_description" TEXT,
    "template" TEXT,
    "status" TEXT NOT NULL,
    "send_date" DATE,
    "creator" TEXT NOT NULL,
    "created_at" DATE NOT NULL,
    CONSTRAINT "InboxNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationEmailState" (
    "id" SERIAL NOT NULL,
    "status" TEXT,
    "error" TEXT,
    "attemps" INTEGER,
    "notification_id" INTEGER,
    "audience" TEXT,
    "send_date" DATE,
    CONSTRAINT "NotificationEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationInboxState" (
    "id" SERIAL NOT NULL,
    "status" TEXT,
    "notification_id" INTEGER NOT NULL,
    "error" TEXT,
    "send_date" DATE,
    "attemps" INTEGER,
    "audience" TEXT,
    CONSTRAINT "NotificationInbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
    "id" INTEGER NOT NULL,
    "template" TEXT,
    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_creator_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_creator_fkey"
      FOREIGN KEY ("creator") REFERENCES "User"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationEmail_notification_id_fkey'
  ) THEN
    ALTER TABLE "NotificationEmailState"
      ADD CONSTRAINT "NotificationEmail_notification_id_fkey"
      FOREIGN KEY ("notification_id") REFERENCES "Notification"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationInbox_notification_id_fkey'
  ) THEN
    ALTER TABLE "NotificationInboxState"
      ADD CONSTRAINT "NotificationInbox_notification_id_fkey"
      FOREIGN KEY ("notification_id") REFERENCES "Notification"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- ============================================================================
-- 3) Repository + ProjectRepository
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Repository" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "repo_id" TEXT,
    "repo_name" TEXT,
    "user_id" TEXT,
    "commits" INTEGER,
    "first_contribution" BIGINT,
    "last_contribution" BIGINT,
    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectRepository" (
    "project_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    CONSTRAINT "ProjectRepository_pkey" PRIMARY KEY ("project_id", "repository_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Repository_user_id_fkey'
  ) THEN
    ALTER TABLE "Repository"
      ADD CONSTRAINT "Repository_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectRepository_project_id_fkey'
  ) THEN
    ALTER TABLE "ProjectRepository"
      ADD CONSTRAINT "ProjectRepository_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectRepository_repository_id_fkey'
  ) THEN
    ALTER TABLE "ProjectRepository"
      ADD CONSTRAINT "ProjectRepository_repository_id_fkey"
      FOREIGN KEY ("repository_id") REFERENCES "Repository"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4) Speaker
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Speaker" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT NOT NULL,
    "picture" TEXT NOT NULL,
    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("id")
);
