-- CreateTable
CREATE TABLE "ResearchProposalApplication" (
    "id" TEXT NOT NULL,
    "submitted_by_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lead_full_name" TEXT NOT NULL,
    "affiliation" TEXT NOT NULL,
    "proposal_title" TEXT NOT NULL,
    "primary_research_area" TEXT NOT NULL,
    "primary_research_area_other" TEXT,
    "budget_usd" INTEGER NOT NULL,
    "proposal_url" TEXT NOT NULL,
    "lead_cv_url" TEXT NOT NULL,
    "co_investigators" TEXT,
    "co_investigator_cvs_url" TEXT,
    "exclusivity_agreement" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ResearchProposalApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchProposalApplication_email_idx" ON "ResearchProposalApplication"("email");

-- CreateIndex
CREATE INDEX "ResearchProposalApplication_created_at_idx" ON "ResearchProposalApplication"("created_at");

-- CreateIndex
CREATE INDEX "ResearchProposalApplication_primary_research_area_idx" ON "ResearchProposalApplication"("primary_research_area");

-- CreateIndex
CREATE INDEX "ResearchProposalApplication_submitted_by_user_id_idx" ON "ResearchProposalApplication"("submitted_by_user_id");
