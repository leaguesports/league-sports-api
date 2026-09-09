-- CreateEnum
CREATE TYPE "GolfTourStatus" AS ENUM ('draft', 'active', 'completed');

-- CreateEnum
CREATE TYPE "GolfTourFormat" AS ENUM ('stroke');

-- CreateEnum
CREATE TYPE "GolfTourFourballStatus" AS ENUM ('pending', 'live', 'locked', 'cancelled');

-- CreateTable
CREATE TABLE "GolfTour" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "GolfTourStatus" NOT NULL DEFAULT 'draft',
    "hostUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GolfTour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfTourCamp" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GolfTourCamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfTourRound" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "label" TEXT,
    "format" "GolfTourFormat" NOT NULL DEFAULT 'stroke',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GolfTourRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfTourFourball" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "golfRoundId" TEXT,
    "status" "GolfTourFourballStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GolfTourFourball_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfTourFourballPlayer" (
    "id" TEXT NOT NULL,
    "fourballId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL,

    CONSTRAINT "GolfTourFourballPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GolfTour_hostUserId_idx" ON "GolfTour"("hostUserId");

-- CreateIndex
CREATE INDEX "GolfTour_status_startDate_idx" ON "GolfTour"("status", "startDate");

-- CreateIndex
CREATE INDEX "GolfTour_hostUserId_status_idx" ON "GolfTour"("hostUserId", "status");

-- CreateIndex
CREATE INDEX "GolfTourCamp_tourId_idx" ON "GolfTourCamp"("tourId");

-- CreateIndex
CREATE INDEX "GolfTourRound_tourId_idx" ON "GolfTourRound"("tourId");

-- CreateIndex
CREATE INDEX "GolfTourRound_venueCmsId_idx" ON "GolfTourRound"("venueCmsId");

-- CreateIndex
CREATE UNIQUE INDEX "GolfTourFourball_golfRoundId_key" ON "GolfTourFourball"("golfRoundId");

-- CreateIndex
CREATE INDEX "GolfTourFourball_tourId_idx" ON "GolfTourFourball"("tourId");

-- CreateIndex
CREATE INDEX "GolfTourFourball_roundId_idx" ON "GolfTourFourball"("roundId");

-- CreateIndex
CREATE INDEX "GolfTourFourball_campId_idx" ON "GolfTourFourball"("campId");

-- CreateIndex
CREATE INDEX "GolfTourFourball_golfRoundId_idx" ON "GolfTourFourball"("golfRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "GolfTourFourballPlayer_fourballId_slot_key" ON "GolfTourFourballPlayer"("fourballId", "slot");

-- CreateIndex
CREATE INDEX "GolfTourFourballPlayer_userId_idx" ON "GolfTourFourballPlayer"("userId");

-- CreateIndex
CREATE INDEX "GolfTourFourballPlayer_fourballId_idx" ON "GolfTourFourballPlayer"("fourballId");

-- AddForeignKey
ALTER TABLE "GolfTourCamp" ADD CONSTRAINT "GolfTourCamp_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "GolfTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourRound" ADD CONSTRAINT "GolfTourRound_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "GolfTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourRound" ADD CONSTRAINT "GolfTourRound_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourFourball" ADD CONSTRAINT "GolfTourFourball_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "GolfTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourFourball" ADD CONSTRAINT "GolfTourFourball_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GolfTourRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourFourball" ADD CONSTRAINT "GolfTourFourball_campId_fkey" FOREIGN KEY ("campId") REFERENCES "GolfTourCamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourFourball" ADD CONSTRAINT "GolfTourFourball_golfRoundId_fkey" FOREIGN KEY ("golfRoundId") REFERENCES "GolfRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourFourballPlayer" ADD CONSTRAINT "GolfTourFourballPlayer_fourballId_fkey" FOREIGN KEY ("fourballId") REFERENCES "GolfTourFourball"("id") ON DELETE CASCADE ON UPDATE CASCADE;
