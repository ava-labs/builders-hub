-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "notification_email" TEXT,
ADD COLUMN     "notification_options" TEXT[],
ADD COLUMN     "profile_privacy" TEXT,
ADD COLUMN     "social_media" TEXT[];
