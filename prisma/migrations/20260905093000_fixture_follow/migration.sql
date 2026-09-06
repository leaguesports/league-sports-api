-- CreateTable
CREATE TABLE "FixtureFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fixtureSlug" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixtureFollow_userId_idx" ON "FixtureFollow"("userId");

-- CreateIndex
CREATE INDEX "FixtureFollow_fixtureSlug_idx" ON "FixtureFollow"("fixtureSlug");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureFollow_userId_fixtureSlug_key" ON "FixtureFollow"("userId", "fixtureSlug");
