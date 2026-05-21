-- Drop the legacy free-text referral columns now that their resolvable
-- signal has been captured into ReferralAttribution.
--
-- The data backfill (UTM-derived team1-latam / devrel attributions, the
-- how_did_you_hear four-tier classification, the bulk team1-latam member
-- assignment, the team1-brazil carve-out, and the @avax.network domain
-- grant of foundation team + builder_insights attribute) is intentionally
-- kept out of this repo so that personal email addresses do not land in
-- git history. That SQL is run directly against Neon by an operator with
-- prod access *before* this migration deploys. See the PR description's
-- "Deployment order" section for the runbook.

ALTER TABLE "RegisterForm" DROP COLUMN "utm";

ALTER TABLE "BuildGamesApplication"
  DROP COLUMN IF EXISTS "how_did_you_hear",
  DROP COLUMN IF EXISTS "how_did_you_hear_specify";
