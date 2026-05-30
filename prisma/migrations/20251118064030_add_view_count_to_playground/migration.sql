-- AlterTable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Playground' AND column_name = 'view_count'
    ) THEN
        ALTER TABLE "Playground" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

