-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "is_winner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "small_cover_url" TEXT DEFAULT '',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
