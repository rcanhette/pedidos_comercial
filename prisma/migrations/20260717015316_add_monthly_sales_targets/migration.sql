-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetTonsScaled" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesTarget_year_idx" ON "SalesTarget"("year");

-- CreateIndex
CREATE INDEX "SalesTarget_updatedById_idx" ON "SalesTarget"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_year_month_key" ON "SalesTarget"("year", "month");

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
