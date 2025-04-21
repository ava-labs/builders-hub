-- AlterTable
ALTER TABLE "Hackathon" ADD COLUMN     "organizers" TEXT,
ADD COLUMN     "top_most" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "notification_email" TEXT,
ADD COLUMN     "notifications" BOOLEAN DEFAULT true,
ADD COLUMN     "profile_privacy" TEXT DEFAULT 'public',
ADD COLUMN     "social_media" TEXT[];

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
    "logo_url" TEXT DEFAULT '',
    "cover_url" TEXT DEFAULT '',
    "demo_video_link" TEXT DEFAULT '',
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tracks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "explanation" TEXT DEFAULT '',
    "is_preexisting_idea" BOOLEAN NOT NULL DEFAULT false,
    "small_cover_url" TEXT DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_winner" BOOLEAN DEFAULT false,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "prize" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'Pending Confirmation',

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_user_id_project_id_key" ON "Member"("user_id", "project_id");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_hackaton_id_fkey" FOREIGN KEY ("hackaton_id") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
