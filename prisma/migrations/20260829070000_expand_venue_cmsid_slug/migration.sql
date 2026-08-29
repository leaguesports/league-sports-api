-- Existing Venue rows are not correlated to Sanity. cmsIds cannot be invented
-- for them. Add columns as nullable, drop uncorrelated rows, then enforce NOT NULL.
-- An empty table is a no-op for the DELETE.

ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "cmsId" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "slug" TEXT;

DELETE FROM "Venue"
WHERE "cmsId" IS NULL
   OR btrim("cmsId") = ''
   OR "slug" IS NULL
   OR btrim("slug") = '';

ALTER TABLE "Venue" ALTER COLUMN "cmsId" SET NOT NULL;
ALTER TABLE "Venue" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Venue_cmsId_key" ON "Venue"("cmsId");
