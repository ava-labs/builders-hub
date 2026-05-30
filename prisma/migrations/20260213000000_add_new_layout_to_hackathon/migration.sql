DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'Hackathon'
        AND column_name = 'new_layout'
    ) THEN
        ALTER TABLE public."Hackathon"
        ADD COLUMN new_layout boolean DEFAULT false;

        RAISE NOTICE 'Column new_layout added to the Hackathon table';
    ELSE
        RAISE NOTICE 'The column new_layout already exists in the Hackathon table';
    END IF;
END $$;
