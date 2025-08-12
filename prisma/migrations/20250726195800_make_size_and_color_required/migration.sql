-- First update existing NULL values with default values
UPDATE "Product" SET "size" = 'Default' WHERE "size" IS NULL;
UPDATE "Product" SET "color" = 'Default' WHERE "color" IS NULL;

-- Then make the columns required
ALTER TABLE "Product" ALTER COLUMN "color" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "size" SET NOT NULL;
