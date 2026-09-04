-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "handle" TEXT;
ALTER TABLE "Profile" ADD COLUMN "avatarUrl" TEXT;

-- Backfill unique handles for existing profiles
UPDATE "Profile"
SET "handle" = 'user_' || substr(replace("userId", '-', ''), 1, 12)
WHERE "handle" IS NULL;

-- Ensure uniqueness if collision (extremely unlikely with userId prefix)
UPDATE "Profile" AS p
SET "handle" = p."handle" || '_' || substr(p."id", 1, 4)
WHERE EXISTS (
  SELECT 1 FROM "Profile" AS other
  WHERE other."handle" = p."handle" AND other."id" <> p."id"
);

ALTER TABLE "Profile" ALTER COLUMN "handle" SET NOT NULL;

CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");
