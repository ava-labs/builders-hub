-- CreateTable
CREATE TABLE "RegisterForm" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "utm" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "companyName" TEXT,
    "dietary" TEXT,
    "email" TEXT NOT NULL,
    "githubPortfolio" TEXT,
    "hackathonParticipation" TEXT NOT NULL,
    "interests" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "newsletterSubscription" BOOLEAN NOT NULL DEFAULT false,
    "prohibitedItems" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL,
    "termsEventConditions" BOOLEAN NOT NULL DEFAULT false,
    "tools" TEXT NOT NULL,
    "web3Proficiency" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RegisterForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegisterForm_email_key" ON "RegisterForm"("email");

-- AddForeignKey
ALTER TABLE "RegisterForm" ADD CONSTRAINT "RegisterForm_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterForm" ADD CONSTRAINT "RegisterForm_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
