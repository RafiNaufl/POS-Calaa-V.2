-- DropColumn
ALTER TABLE "public"."Transaction" DROP COLUMN "dokuReferenceId";

-- AddColumn
ALTER TABLE "public"."Transaction" ADD COLUMN "dokuReferenceId" TEXT;