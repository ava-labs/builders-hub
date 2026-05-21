DO $$ BEGIN
  CREATE TYPE "HackathonEvaluationPhase" AS ENUM ('EVALUATION', 'PICKING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Hackathon"
  ADD COLUMN IF NOT EXISTS "evaluation_phase" "HackathonEvaluationPhase"
  NOT NULL DEFAULT 'EVALUATION';
