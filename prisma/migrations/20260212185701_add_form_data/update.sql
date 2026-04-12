-- Create new table
CREATE TABLE "FormData" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "form_data" jsonb NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  "origin" text NOT NULL,
  "project_id" text NOT NULL
);

ALTER TABLE "FormData"
ADD CONSTRAINT "FormData_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id");

-- Drop hackathon_id constraint
ALTER TABLE "Project"
ALTER COLUMN "hackaton_id"
DROP NOT NULL;

ALTER TABLE "Project"
ADD COLUMN "origin" text;

-- Fill with default value to succeed in the not null setting
UPDATE "Project"
SET "origin" = 'project submission'
WHERE "origin" IS NULL;

ALTER TABLE "Project"
ALTER COLUMN "origin" SET NOT NULL;

