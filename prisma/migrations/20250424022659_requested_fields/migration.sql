-- AlterTable
ALTER TABLE "Hackathon" ADD COLUMN     "custom_link" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "RegisterForm" ADD COLUMN     "telegram_user" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "custom_attributes" TEXT[],
ADD COLUMN     "telegram_user" TEXT;
