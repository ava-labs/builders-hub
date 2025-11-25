-- CreateTable
CREATE TABLE "ProjectBadge" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awarded_by" TEXT,

    CONSTRAINT "ProjectBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBadge_project_id_badge_id_key" ON "ProjectBadge"("project_id", "badge_id");

-- AddForeignKey
ALTER TABLE "ProjectBadge" ADD CONSTRAINT "ProjectBadge_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBadge" ADD CONSTRAINT "ProjectBadge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
