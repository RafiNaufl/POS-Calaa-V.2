-- AlterTable
ALTER TABLE "public"."Voucher" ADD COLUMN     "restrictedToCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "restrictedToProducts" TEXT[] DEFAULT ARRAY[]::TEXT[];
