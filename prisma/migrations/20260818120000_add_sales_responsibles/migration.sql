CREATE TABLE "SalesResponsible" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesResponsible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesResponsible_name_key" ON "SalesResponsible"("name");
CREATE INDEX "SalesResponsible_active_idx" ON "SalesResponsible"("active");
CREATE INDEX "SalesResponsible_name_idx" ON "SalesResponsible"("name");

ALTER TABLE "Order" ADD COLUMN "salesResponsibleId" TEXT;
ALTER TABLE "Order" ADD COLUMN "salesResponsibleNameSnapshot" TEXT;

CREATE INDEX "Order_salesResponsibleId_idx" ON "Order"("salesResponsibleId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_salesResponsibleId_fkey" FOREIGN KEY ("salesResponsibleId") REFERENCES "SalesResponsible"("id") ON DELETE SET NULL ON UPDATE CASCADE;
