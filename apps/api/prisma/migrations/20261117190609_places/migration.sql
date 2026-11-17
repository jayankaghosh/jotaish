-- CreateTable
CREATE TABLE "Place" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceName" (
    "placeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PlaceName_pkey" PRIMARY KEY ("placeId","name")
);

-- AddForeignKey
ALTER TABLE "PlaceName" ADD CONSTRAINT "PlaceName_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prefix search ("koz%") needs an index that compares text byte by byte.
CREATE INDEX "PlaceName_name_prefix_idx" ON "PlaceName" ("name" text_pattern_ops);
