-- Move Project.tech_stack from free-text (String?) to multi-select (String[])
-- to match the SPEEDRUN spec ("multi-select per event, admin-defined list").
-- Existing free-text values are dropped: the new field is a curated tag list,
-- not a description.

ALTER TABLE "Project" DROP COLUMN IF EXISTS "tech_stack";
ALTER TABLE "Project"
    ADD COLUMN IF NOT EXISTS "tech_stack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
