/*
  Warnings:

  - Added the required column `expiresAt` to the `IdempotencyRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestHash` to the `IdempotencyRecord` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "IdempotencyRecord" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "requestHash" TEXT NOT NULL,
ADD COLUMN     "state" "IdempotencyState" NOT NULL DEFAULT 'IN_PROGRESS',
ALTER COLUMN "statusCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Ledger hardening: strict journal header guard, TRUNCATE protection, more append-only tables,
-- and database-level company consistency on ledger inserts (defense in depth for tenant isolation).
-- ---------------------------------------------------------------------------------------------

-- JournalEntry: the only permitted changes are POSTED -> REVERSED and setting reversalOfId once.
CREATE OR REPLACE FUNCTION probuild_journal_entry_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'JournalEntry cannot be deleted. Post a reversal instead.';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'reversalOfId') <> (to_jsonb(OLD) - 'status' - 'reversalOfId') THEN
    RAISE EXCEPTION 'Posted journal entries are immutable; only reversal linkage may change.';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED') THEN
    RAISE EXCEPTION 'Invalid journal status transition % -> %', OLD."status", NEW."status";
  END IF;
  IF OLD."reversalOfId" IS NOT NULL AND NEW."reversalOfId" IS DISTINCT FROM OLD."reversalOfId" THEN
    RAISE EXCEPTION 'reversalOfId is write-once.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRUNCATE is not covered by row triggers.
CREATE OR REPLACE FUNCTION probuild_block_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table "%" is immutable: TRUNCATE is not allowed.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_ledger_no_truncate BEFORE TRUNCATE ON "StockLedger" FOR EACH STATEMENT EXECUTE FUNCTION probuild_block_truncate();
CREATE TRIGGER project_cost_ledger_no_truncate BEFORE TRUNCATE ON "ProjectCostLedger" FOR EACH STATEMENT EXECUTE FUNCTION probuild_block_truncate();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "AuditLog" FOR EACH STATEMENT EXECUTE FUNCTION probuild_block_truncate();
CREATE TRIGGER journal_line_no_truncate BEFORE TRUNCATE ON "JournalLine" FOR EACH STATEMENT EXECUTE FUNCTION probuild_block_truncate();
CREATE TRIGGER journal_entry_no_truncate BEFORE TRUNCATE ON "JournalEntry" FOR EACH STATEMENT EXECUTE FUNCTION probuild_block_truncate();

-- Other history that must never be rewritten.
CREATE TRIGGER approval_action_immutable BEFORE UPDATE OR DELETE ON "ApprovalAction" FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();
CREATE TRIGGER retention_entry_immutable BEFORE UPDATE OR DELETE ON "RetentionEntry" FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();
CREATE TRIGGER depreciation_entry_immutable BEFORE UPDATE OR DELETE ON "DepreciationEntry" FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();
CREATE TRIGGER raw_attendance_log_immutable BEFORE UPDATE OR DELETE ON "RawAttendanceLog" FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();
CREATE TRIGGER document_version_immutable BEFORE UPDATE OR DELETE ON "DocumentVersion" FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();

-- Tax rate history: rows are never deleted; only effectiveTo may be set (to close a rate).
CREATE OR REPLACE FUNCTION probuild_tax_rate_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TaxRateVersion rows cannot be deleted. Add a new effective-dated rate instead.';
  END IF;
  IF (to_jsonb(NEW) - 'effectiveTo' - 'updatedAt') <> (to_jsonb(OLD) - 'effectiveTo' - 'updatedAt') THEN
    RAISE EXCEPTION 'TaxRateVersion is immutable except for closing effectiveTo.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tax_rate_version_guard BEFORE UPDATE OR DELETE ON "TaxRateVersion" FOR EACH ROW EXECUTE FUNCTION probuild_tax_rate_guard();

-- Company consistency: every referenced master record must belong to the row's company.
CREATE OR REPLACE FUNCTION probuild_assert_stock_ledger_company() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Warehouse" WHERE id = NEW."warehouseId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: warehouse';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Item" WHERE id = NEW."itemId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: item';
  END IF;
  IF NEW."projectId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Project" WHERE id = NEW."projectId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: project';
  END IF;
  IF NEW."wbsNodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "WbsNode" WHERE id = NEW."wbsNodeId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: WBS node';
  END IF;
  IF NEW."costCodeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCode" WHERE id = NEW."costCodeId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: cost code';
  END IF;
  IF NEW."boqItemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "BoqItem" WHERE id = NEW."boqItemId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: BOQ item';
  END IF;
  IF NEW."costCenterId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CostCenter" WHERE id = NEW."costCenterId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'Cross-company reference: cost center';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER stock_ledger_company_check BEFORE INSERT ON "StockLedger" FOR EACH ROW EXECUTE FUNCTION probuild_assert_stock_ledger_company();

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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER project_cost_ledger_company_check BEFORE INSERT ON "ProjectCostLedger" FOR EACH ROW EXECUTE FUNCTION probuild_assert_cost_ledger_company();

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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER journal_line_company_check BEFORE INSERT ON "JournalLine" FOR EACH ROW EXECUTE FUNCTION probuild_assert_journal_line_company();
