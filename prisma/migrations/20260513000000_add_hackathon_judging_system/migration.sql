-- Generalized hackathon judging system.
-- Adds HackathonJudge join table (per-hackathon judge assignments) and
-- extends Evaluation so it can attach directly to a Project (in addition
-- to FormData, which Build Games still uses). verdict and form_data_id
-- become nullable since the new flow only captures score_overall + comment.

-- New table: HackathonJudge
CREATE TABLE IF NOT EXISTS "HackathonJudge" (
    "id" TEXT NOT NULL,
    "hackathon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HackathonJudge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HackathonJudge_hackathon_id_idx"
  ON "HackathonJudge"("hackathon_id");
CREATE INDEX IF NOT EXISTS "HackathonJudge_user_id_idx"
  ON "HackathonJudge"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "HackathonJudge_hackathon_id_user_id_key"
  ON "HackathonJudge"("hackathon_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "HackathonJudge"
    ADD CONSTRAINT "HackathonJudge_hackathon_id_fkey"
    FOREIGN KEY ("hackathon_id") REFERENCES "Hackathon"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HackathonJudge"
    ADD CONSTRAINT "HackathonJudge_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend Evaluation: attach to a Project directly, drop NOT NULL on
-- form_data_id and verdict so the new flow can store score + comment only.
ALTER TABLE "Evaluation"
  ADD COLUMN IF NOT EXISTS "project_id" TEXT,
  ADD COLUMN IF NOT EXISTS "hackathon_id" TEXT;

ALTER TABLE "Evaluation" ALTER COLUMN "form_data_id" DROP NOT NULL;
ALTER TABLE "Evaluation" ALTER COLUMN "verdict" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Evaluation_project_id_idx"
  ON "Evaluation"("project_id");
CREATE INDEX IF NOT EXISTS "Evaluation_hackathon_id_idx"
  ON "Evaluation"("hackathon_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Evaluation_project_id_evaluator_id_key"
  ON "Evaluation"("project_id", "evaluator_id");

DO $$ BEGIN
  ALTER TABLE "Evaluation"
    ADD CONSTRAINT "Evaluation_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
