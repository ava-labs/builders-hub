-- Add project visibility tier (private / semi-public / public).
-- See issue #4198: gated /api/events/[id]/projects endpoint should only
-- return projects whose authors consented to share with partners.
--
-- semi-public  -> name, members, description (default for new rows)
-- public       -> semi-public fields + github / demo / video / etc.
-- private      -> excluded from the gated endpoint entirely
--
-- Enforced as a TEXT column (consistent with existing string-enum fields
-- like Evaluation.verdict / Member.status). Validation lives in app code.
--
-- NOTE: Backfilling from `consent_sharing` (PR #4204) to reflect prior
-- declines is intentionally NOT included here. Data normalization is run
-- manually per environment; the migration only records the schema change.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'semi-public';
