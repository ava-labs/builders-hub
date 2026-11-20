-- Validator alerts imported from Avalanche Notify: a subscriber without a
-- Builder Hub account has no user. Sign-in attaches the row by email.
ALTER TABLE "ValidatorAlert" ADD COLUMN     "source" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- The sign-in claim looks up rows by email.
CREATE INDEX "ValidatorAlert_email_idx" ON "ValidatorAlert"("email");
