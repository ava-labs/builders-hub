-- SPEEDRUN schema additions.
--
-- Discrete, multi-select tech-stack tokens for the submission form and
-- (later) the gallery filter. Existing Project.tech_stack is a free-form
-- String and cannot be filtered. Guarded with IF NOT EXISTS so the
-- migration is idempotent against environments where the column was added
-- manually.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "stack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
