-- AlterTable
ALTER TABLE "public"."Hackathon" ADD COLUMN     "updated_by" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Hackathon" ADD CONSTRAINT "Hackathon_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
