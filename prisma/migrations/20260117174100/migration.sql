DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Hackathon' 
        AND column_name = 'cohosts'
    ) THEN
        ALTER TABLE public."Hackathon"
        ADD COLUMN cohosts text[] DEFAULT '{}';

        RAISE NOTICE 'Column cohosts added to the Hackathon table';
    ELSE
        RAISE NOTICE 'The column cohosts already exists in the Hackathon table';
    END IF;
END $$;
