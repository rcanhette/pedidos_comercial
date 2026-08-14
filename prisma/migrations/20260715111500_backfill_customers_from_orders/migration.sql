INSERT INTO "Customer" ("id", "name", "city", "cnpj", "active", "createdAt", "updatedAt")
SELECT
  'cust_' || md5("cnpj") AS "id",
  MIN("customerName") AS "name",
  MIN("city") AS "city",
  "cnpj",
  true AS "active",
  CURRENT_TIMESTAMP AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "Order"
WHERE "customerId" IS NULL
GROUP BY "cnpj"
ON CONFLICT ("cnpj") DO NOTHING;

UPDATE "Order" AS o
SET "customerId" = c."id"
FROM "Customer" AS c
WHERE o."customerId" IS NULL
  AND o."cnpj" = c."cnpj";
