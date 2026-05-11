-- Add website and socials columns to Project table if they don't exist
-- These columns are JSONB type for flexible data storage

DO $$
BEGIN
    -- Add website column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Project' 
        AND column_name = 'website'
    ) THEN
        ALTER TABLE "Project" 
        ADD COLUMN "website" JSONB DEFAULT NULL;
    END IF;

    -- Add socials column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Project' 
        AND column_name = 'socials'
    ) THEN
        ALTER TABLE "Project" 
        ADD COLUMN "socials" JSONB DEFAULT NULL;
    END IF;
END $$;
