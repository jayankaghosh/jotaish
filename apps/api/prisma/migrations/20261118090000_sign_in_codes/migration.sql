-- AlterTable
ALTER TABLE "User" DROP COLUMN "verifyAttempts",
DROP COLUMN "verifyCodeExpiresAt",
DROP COLUMN "verifyCodeHash",
DROP COLUMN "verifyCodeSentAt",
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SignInCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignInCode_email_createdAt_idx" ON "SignInCode"("email", "createdAt");

