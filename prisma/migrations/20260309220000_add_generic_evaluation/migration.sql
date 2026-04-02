-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "form_data_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "comment" TEXT,
    "score_overall" DOUBLE PRECISION,
    "scores" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- Add final_verdict to FormData
ALTER TABLE "FormData" ADD COLUMN "final_verdict" TEXT;

-- CreateIndex
CREATE INDEX "Evaluation_form_data_id_idx" ON "Evaluation"("form_data_id");
CREATE INDEX "Evaluation_evaluator_id_idx" ON "Evaluation"("evaluator_id");
CREATE UNIQUE INDEX "Evaluation_form_data_id_evaluator_id_key" ON "Evaluation"("form_data_id", "evaluator_id");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_form_data_id_fkey" FOREIGN KEY ("form_data_id") REFERENCES "FormData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
