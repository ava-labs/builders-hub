-- The NFT Deployment course was removed from the Academy (FDE-154), so nobody
-- can complete it any more, but the Blockchain Academy Graduate badge still
-- required it. Drop that requirement and keep the other requirements in their
-- order. Idempotent: once the requirement is gone, the WHERE matches no row.

UPDATE "Badge"
SET requirements = COALESCE(
  (SELECT array_agg(t.r ORDER BY t.ord)
   FROM unnest(requirements) WITH ORDINALITY AS t(r, ord)
   WHERE t.r->>'course_id' IS DISTINCT FROM 'nft-deployment'),
  ARRAY[]::jsonb[])
WHERE id = '2blockchainAcademy-6academy-full-completion'
  AND EXISTS (SELECT 1 FROM unnest(requirements) AS r
              WHERE r->>'course_id' = 'nft-deployment');
