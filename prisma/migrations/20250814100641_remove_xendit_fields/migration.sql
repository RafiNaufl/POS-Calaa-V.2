/*
  Warnings:

  - You are about to drop the column `xenditChargeId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `xenditReferenceId` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "xenditChargeId",
DROP COLUMN "xenditReferenceId";
