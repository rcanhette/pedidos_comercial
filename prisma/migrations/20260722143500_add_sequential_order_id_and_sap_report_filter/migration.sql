ALTER TABLE "Order" ADD COLUMN "sequentialId" INTEGER;

WITH ordered_orders AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "solicitationAt" ASC, "id" ASC)::INTEGER AS "seq"
  FROM "Order"
)
UPDATE "Order"
SET "sequentialId" = ordered_orders."seq"
FROM ordered_orders
WHERE "Order"."id" = ordered_orders."id";

CREATE SEQUENCE "Order_sequentialId_seq";
SELECT setval('"Order_sequentialId_seq"', COALESCE((SELECT MAX("sequentialId") FROM "Order"), 0) + 1, false);
ALTER TABLE "Order" ALTER COLUMN "sequentialId" SET DEFAULT nextval('"Order_sequentialId_seq"');
ALTER SEQUENCE "Order_sequentialId_seq" OWNED BY "Order"."sequentialId";
ALTER TABLE "Order" ALTER COLUMN "sequentialId" SET NOT NULL;

CREATE UNIQUE INDEX "Order_sequentialId_key" ON "Order"("sequentialId");
CREATE INDEX "Order_sapOrderNumber_idx" ON "Order"("sapOrderNumber");
