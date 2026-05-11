-- Free-text label captured when a visitor picks the "Other" team option in
-- the referral picker (UI label "Other" → DB sentinel "none" in
-- team_id_referrer; the user-typed label lives here). Mirrors the
-- ResearchProposalApplication.primary_research_area_other pattern so the
-- curated team_id_referrer column stays clean for analytics.

ALTER TABLE "ReferralAttribution"
  ADD COLUMN "team_id_referrer_other" TEXT;
