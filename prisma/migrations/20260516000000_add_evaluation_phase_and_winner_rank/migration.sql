DO $$ BEGIN
  CREATE TYPE "HackathonEvaluationPhase" AS ENUM ('EVALUATION', 'PICKING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Hackathon"
  ADD COLUMN IF NOT EXISTS "evaluation_phase" "HackathonEvaluationPhase"
  NOT NULL DEFAULT 'EVALUATION';

DO $$ BEGIN
  CREATE TYPE "ProjectWinnerRank" AS ENUM ('FIRST_PLACE', 'WINNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "winner_rank" "ProjectWinnerRank";

UPDATE "Project"
SET "winner_rank" = 'WINNER'
WHERE "is_winner" = true
  AND "winner_rank" IS NULL;
