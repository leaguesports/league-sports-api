-- Player Handicap Index on Profile, plus golf-round tee / handicap snapshots.
-- Additive only: existing Profile, GolfRound, and GolfRoundPlayer rows stay valid.

ALTER TABLE "Profile" ADD COLUMN "golfHandicapIndex" DECIMAL(4,1);

ALTER TABLE "GolfRound" ADD COLUMN "teeId" TEXT;
ALTER TABLE "GolfRound" ADD COLUMN "courseRating" DECIMAL(4,1);
ALTER TABLE "GolfRound" ADD COLUMN "slopeRating" INTEGER;
ALTER TABLE "GolfRound" ADD COLUMN "teePar" INTEGER;

ALTER TABLE "GolfRoundPlayer" ADD COLUMN "handicapIndexUsed" DECIMAL(4,1);
ALTER TABLE "GolfRoundPlayer" ADD COLUMN "courseHandicap" INTEGER;
ALTER TABLE "GolfRoundPlayer" ADD COLUMN "playingHandicap" INTEGER;
ALTER TABLE "GolfRoundPlayer" ADD COLUMN "grossTotal" INTEGER;
ALTER TABLE "GolfRoundPlayer" ADD COLUMN "netTotal" INTEGER;
