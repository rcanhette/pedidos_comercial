CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

CREATE UNIQUE INDEX "Customer_cnpj_key" ON "Customer"("cnpj");
CREATE INDEX "Customer_active_idx" ON "Customer"("active");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_city_idx" ON "Customer"("city");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
