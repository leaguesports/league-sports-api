-- CreateTable
CREATE TABLE "VenueFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueCmsId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueFollow_userId_idx" ON "VenueFollow"("userId");

-- CreateIndex
CREATE INDEX "VenueFollow_venueCmsId_idx" ON "VenueFollow"("venueCmsId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueFollow_userId_venueCmsId_key" ON "VenueFollow"("userId", "venueCmsId");

-- AddForeignKey
ALTER TABLE "VenueFollow" ADD CONSTRAINT "VenueFollow_venueCmsId_fkey" FOREIGN KEY ("venueCmsId") REFERENCES "Venue"("cmsId") ON DELETE CASCADE ON UPDATE CASCADE;
