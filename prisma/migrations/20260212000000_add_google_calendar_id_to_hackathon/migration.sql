-- AlterTable
ALTER TABLE "public"."Hackathon" ADD COLUMN     "event" TEXT DEFAULT 'hackathon';
ALTER TABLE "public"."Hackathon" ADD COLUMN     "google_calendar_id" TEXT;
