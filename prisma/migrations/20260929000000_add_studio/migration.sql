-- CreateTable
CREATE TABLE "StudioProject" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "blueprint_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "networks" JSONB NOT NULL DEFAULT '{}',
    "params" JSONB NOT NULL DEFAULT '{}',
    "runtime" JSONB NOT NULL DEFAULT '{}',
    "stage" TEXT NOT NULL DEFAULT 'testnet',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudioProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioChat" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudioChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioMessage" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "usage" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioMessage_pkey" PRIMARY KEY ("chat_id","id")
);

-- CreateTable
CREATE TABLE "StudioFile" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudioFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioBuild" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "files_hash" TEXT NOT NULL,
    "compiler" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "diagnostics" JSONB NOT NULL DEFAULT '[]',
    "contracts" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioAuditReport" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "counts" JSONB NOT NULL,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "acknowledged" JSONB NOT NULL DEFAULT '[]',
    "tool_version" TEXT NOT NULL,
    "review" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioAuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioDeployment" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "blueprint_id" TEXT,
    "networks" JSONB NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "plan" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "steps" JSONB NOT NULL DEFAULT '{}',
    "checks" JSONB NOT NULL DEFAULT '[]',
    "signer" TEXT,
    "promotion_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "StudioDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioPromotion" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_deployment_id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "network_map" JSONB NOT NULL,
    "gates" JSONB NOT NULL DEFAULT '[]',
    "tests_confirmed_at" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'ready',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudioPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioProject_user_id_updated_at_idx" ON "StudioProject"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "StudioChat_project_id_updated_at_idx" ON "StudioChat"("project_id", "updated_at");

-- CreateIndex
CREATE INDEX "StudioMessage_chat_id_created_at_idx" ON "StudioMessage"("chat_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "StudioFile_project_id_path_key" ON "StudioFile"("project_id", "path");

-- CreateIndex
CREATE INDEX "StudioBuild_project_id_created_at_idx" ON "StudioBuild"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "StudioAuditReport_project_id_created_at_idx" ON "StudioAuditReport"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "StudioAuditReport_build_id_idx" ON "StudioAuditReport"("build_id");

-- CreateIndex
CREATE INDEX "StudioDeployment_project_id_created_at_idx" ON "StudioDeployment"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "StudioDeployment_promotion_id_idx" ON "StudioDeployment"("promotion_id");

-- CreateIndex
CREATE INDEX "StudioPromotion_project_id_created_at_idx" ON "StudioPromotion"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "StudioProject" ADD CONSTRAINT "StudioProject_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioChat" ADD CONSTRAINT "StudioChat_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioMessage" ADD CONSTRAINT "StudioMessage_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "StudioChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioFile" ADD CONSTRAINT "StudioFile_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioBuild" ADD CONSTRAINT "StudioBuild_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioAuditReport" ADD CONSTRAINT "StudioAuditReport_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioAuditReport" ADD CONSTRAINT "StudioAuditReport_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "StudioBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioDeployment" ADD CONSTRAINT "StudioDeployment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioDeployment" ADD CONSTRAINT "StudioDeployment_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "StudioBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioDeployment" ADD CONSTRAINT "StudioDeployment_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "StudioPromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioPromotion" ADD CONSTRAINT "StudioPromotion_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "StudioProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioPromotion" ADD CONSTRAINT "StudioPromotion_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "StudioBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioPromotion" ADD CONSTRAINT "StudioPromotion_source_deployment_id_fkey" FOREIGN KEY ("source_deployment_id") REFERENCES "StudioDeployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

