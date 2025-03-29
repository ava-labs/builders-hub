-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "hackaton_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "full_description" TEXT DEFAULT '',
    "tech_stack" TEXT DEFAULT '',
    "github_repository" TEXT DEFAULT '',
    "demo_link" TEXT DEFAULT '',
    "open_source" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" TEXT DEFAULT '',
    "cover_url" TEXT DEFAULT '',
    "demo_video_link" TEXT DEFAULT '',
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tracks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'Awaiting Confirmation',

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_user_id_project_id_key" ON "Member"("user_id", "project_id");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_hackaton_id_fkey" FOREIGN KEY ("hackaton_id") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
