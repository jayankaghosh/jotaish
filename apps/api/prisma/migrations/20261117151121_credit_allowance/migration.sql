-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditLimit" INTEGER,
ADD COLUMN     "unlimitedCredits" BOOLEAN NOT NULL DEFAULT false;
