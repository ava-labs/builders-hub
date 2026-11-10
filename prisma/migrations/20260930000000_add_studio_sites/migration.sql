-- CreateTable
CREATE TABLE "StudioSite" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "owner_slug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "contracts" JSONB NOT NULL,
    "chains" JSONB NOT NULL,
    "design_css" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudioSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioSite_project_id_key" ON "StudioSite"("project_id");

-- CreateIndex
CREATE INDEX "StudioSite_user_id_idx" ON "StudioSite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "StudioSite_owner_slug_slug_key" ON "StudioSite"("owner_slug", "slug");

-- AddForeignKey
ALTER TABLE "StudioSite" ADD CONSTRAINT "StudioSite_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
