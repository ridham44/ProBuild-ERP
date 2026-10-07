-- Stages B-E: master data, requisition, RFQ/quotation/award, purchase order workflow columns,
-- and real foreign keys for ledger dimensions that used to be plain strings.

-- Safety: refuse to add the dimension foreign keys if any existing ledger row points at nothing.
-- The ledgers are append-only, so orphans cannot be repaired by UPDATE; they must be investigated by hand.
DO $$
DECLARE orphans integer;
BEGIN
  SELECT count(*) INTO orphans FROM "ProjectCostLedger" p WHERE
       (p."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" x WHERE x.id = p."branchId"))
    OR (p."departmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Department" x WHERE x.id = p."departmentId"))
    OR (p."subcontractorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Subcontractor" x WHERE x.id = p."subcontractorId"))
    OR (p."warehouseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Warehouse" x WHERE x.id = p."warehouseId"))
    OR (p."itemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Item" x WHERE x.id = p."itemId"));
  IF orphans > 0 THEN
    RAISE EXCEPTION 'ProjectCostLedger has % rows with dangling dimension ids; resolve them before migrating', orphans;
  END IF;

  SELECT count(*) INTO orphans FROM "JournalLine" j WHERE
       (j."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" x WHERE x.id = j."branchId"))
    OR (j."departmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Department" x WHERE x.id = j."departmentId"))
    OR (j."costCenterId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCenter" x WHERE x.id = j."costCenterId"))
    OR (j."projectId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Project" x WHERE x.id = j."projectId"))
    OR (j."wbsNodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "WbsNode" x WHERE x.id = j."wbsNodeId"))
    OR (j."costCodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCode" x WHERE x.id = j."costCodeId"));
  IF orphans > 0 THEN
    RAISE EXCEPTION 'JournalLine has % rows with dangling dimension ids; resolve them before migrating', orphans;
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "RfqInviteStatus" AS ENUM ('INVITED', 'SENT', 'QUOTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('SUBMITTED', 'AWARDED', 'NOT_AWARDED');

-- AlterEnum
ALTER TYPE "PoStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "PrStatus" ADD VALUE 'CLOSED';

-- AlterEnum
ALTER TYPE "RfqStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "BoqItem" ADD COLUMN     "costCategory" "CostCategory" NOT NULL DEFAULT 'MATERIAL';

-- AlterTable
ALTER TABLE "ContactPerson" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rfqId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "cancelledQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quotationLineId" TEXT,
ADD COLUMN     "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseRequisition" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PurchaseRequisitionLine" ADD COLUMN     "description" TEXT,
ADD COLUMN     "justification" TEXT,
ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Rfq" ADD COLUMN     "awardedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deliveryLocation" TEXT,
ADD COLUMN     "deliveryRequirements" TEXT,
ADD COLUMN     "requiredDate" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RfqLine" ADD COLUMN     "description" TEXT,
ADD COLUMN     "lineNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiredDate" TIMESTAMP(3),
ADD COLUMN     "requisitionLineId" TEXT;

-- AlterTable
ALTER TABLE "RfqSupplier" ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "status" "RfqInviteStatus" NOT NULL DEFAULT 'INVITED';

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "accreditationNo" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "SupplierQuotation" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "QuotationStatus" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SupplierQuotationLine" ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
ADD COLUMN     "lineTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "rfqLineId" TEXT NOT NULL,
ADD COLUMN     "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxPct" DECIMAL(7,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ItemUnitConversion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "factor" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemUnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqAward" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "awardedById" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemUnitConversion_companyId_idx" ON "ItemUnitConversion"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnitConversion_itemId_unit_key" ON "ItemUnitConversion"("itemId", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "RfqAward_rfqId_key" ON "RfqAward"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqAward_quotationId_key" ON "RfqAward"("quotationId");

-- CreateIndex
CREATE INDEX "RfqAward_companyId_idx" ON "RfqAward"("companyId");

-- CreateIndex
CREATE INDEX "RfqAward_supplierId_idx" ON "RfqAward"("supplierId");

-- CreateIndex
CREATE INDEX "JournalLine_branchId_idx" ON "JournalLine"("branchId");

-- CreateIndex
CREATE INDEX "JournalLine_departmentId_idx" ON "JournalLine"("departmentId");

-- CreateIndex
CREATE INDEX "JournalLine_costCenterId_idx" ON "JournalLine"("costCenterId");

-- CreateIndex
CREATE INDEX "JournalLine_wbsNodeId_idx" ON "JournalLine"("wbsNodeId");

-- CreateIndex
CREATE INDEX "JournalLine_costCodeId_idx" ON "JournalLine"("costCodeId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_branchId_idx" ON "ProjectCostLedger"("branchId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_departmentId_idx" ON "ProjectCostLedger"("departmentId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_subcontractorId_idx" ON "ProjectCostLedger"("subcontractorId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_warehouseId_idx" ON "ProjectCostLedger"("warehouseId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_itemId_idx" ON "ProjectCostLedger"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_quotationId_idx" ON "PurchaseOrder"("quotationId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_rfqId_idx" ON "PurchaseOrder"("rfqId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_requisitionLineId_idx" ON "PurchaseOrderLine"("requisitionLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_quotationLineId_idx" ON "PurchaseOrderLine"("quotationLineId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_warehouseId_idx" ON "PurchaseRequisitionLine"("warehouseId");

-- CreateIndex
CREATE INDEX "RfqLine_requisitionLineId_idx" ON "RfqLine"("requisitionLineId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqLine_rfqId_requisitionLineId_key" ON "RfqLine"("rfqId", "requisitionLineId");

-- CreateIndex
CREATE INDEX "SupplierQuotationLine_rfqLineId_idx" ON "SupplierQuotationLine"("rfqLineId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotationLine_quotationId_rfqLineId_key" ON "SupplierQuotationLine"("quotationId", "rfqLineId");

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUnitConversion" ADD CONSTRAINT "ItemUnitConversion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "PurchaseRequisitionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_rfqLineId_fkey" FOREIGN KEY ("rfqLineId") REFERENCES "RfqLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "PurchaseRequisitionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_quotationLineId_fkey" FOREIGN KEY ("quotationLineId") REFERENCES "SupplierQuotationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Company-consistency triggers now also cover the dimensions that became real foreign keys.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION probuild_assert_cost_ledger_company() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Project" WHERE id = NEW."projectId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: project';
  END IF;
  IF NEW."wbsNodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "WbsNode" WHERE id = NEW."wbsNodeId" AND "projectId" = NEW."projectId") THEN
    RAISE EXCEPTION 'WBS node does not belong to the project';
  END IF;
  IF NEW."boqItemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "BoqItem" WHERE id = NEW."boqItemId" AND "projectId" = NEW."projectId") THEN
    RAISE EXCEPTION 'BOQ item does not belong to the project';
  END IF;
  IF NEW."costCodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCode" WHERE id = NEW."costCodeId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: cost code';
  END IF;
  IF NEW."supplierId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Supplier" WHERE id = NEW."supplierId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: supplier';
  END IF;
  IF NEW."employeeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Employee" WHERE id = NEW."employeeId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: employee';
  END IF;
  IF NEW."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" WHERE id = NEW."branchId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: branch';
  END IF;
  IF NEW."departmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Department" WHERE id = NEW."departmentId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: department';
  END IF;
  IF NEW."subcontractorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Subcontractor" WHERE id = NEW."subcontractorId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: subcontractor';
  END IF;
  IF NEW."warehouseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Warehouse" WHERE id = NEW."warehouseId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: warehouse';
  END IF;
  IF NEW."itemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Item" WHERE id = NEW."itemId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: item';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION probuild_assert_journal_line_company() RETURNS trigger AS $$
DECLARE entry_company text;
BEGIN
  SELECT "companyId" INTO entry_company FROM "JournalEntry" WHERE id = NEW."entryId";
  IF NOT EXISTS (SELECT 1 FROM "Account" WHERE id = NEW."accountId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: account';
  END IF;
  IF NEW."projectId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Project" WHERE id = NEW."projectId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: project';
  END IF;
  IF NEW."costCenterId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCenter" WHERE id = NEW."costCenterId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: cost center';
  END IF;
  IF NEW."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" WHERE id = NEW."branchId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: branch';
  END IF;
  IF NEW."departmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Department" WHERE id = NEW."departmentId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: department';
  END IF;
  IF NEW."wbsNodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "WbsNode" WHERE id = NEW."wbsNodeId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: WBS node';
  END IF;
  IF NEW."costCodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCode" WHERE id = NEW."costCodeId" AND "companyId" = entry_company) THEN
    RAISE EXCEPTION 'Cross-company reference: cost code';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
