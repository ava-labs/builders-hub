-- AlterTable: Add created_at column with default value
ALTER TABLE "User" ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing users: Set created_at to last_login if not null, otherwise keep current timestamp
UPDATE "User" 
SET "created_at" = COALESCE("last_login", CURRENT_TIMESTAMP) 
WHERE "id" IS NOT NULL;
