-- Add project visibility tier (private / semi-public / public).
-- See issue #4198: gated /api/events/[id]/projects endpoint should only
-- return projects whose authors consented to share with partners.
--
-- public       -> name, members, description, github, demo, video, etc. (default)
-- semi-public  -> name, members, description only
-- private      -> excluded from the gated endpoint entirely
--
-- Enforced as a TEXT column (consistent with existing string-enum fields
-- like Evaluation.verdict / Member.status). Validation lives in app code.
--
-- NOTE: Data normalization that maps prior `consent_sharing` declines
-- (PR #4204) to the new tiers is run manually per environment; this
-- migration only records the schema change.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'public';
