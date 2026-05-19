-- Add a review gate on project-sourced EcosystemCompany rows so a devrel
-- can approve teams before their listings publish. Getro-sourced rows keep
-- the default 'approved' (they live on the public job board already and
-- need no further review).

ALTER TABLE "EcosystemCompany"
    ADD COLUMN IF NOT EXISTS "authorization_status" TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE "EcosystemCompany"
    ADD COLUMN IF NOT EXISTS "authorized_by_user_id" TEXT;

ALTER TABLE "EcosystemCompany"
    ADD COLUMN IF NOT EXISTS "authorized_at" TIMESTAMPTZ(3);

ALTER TABLE "EcosystemCompany"
    ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

CREATE INDEX IF NOT EXISTS "EcosystemCompany_authorization_status_idx"
    ON "EcosystemCompany"("authorization_status");
