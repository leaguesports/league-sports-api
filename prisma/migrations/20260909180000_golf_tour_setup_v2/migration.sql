-- AlterTable
ALTER TABLE "GolfTourFourball" ADD COLUMN "standingFourballId" TEXT,
ADD COLUMN "sitOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GolfTourFourballPlayer" ADD COLUMN "sitOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GolfTourCampMember" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GolfTourCampMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfTourStandingFourball" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GolfTourStandingFourball_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfTourStandingFourballPlayer" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL,

    CONSTRAINT "GolfTourStandingFourballPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GolfTourCampMember_campId_idx" ON "GolfTourCampMember"("campId");

-- CreateIndex
CREATE INDEX "GolfTourCampMember_userId_idx" ON "GolfTourCampMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GolfTourCampMember_campId_userId_key" ON "GolfTourCampMember"("campId", "userId") WHERE "userId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "GolfTourStandingFourball_tourId_idx" ON "GolfTourStandingFourball"("tourId");

-- CreateIndex
CREATE INDEX "GolfTourStandingFourball_campId_idx" ON "GolfTourStandingFourball"("campId");

-- CreateIndex
CREATE UNIQUE INDEX "GolfTourStandingFourballPlayer_templateId_slot_key" ON "GolfTourStandingFourballPlayer"("templateId", "slot");

-- CreateIndex
CREATE INDEX "GolfTourStandingFourballPlayer_templateId_idx" ON "GolfTourStandingFourballPlayer"("templateId");

-- CreateIndex
CREATE INDEX "GolfTourStandingFourballPlayer_userId_idx" ON "GolfTourStandingFourballPlayer"("userId");

-- CreateIndex
CREATE INDEX "GolfTourFourball_standingFourballId_idx" ON "GolfTourFourball"("standingFourballId");

-- CreateIndex
CREATE UNIQUE INDEX "GolfTourFourball_roundId_standingFourballId_key" ON "GolfTourFourball"("roundId", "standingFourballId") WHERE "standingFourballId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "GolfTourCampMember" ADD CONSTRAINT "GolfTourCampMember_campId_fkey" FOREIGN KEY ("campId") REFERENCES "GolfTourCamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourStandingFourball" ADD CONSTRAINT "GolfTourStandingFourball_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "GolfTour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourStandingFourball" ADD CONSTRAINT "GolfTourStandingFourball_campId_fkey" FOREIGN KEY ("campId") REFERENCES "GolfTourCamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourStandingFourballPlayer" ADD CONSTRAINT "GolfTourStandingFourballPlayer_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GolfTourStandingFourball"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfTourFourball" ADD CONSTRAINT "GolfTourFourball_standingFourballId_fkey" FOREIGN KEY ("standingFourballId") REFERENCES "GolfTourStandingFourball"("id") ON DELETE SET NULL ON UPDATE CASCADE;
