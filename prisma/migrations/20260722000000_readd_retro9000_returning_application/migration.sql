-- Recreate the Retro9000ReturningApplication table.
-- The table was dropped in 20260420170000_add_form_data_build_games_stage_indexes
-- when the returning-grantee form was retired; the form is now reactivated.

-- CreateTable
CREATE TABLE "Retro9000ReturningApplication" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "project_type" TEXT NOT NULL,
    "project_vertical" TEXT NOT NULL,
    "project_website" TEXT,
    "project_x_handle" TEXT,
    "project_github" TEXT NOT NULL,
    "project_hq" TEXT NOT NULL,
    "project_continent" TEXT NOT NULL,
    "media_kit" TEXT NOT NULL,
    "previous_retro9000_snapshot_funding" TEXT,
    "requested_funding_range" TEXT NOT NULL,
    "eligibility_and_metrics" TEXT NOT NULL,
    "requested_grant_size_budget" TEXT NOT NULL,
    "changes_since_last_snapshot" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "pseudonym" TEXT,
    "role" TEXT NOT NULL,
    "x_account" TEXT NOT NULL,
    "telegram" TEXT NOT NULL,
    "linkedin" TEXT,
    "github" TEXT,
    "country" TEXT,
    "other_url" TEXT,
    "bio" TEXT NOT NULL,
    "kyb_willing" TEXT NOT NULL,
    "gdpr" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Retro9000ReturningApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Retro9000ReturningApplication_email_key" ON "Retro9000ReturningApplication"("email");

-- CreateIndex
CREATE INDEX "Retro9000ReturningApplication_created_at_idx" ON "Retro9000ReturningApplication"("created_at");

-- CreateIndex
CREATE INDEX "Retro9000ReturningApplication_project_name_idx" ON "Retro9000ReturningApplication"("project_name");

-- CreateIndex
CREATE INDEX "Retro9000ReturningApplication_project_vertical_idx" ON "Retro9000ReturningApplication"("project_vertical");

-- CreateIndex
CREATE INDEX "Retro9000ReturningApplication_requested_funding_range_idx" ON "Retro9000ReturningApplication"("requested_funding_range");
