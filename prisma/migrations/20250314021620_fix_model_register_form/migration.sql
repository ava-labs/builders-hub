/*
  Warnings:

  - You are about to drop the column `companyName` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `githubPortfolio` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `hackathonId` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `hackathonParticipation` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `newsletterSubscription` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `prohibitedItems` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `termsEventConditions` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `RegisterForm` table. All the data in the column will be lost.
  - You are about to drop the column `web3Proficiency` on the `RegisterForm` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hackathon_id,email]` on the table `RegisterForm` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hackathon_id` to the `RegisterForm` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hackathon_participation` to the `RegisterForm` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `RegisterForm` table without a default value. This is not possible if the table is not empty.
  - Added the required column `web3_proficiency` to the `RegisterForm` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RegisterForm" DROP CONSTRAINT "RegisterForm_hackathonId_fkey";

-- DropIndex
DROP INDEX "RegisterForm_hackathonId_email_key";

-- AlterTable
ALTER TABLE "RegisterForm" DROP COLUMN "companyName",
DROP COLUMN "createdAt",
DROP COLUMN "githubPortfolio",
DROP COLUMN "hackathonId",
DROP COLUMN "hackathonParticipation",
DROP COLUMN "newsletterSubscription",
DROP COLUMN "prohibitedItems",
DROP COLUMN "termsEventConditions",
DROP COLUMN "updatedAt",
DROP COLUMN "web3Proficiency",
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "github_portfolio" TEXT,
ADD COLUMN     "hackathon_id" TEXT NOT NULL,
ADD COLUMN     "hackathon_participation" TEXT NOT NULL,
ADD COLUMN     "newsletter_subscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prohibited_items" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terms_event_conditions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "web3_proficiency" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RegisterForm_hackathon_id_email_key" ON "RegisterForm"("hackathon_id", "email");

-- AddForeignKey
ALTER TABLE "RegisterForm" ADD CONSTRAINT "RegisterForm_hackathon_id_fkey" FOREIGN KEY ("hackathon_id") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
