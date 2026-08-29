-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "cmsId" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Venue_cmsId_key" ON "Venue"("cmsId");
