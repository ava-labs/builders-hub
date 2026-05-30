-- Add stage to Evaluation
ALTER TABLE "Evaluation" ADD COLUMN "stage" INTEGER NOT NULL DEFAULT 0;

-- Add current_stage to FormData
ALTER TABLE "FormData" ADD COLUMN "current_stage" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint
DROP INDEX "Evaluation_form_data_id_evaluator_id_key";

-- Create new unique constraint with stage
CREATE UNIQUE INDEX "Evaluation_form_data_id_evaluator_id_stage_key" ON "Evaluation"("form_data_id", "evaluator_id", "stage");
