-- Add Project.tech_stack_tags: a curated multi-select tag list (SPEEDRUN spec
-- "multi-select per event, admin-defined list"). Non-destructive: the legacy
-- free-text `tech_stack` column is intentionally preserved as-is so existing
-- production submissions keep their original descriptions.

ALTER TABLE "Project"
    ADD COLUMN IF NOT EXISTS "tech_stack_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
