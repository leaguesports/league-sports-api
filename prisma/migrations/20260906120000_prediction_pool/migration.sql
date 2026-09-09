-- CreateEnum
CREATE TYPE "PredictionPoolMemberRole" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "PredictionWinner" AS ENUM ('home', 'away', 'draw');

-- CreateTable
CREATE TABLE "PredictionPool" (
    "id" TEXT NOT NULL,
    "fixtureSlug" VARCHAR(80) NOT NULL,
    "title" TEXT,
    "inviteCode" VARCHAR(16) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "kicksOffAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "resultHomeScore" INTEGER,
    "resultAwayScore" INTEGER,
    "resultWinner" "PredictionWinner",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionPoolEntry" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PredictionPoolMemberRole" NOT NULL DEFAULT 'member',
    "tip" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winner" "PredictionWinner",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionPoolEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PredictionPool_inviteCode_key" ON "PredictionPool"("inviteCode");

-- CreateIndex
CREATE INDEX "PredictionPool_fixtureSlug_idx" ON "PredictionPool"("fixtureSlug");

-- CreateIndex
CREATE INDEX "PredictionPool_createdByUserId_idx" ON "PredictionPool"("createdByUserId");

-- CreateIndex
CREATE INDEX "PredictionPoolEntry_userId_idx" ON "PredictionPoolEntry"("userId");

-- CreateIndex
CREATE INDEX "PredictionPoolEntry_poolId_idx" ON "PredictionPoolEntry"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionPoolEntry_poolId_userId_key" ON "PredictionPoolEntry"("poolId", "userId");

-- AddForeignKey
ALTER TABLE "PredictionPoolEntry" ADD CONSTRAINT "PredictionPoolEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "PredictionPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
