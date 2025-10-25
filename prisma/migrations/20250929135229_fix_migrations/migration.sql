
-- CreateTable
CREATE TABLE "public"."NodeRegistration" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subnet_id" TEXT NOT NULL,
    "blockchain_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_index" INTEGER,
    "public_key" TEXT NOT NULL,
    "proof_of_possession" TEXT NOT NULL,
    "rpc_url" TEXT NOT NULL,
    "chain_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NodeRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsoleLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "action_path" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsoleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NodeRegistration_user_id_idx" ON "public"."NodeRegistration"("user_id");

-- CreateIndex
CREATE INDEX "NodeRegistration_status_idx" ON "public"."NodeRegistration"("status");

-- CreateIndex
CREATE INDEX "NodeRegistration_subnet_id_idx" ON "public"."NodeRegistration"("subnet_id");

-- CreateIndex
CREATE UNIQUE INDEX "NodeRegistration_user_id_subnet_id_node_index_key" ON "public"."NodeRegistration"("user_id", "subnet_id", "node_index");

-- CreateIndex
CREATE INDEX "ConsoleLog_user_id_idx" ON "public"."ConsoleLog"("user_id");

-- CreateIndex
CREATE INDEX "ConsoleLog_created_at_idx" ON "public"."ConsoleLog"("created_at");

-- AddForeignKey
ALTER TABLE "public"."NodeRegistration" ADD CONSTRAINT "NodeRegistration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsoleLog" ADD CONSTRAINT "ConsoleLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

