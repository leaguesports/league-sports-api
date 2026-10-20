-- User, Account, Profile, and Venue were created outside this migrations
-- folder (prisma db push, before Migrate). A fresh database has to create
-- them before the ALTERs below. Production already applied this migration,
-- so this file is not executed again there.
--
-- Guards: CREATE TABLE / INDEX IF NOT EXISTS, and constraints only when
-- missing, so a database that already has the baseline is unchanged if this
-- SQL is ever applied by hand.

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerId_key" ON "Account"("provider", "providerId");

CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_key" ON "Profile"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Profile_email_key" ON "Profile"("email");

DO $$ BEGIN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

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
