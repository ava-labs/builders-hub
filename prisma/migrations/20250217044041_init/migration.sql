-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "total_prizes" INTEGER,
    "tags" TEXT[],
    "status" TEXT NOT NULL,
    "registration_deadline" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "agenda" JSONB,
    "partners" JSONB NOT NULL,
    "tracks" JSONB NOT NULL,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);
