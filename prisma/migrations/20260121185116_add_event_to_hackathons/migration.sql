DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Hackathon' 
        AND column_name = 'event'
    ) THEN
        ALTER TABLE public."Hackathon"
        ADD COLUMN event text DEFAULT 'hackathon';

        RAISE NOTICE 'Column event added to the Hackathon table';
    ELSE
        RAISE NOTICE 'The column event already exists in the Hackathon table';
    END IF;
END $$;
