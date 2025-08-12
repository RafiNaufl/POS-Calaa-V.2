-- Drop the existing column if it exists
ALTER TABLE "Promotion" DROP COLUMN IF EXISTS "discountType";

-- Add the column back
ALTER TABLE "Promotion" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE';