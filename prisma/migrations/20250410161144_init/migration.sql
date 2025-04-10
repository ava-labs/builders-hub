-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "total_prizes" INTEGER NOT NULL,
    "tags" TEXT[],
    "content" JSONB NOT NULL DEFAULT '{}',
    "end_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "banner" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "small_banner" TEXT NOT NULL DEFAULT '',
    "participants" INTEGER NOT NULL,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "image" TEXT,
    "authentication_mode" TEXT,
    "integration" TEXT,
    "last_login" TIMESTAMP(3),
    "user_name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "RegisterForm" (
    "id" TEXT NOT NULL,
    "utm" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "dietary" TEXT,
    "email" TEXT NOT NULL,
    "interests" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tools" TEXT NOT NULL,
    "company_name" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "github_portfolio" TEXT,
    "hackathon_id" TEXT NOT NULL,
    "hackathon_participation" TEXT NOT NULL,
    "newsletter_subscription" BOOLEAN NOT NULL DEFAULT false,
    "prohibited_items" BOOLEAN NOT NULL DEFAULT false,
    "terms_event_conditions" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "web3_proficiency" TEXT NOT NULL,

    CONSTRAINT "RegisterForm_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterForm_email_key" ON "RegisterForm"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterForm_hackathon_id_email_key" ON "RegisterForm"("hackathon_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_user_id_project_id_key" ON "Member"("user_id", "project_id");

-- AddForeignKey
ALTER TABLE "RegisterForm" ADD CONSTRAINT "RegisterForm_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterForm" ADD CONSTRAINT "RegisterForm_hackathon_id_fkey" FOREIGN KEY ("hackathon_id") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_hackaton_id_fkey" FOREIGN KEY ("hackaton_id") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
