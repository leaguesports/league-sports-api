-- Multi-scorer game days and anonymous organisers.
-- Hole rows move from a single strokes map to a per-slot scores array so two
-- phones can update different players on the same hole. Existing strokes are
-- copied forward with a null writer. organiserUserId becomes optional; the
-- organiser secret is stored only as a sha256 hash.

ALTER TABLE "GameDay" ALTER COLUMN "organiserUserId" DROP NOT NULL;
ALTER TABLE "GameDay" ADD COLUMN "organiserTokenHash" TEXT;
CREATE UNIQUE INDEX "GameDay_organiserTokenHash_key" ON "GameDay"("organiserTokenHash");

ALTER TABLE "WeekendEvent" ALTER COLUMN "organiserUserId" DROP NOT NULL;
ALTER TABLE "WeekendEvent" ADD COLUMN "organiserTokenHash" TEXT;

ALTER TABLE "GameDayHoleScore" ADD COLUMN "scores" JSONB;

UPDATE "GameDayHoleScore"
SET "scores" = CASE
  WHEN jsonb_typeof("strokes") = 'object' THEN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'slot', (entry.key)::int,
          'strokes', (entry.value)::int,
          'updatedByPlayerId', NULL,
          'updatedByName', NULL,
          'updatedAt', to_char("clientTimestamp", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'clientTimestamp', to_char("clientTimestamp", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        )
        ORDER BY (entry.key)::int
      )
      FROM jsonb_each_text("strokes") AS entry
    ),
    '[]'::jsonb
  )
  ELSE '[]'::jsonb
END;

ALTER TABLE "GameDayHoleScore" ALTER COLUMN "scores" SET NOT NULL;
ALTER TABLE "GameDayHoleScore" DROP COLUMN "strokes";
ALTER TABLE "GameDayHoleScore" DROP COLUMN "clientTimestamp";
