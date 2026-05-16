-- Invisible judging + phases + winner ranks.
-- Adds a per-hackathon evaluation phase (EVALUATION | PICKING) that controls
-- when scoring data is shared between judges, and a winner_rank on Project
-- (FIRST_PLACE | WINNER) so devrel can distinguish the overall winner from
-- track / honorable winners. is_winner stays as a derived boolean for
-- backwards compatibility with existing badge / public surfaces.

-- Hackathon.evaluation_phase
DO $$ BEGIN
  CREATE TYPE "HackathonEvaluationPhase" AS ENUM ('EVALUATION', 'PICKING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Hackathon"
  ADD COLUMN IF NOT EXISTS "evaluation_phase" "HackathonEvaluationPhase"
  NOT NULL DEFAULT 'EVALUATION';

-- Project.winner_rank
DO $$ BEGIN
  CREATE TYPE "ProjectWinnerRank" AS ENUM ('FIRST_PLACE', 'WINNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "winner_rank" "ProjectWinnerRank";

-- Backfill: every existing winner becomes a generic WINNER. Devrel can
-- promote one per hackathon to FIRST_PLACE manually after the migration.
UPDATE "Project"
SET "winner_rank" = 'WINNER'
WHERE "is_winner" = true
  AND "winner_rank" IS NULL;
