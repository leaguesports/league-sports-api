-- AlterTable
ALTER TABLE "Match" ADD COLUMN "lockedByUserId" TEXT;

-- AlterTable
ALTER TABLE "GolfRound" ADD COLUMN "lockedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Match_lockedByUserId_idx" ON "Match"("lockedByUserId");

-- CreateIndex
CREATE INDEX "GolfRound_lockedByUserId_idx" ON "GolfRound"("lockedByUserId");
