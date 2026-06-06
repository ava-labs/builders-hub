-- Single human-readable pay field for ecosystem-careers listings.
-- Populated by the community submit/edit form and the web3.career ingest
-- (exact employer-stated value when present, otherwise the estimate).
-- Surfaced in the UI only to viewers with X + LinkedIn connected.
ALTER TABLE "JobListing"
    ADD COLUMN IF NOT EXISTS "salary" TEXT;
