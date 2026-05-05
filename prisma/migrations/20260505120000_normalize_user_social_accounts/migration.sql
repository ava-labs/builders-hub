-- Rename profile social columns to the canonical account fields.
ALTER TABLE "User" RENAME COLUMN "github" TO "github_account";
ALTER TABLE "User" RENAME COLUMN "social_media" TO "additional_social_media";
ALTER TABLE "User" RENAME COLUMN "x_handle" TO "x_account";
ALTER TABLE "User" RENAME COLUMN "linkedin_url" TO "linkedin_account";

-- Move known social profile links out of the catch-all array without
-- overwriting values that already exist in their dedicated columns.
WITH normalized_socials AS (
  SELECT
    u.id,
    (
      ARRAY_AGG(entry.value ORDER BY entry.ordinality)
      FILTER (
        WHERE entry.value IS NOT NULL
          AND BTRIM(entry.value) <> ''
          AND (
            LOWER(entry.value) ~ '(^https?://(www[.])?)?github[.]com/'
            OR LOWER(entry.value) LIKE 'github:%'
            OR LOWER(entry.value) LIKE 'github %'
          )
      )
    )[1] AS github_account,
    (
      ARRAY_AGG(entry.value ORDER BY entry.ordinality)
      FILTER (
        WHERE entry.value IS NOT NULL
          AND BTRIM(entry.value) <> ''
          AND (
            LOWER(entry.value) ~ '(^https?://(www[.])?)?(x|twitter)[.]com/'
            OR LOWER(entry.value) LIKE 'x:%'
            OR LOWER(entry.value) LIKE 'twitter:%'
            OR LOWER(entry.value) LIKE 'twitter %'
          )
      )
    )[1] AS x_account,
    (
      ARRAY_AGG(entry.value ORDER BY entry.ordinality)
      FILTER (
        WHERE entry.value IS NOT NULL
          AND BTRIM(entry.value) <> ''
          AND (
            LOWER(entry.value) ~ '(^https?://(www[.])?)?linkedin[.]com/'
            OR LOWER(entry.value) LIKE 'linkedin:%'
            OR LOWER(entry.value) LIKE 'linkedin %'
          )
      )
    )[1] AS linkedin_account,
    (
      ARRAY_AGG(entry.value ORDER BY entry.ordinality)
      FILTER (
        WHERE entry.value IS NOT NULL
          AND BTRIM(entry.value) <> ''
          AND (
            LOWER(entry.value) ~ '(^https?://(www[.])?)?(t[.]me|telegram[.]me|telegram[.]org)/'
            OR LOWER(entry.value) LIKE 'telegram:%'
            OR LOWER(entry.value) LIKE 'telegram %'
          )
      )
    )[1] AS telegram_user,
    COALESCE(
      ARRAY_AGG(entry.value ORDER BY entry.ordinality)
      FILTER (
        WHERE entry.value IS NOT NULL
          AND BTRIM(entry.value) <> ''
          AND NOT (
            LOWER(entry.value) ~ '(^https?://(www[.])?)?github[.]com/'
            OR LOWER(entry.value) LIKE 'github:%'
            OR LOWER(entry.value) LIKE 'github %'
            OR LOWER(entry.value) ~ '(^https?://(www[.])?)?(x|twitter)[.]com/'
            OR LOWER(entry.value) LIKE 'x:%'
            OR LOWER(entry.value) LIKE 'twitter:%'
            OR LOWER(entry.value) LIKE 'twitter %'
            OR LOWER(entry.value) ~ '(^https?://(www[.])?)?linkedin[.]com/'
            OR LOWER(entry.value) LIKE 'linkedin:%'
            OR LOWER(entry.value) LIKE 'linkedin %'
            OR LOWER(entry.value) ~ '(^https?://(www[.])?)?(t[.]me|telegram[.]me|telegram[.]org)/'
            OR LOWER(entry.value) LIKE 'telegram:%'
            OR LOWER(entry.value) LIKE 'telegram %'
          )
      ),
      ARRAY[]::TEXT[]
    ) AS additional_social_media
  FROM "User" u
  LEFT JOIN LATERAL UNNEST(COALESCE(u."additional_social_media", ARRAY[]::TEXT[]))
    WITH ORDINALITY AS entry(value, ordinality) ON TRUE
  GROUP BY u.id
)
UPDATE "User" u
SET
  "github_account" = COALESCE(NULLIF(u."github_account", ''), normalized_socials.github_account),
  "x_account" = COALESCE(NULLIF(u."x_account", ''), normalized_socials.x_account),
  "linkedin_account" = COALESCE(NULLIF(u."linkedin_account", ''), normalized_socials.linkedin_account),
  "telegram_user" = COALESCE(NULLIF(u."telegram_user", ''), normalized_socials.telegram_user),
  "additional_social_media" = normalized_socials.additional_social_media
FROM normalized_socials
WHERE u.id = normalized_socials.id;

UPDATE "User"
SET "additional_social_media" = ARRAY[]::TEXT[]
WHERE "additional_social_media" IS NULL;

ALTER TABLE "User" ALTER COLUMN "additional_social_media" SET DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ALTER COLUMN "additional_social_media" SET NOT NULL;
