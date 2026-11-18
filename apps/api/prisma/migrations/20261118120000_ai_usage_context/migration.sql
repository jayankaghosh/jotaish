-- AlterTable
ALTER TABLE "AiUsage" ADD COLUMN "language" TEXT,
ADD COLUMN "conversationId" TEXT,
ADD COLUMN "readingId" TEXT;

-- DropIndex
DROP INDEX "AiUsage_userId_idx";

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");
