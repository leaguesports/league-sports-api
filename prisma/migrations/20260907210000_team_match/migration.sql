-- CreateEnum
CREATE TYPE "TeamMatchStatus" AS ENUM ('pending', 'scheduled', 'live', 'completed', 'declined', 'cancelled');

-- CreateTable
CREATE TABLE "TeamMatch" (
    "id" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT,
    "sport" "TeamSport" NOT NULL,
    "status" "TeamMatchStatus" NOT NULL DEFAULT 'pending',
    "venueCmsId" TEXT,
    "startsAt" TIMESTAMP(3),
    "challengeToken" VARCHAR(32),
    "createdBy" TEXT NOT NULL,
    "winnerTeamId" TEXT,
    "scorecardSport" TEXT,
    "scorecardId" TEXT,
    "scorecardPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMatchLineup" (
    "id" TEXT NOT NULL,
    "teamMatchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatch_challengeToken_key" ON "TeamMatch"("challengeToken");

-- CreateIndex
CREATE INDEX "TeamMatch_homeTeamId_idx" ON "TeamMatch"("homeTeamId");

-- CreateIndex
CREATE INDEX "TeamMatch_awayTeamId_idx" ON "TeamMatch"("awayTeamId");

-- CreateIndex
CREATE INDEX "TeamMatch_status_startsAt_idx" ON "TeamMatch"("status", "startsAt");

-- CreateIndex
CREATE INDEX "TeamMatch_createdBy_idx" ON "TeamMatch"("createdBy");

-- CreateIndex
CREATE INDEX "TeamMatch_scorecardId_idx" ON "TeamMatch"("scorecardId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchLineup_teamMatchId_teamId_userId_key" ON "TeamMatchLineup"("teamMatchId", "teamId", "userId");

-- CreateIndex
CREATE INDEX "TeamMatchLineup_teamMatchId_idx" ON "TeamMatchLineup"("teamMatchId");

-- CreateIndex
CREATE INDEX "TeamMatchLineup_teamId_idx" ON "TeamMatchLineup"("teamId");

-- AddForeignKey
ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatch" ADD CONSTRAINT "TeamMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchLineup" ADD CONSTRAINT "TeamMatchLineup_teamMatchId_fkey" FOREIGN KEY ("teamMatchId") REFERENCES "TeamMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
