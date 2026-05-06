CREATE INDEX "FormData_project_id_origin_idx" ON "FormData"("project_id", "origin");

CREATE INDEX "FormData_origin_current_stage_idx" ON "FormData"("origin", "current_stage");
