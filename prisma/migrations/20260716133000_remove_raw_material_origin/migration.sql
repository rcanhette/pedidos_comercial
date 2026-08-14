DROP INDEX IF EXISTS "Order_rawMaterialOrigin_idx";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "rawMaterialOrigin";
