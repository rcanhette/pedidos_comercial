-- Add auxiliary catalogs for contract types, raw material closings and raw materials.
CREATE TABLE "ContractType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawMaterialClosing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RawMaterialClosing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderRawMaterial" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "rawMaterialNameSnapshot" TEXT NOT NULL,
    "quantityKgScaled" INTEGER NOT NULL,
    "quantityTonsScaled" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderRawMaterial_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "contractTypeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "contractTypeNameSnapshot" TEXT;
ALTER TABLE "Order" ADD COLUMN "rawMaterialClosingId" TEXT;
ALTER TABLE "Order" ADD COLUMN "rawMaterialClosingNameSnapshot" TEXT;
ALTER TABLE "Order" ADD COLUMN "rawMaterialOrigin" TEXT;

-- Previsão de retirada passa a representar mês/ano; o dia 01 é técnico.
UPDATE "Order"
SET "pickupForecast" = date_trunc('month', "pickupForecast")
WHERE "pickupForecast" IS NOT NULL;

ALTER TABLE "Product" DROP COLUMN "code";
ALTER TABLE "Order" DROP COLUMN "productCodeSnapshot";

CREATE UNIQUE INDEX "ContractType_name_key" ON "ContractType"("name");
CREATE INDEX "ContractType_active_idx" ON "ContractType"("active");
CREATE INDEX "ContractType_name_idx" ON "ContractType"("name");

CREATE UNIQUE INDEX "RawMaterialClosing_name_key" ON "RawMaterialClosing"("name");
CREATE INDEX "RawMaterialClosing_active_idx" ON "RawMaterialClosing"("active");
CREATE INDEX "RawMaterialClosing_name_idx" ON "RawMaterialClosing"("name");

CREATE UNIQUE INDEX "RawMaterial_name_key" ON "RawMaterial"("name");
CREATE INDEX "RawMaterial_active_idx" ON "RawMaterial"("active");
CREATE INDEX "RawMaterial_name_idx" ON "RawMaterial"("name");

CREATE UNIQUE INDEX "OrderRawMaterial_orderId_rawMaterialId_key" ON "OrderRawMaterial"("orderId", "rawMaterialId");
CREATE INDEX "OrderRawMaterial_orderId_idx" ON "OrderRawMaterial"("orderId");
CREATE INDEX "OrderRawMaterial_rawMaterialId_idx" ON "OrderRawMaterial"("rawMaterialId");

CREATE INDEX "Order_contractTypeId_idx" ON "Order"("contractTypeId");
CREATE INDEX "Order_rawMaterialClosingId_idx" ON "Order"("rawMaterialClosingId");
CREATE INDEX "Order_rawMaterialOrigin_idx" ON "Order"("rawMaterialOrigin");

ALTER TABLE "Order" ADD CONSTRAINT "Order_contractTypeId_fkey" FOREIGN KEY ("contractTypeId") REFERENCES "ContractType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_rawMaterialClosingId_fkey" FOREIGN KEY ("rawMaterialClosingId") REFERENCES "RawMaterialClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderRawMaterial" ADD CONSTRAINT "OrderRawMaterial_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRawMaterial" ADD CONSTRAINT "OrderRawMaterial_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
