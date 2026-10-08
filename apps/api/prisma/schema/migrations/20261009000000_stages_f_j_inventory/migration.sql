-- CreateEnum
CREATE TYPE "QcOutcome" AS ENUM ('PASS', 'FAIL', 'PARTIAL');

-- AlterEnum
ALTER TYPE "DocStatus" ADD VALUE 'POSTED';

-- AlterEnum
ALTER TYPE "QcResult" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "overReceiptTolerancePct" DECIMAL(7,4) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "overReceiptById" TEXT,
ADD COLUMN     "overReceiptReason" TEXT;

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "overReceivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "quarantineOpenQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "serialNos" TEXT[];

-- AlterTable
ALTER TABLE "MaterialIssue" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MaterialIssueLine" ADD COLUMN     "baseQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestLineId" TEXT,
ADD COLUMN     "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "costCodeId" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "estimatedTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "wbsNodeId" TEXT;

-- AlterTable
ALTER TABLE "MaterialRequestLine" ADD COLUMN     "approvedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purpose" TEXT;

-- AlterTable
ALTER TABLE "MaterialReturn" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "issueId" TEXT;

-- AlterTable
ALTER TABLE "MaterialReturnLine" ADD COLUMN     "baseQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "issueLineId" TEXT,
ADD COLUMN     "serialNo" TEXT,
ADD COLUMN     "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QcInspection" ADD COLUMN     "acceptedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "outcome" "QcOutcome" NOT NULL DEFAULT 'PASS',
ADD COLUMN     "phase" TEXT NOT NULL DEFAULT 'RECEIVING',
ADD COLUMN     "quarantineQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "rejectedQty" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockAdjustmentLine" ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockCount" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockCountLine" ADD COLUMN     "avgCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "counted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WarehouseTransfer" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_locationId_idx" ON "GoodsReceiptLine"("locationId");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_requestLineId_idx" ON "MaterialIssueLine"("requestLineId");

-- CreateIndex
CREATE INDEX "MaterialRequest_employeeId_idx" ON "MaterialRequest"("employeeId");

-- CreateIndex
CREATE INDEX "MaterialRequest_wbsNodeId_idx" ON "MaterialRequest"("wbsNodeId");

-- CreateIndex
CREATE INDEX "MaterialRequest_costCodeId_idx" ON "MaterialRequest"("costCodeId");

-- CreateIndex
CREATE INDEX "MaterialReturn_issueId_idx" ON "MaterialReturn"("issueId");

-- CreateIndex
CREATE INDEX "MaterialReturnLine_issueLineId_idx" ON "MaterialReturnLine"("issueLineId");

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_requestLineId_fkey" FOREIGN KEY ("requestLineId") REFERENCES "MaterialRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturn" ADD CONSTRAINT "MaterialReturn_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "MaterialIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_issueLineId_fkey" FOREIGN KEY ("issueLineId") REFERENCES "MaterialIssueLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Stages F-J: backfill and database-level quantity guards (defense in depth behind the services).
-- ---------------------------------------------------------------------------------------------

-- Requests created before approvedQty existed keep reserving their full quantity.
UPDATE "MaterialRequestLine" SET "approvedQty" = "qty" WHERE "approvedQty" = 0;

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_receivedQty_nonneg" CHECK ("receivedQty" >= 0);
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_qty_bounds"
  CHECK ("issuedQty" >= 0 AND "approvedQty" >= 0 AND "approvedQty" <= "qty");
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_qty_split"
  CHECK ("receivedQty" > 0 AND "acceptedQty" >= 0 AND "rejectedQty" >= 0 AND "quarantineQty" >= 0
         AND "acceptedQty" + "rejectedQty" + "quarantineQty" <= "receivedQty" AND "quarantineOpenQty" >= 0);
