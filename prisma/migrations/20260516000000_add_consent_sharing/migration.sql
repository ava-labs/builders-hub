-- Add nullable consent_sharing column to User and Project.
-- Semantics: NULL = never asked, FALSE = explicitly declined, TRUE = explicitly granted.
-- IF NOT EXISTS so this is idempotent against environments where the column was added manually.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consent_sharing" BOOLEAN;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "consent_sharing" BOOLEAN;
