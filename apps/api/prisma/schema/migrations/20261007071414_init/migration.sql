-- CreateEnum
CREATE TYPE "CostTxnType" AS ENUM ('MATERIAL_ISSUE', 'MATERIAL_RETURN', 'PAYROLL', 'EQUIPMENT', 'FUEL', 'SUBCONTRACT', 'EXPENSE', 'SUPPLIER_INVOICE', 'PETTY_CASH', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "TaxKind" AS ENUM ('VAT', 'PERCENTAGE_TAX', 'EXPANDED_WITHHOLDING', 'WITHHOLDING_VAT', 'EXEMPT', 'ZERO_RATED');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('PROGRESS', 'MILESTONE', 'PERCENTAGE', 'BOQ', 'VARIATION', 'DOWN_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'BANK_TRANSFER', 'ONLINE');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'SUBCONTRACTOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ComplianceCategory" AS ENUM ('PCAB', 'SEC', 'DTI', 'BIR', 'PHILGEPS', 'LGU', 'DOLE', 'INSURANCE', 'BOND', 'PROJECT_PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('CONSUMABLE', 'NON_CONSUMABLE', 'SERIALIZED', 'BATCH_CONTROLLED', 'LOT_CONTROLLED', 'FIXED_ASSET', 'RETURNABLE');

-- CreateEnum
CREATE TYPE "CostingMethod" AS ENUM ('WEIGHTED_AVERAGE', 'FIFO', 'STANDARD', 'MOVING_AVERAGE');

-- CreateEnum
CREATE TYPE "StockTxnType" AS ENUM ('OPENING', 'PURCHASE_RECEIPT', 'CUSTOMER_RETURN', 'PROJECT_RETURN', 'TRANSFER_IN', 'PRODUCTION_RECEIPT', 'PROJECT_ISSUE', 'TRANSFER_OUT', 'SUPPLIER_RETURN', 'DAMAGE', 'SCRAP', 'CONSUMPTION', 'ASSET_CAPITALIZATION', 'ADJUSTMENT_GAIN', 'ADJUSTMENT_LOSS', 'COUNT_VARIANCE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'QUARANTINE', 'DAMAGED', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DAMAGED', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('IN_STOCK', 'ISSUED', 'IN_REPAIR', 'LOST', 'DAMAGED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY', 'REST_DAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentKind" AS ENUM ('HEAVY_EQUIPMENT', 'VEHICLE', 'MACHINERY', 'GENERATOR', 'TESTING_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('OWNED', 'RENTED', 'LEASED', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "FuelTxnType" AS ENUM ('PURCHASE', 'ISSUE');

-- CreateEnum
CREATE TYPE "HseRecordType" AS ENUM ('INDUCTION', 'TOOLBOX_MEETING', 'INSPECTION', 'INCIDENT', 'ACCIDENT', 'NEAR_MISS', 'OBSERVATION', 'PERMIT_TO_WORK', 'CORRECTIVE_ACTION');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('STANDALONE', 'HOLDING', 'SUBSIDIARY', 'JOINT_VENTURE');

-- CreateEnum
CREATE TYPE "VatStatus" AS ENUM ('VAT', 'NON_VAT', 'EXEMPT');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('CENTRAL', 'REGIONAL', 'PROJECT', 'SITE', 'TEMPORARY', 'CONTAINER', 'YARD', 'TOOL_ROOM', 'EQUIPMENT_YARD', 'QUARANTINE', 'DAMAGED');

-- CreateEnum
CREATE TYPE "LocationLevel" AS ENUM ('ZONE', 'RACK', 'SHELF', 'BIN');

-- CreateEnum
CREATE TYPE "PrStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_ORDERED', 'ORDERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SENT', 'QUOTED', 'AWARDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QcResult" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'MATCHED', 'DISCREPANCY', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('GENERAL_BUILDING', 'CIVIL', 'INFRASTRUCTURE', 'ROADS', 'BRIDGES', 'WATER', 'ELECTRICAL', 'MECHANICAL', 'HVAC', 'PLUMBING', 'MEP', 'FIT_OUT', 'INTERIOR', 'RENOVATION', 'INDUSTRIAL', 'RESIDENTIAL', 'COMMERCIAL', 'SPECIALTY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PIPELINE', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FundingSector" AS ENUM ('PRIVATE', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "EstimateType" AS ENUM ('PRELIMINARY', 'TENDER', 'DETAILED', 'REVISED', 'APPROVED');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('POTENTIAL', 'VO_REQUEST', 'ESTIMATED', 'INTERNAL_APPROVED', 'CLIENT_SUBMITTED', 'CLIENT_APPROVED', 'REJECTED', 'CONTRACT_REVISED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('DELAY', 'VARIATION', 'EXTENSION_OF_TIME', 'COST', 'CLIENT', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "RfiStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('INTERNAL', 'CLIENT', 'SUPPLIER', 'SUBCONTRACTOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'POST', 'EXPORT', 'PRINT', 'OVERRIDE', 'ADJUST', 'TRANSFER', 'CLOSE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateTable
CREATE TABLE "ProjectCostLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "departmentId" TEXT,
    "costCategory" "CostCategory" NOT NULL,
    "txnType" "CostTxnType" NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "employeeId" TEXT,
    "subcontractorId" TEXT,
    "warehouseId" TEXT,
    "itemId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reference" TEXT,
    "reversalOfId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCostLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entryNo" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT,
    "description" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "postedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "branchId" TEXT,
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "projectId" TEXT,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "partyType" "PartyType",
    "partyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TaxKind" NOT NULL,
    "glAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRateVersion" (
    "id" TEXT NOT NULL,
    "taxCodeId" TEXT NOT NULL,
    "ratePct" DECIMAL(7,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "legalBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCertificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "partyType" "PartyType" NOT NULL,
    "partyId" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "taxWithheld" DECIMAL(18,2) NOT NULL,
    "referenceNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBilling" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "BillingType" NOT NULL DEFAULT 'PROGRESS',
    "billingDate" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "grossAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retention" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "backCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netReceivable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "collectedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "invoiceNo" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBillingLine" (
    "id" TEXT NOT NULL,
    "billingId" TEXT NOT NULL,
    "boqItemId" TEXT,
    "description" TEXT NOT NULL,
    "previousQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currentQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "billingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankAccountId" TEXT,
    "reference" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvancePayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "recoveryPct" DECIMAL(7,4) NOT NULL,
    "recovered" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "payeeType" "PartyType" NOT NULL,
    "payeeId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankAccountId" TEXT,
    "checkNo" TEXT,
    "reference" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "isStatementLine" BOOLEAN NOT NULL DEFAULT false,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "matchedType" TEXT,
    "matchedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receiptNo" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reimbursed" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashFund" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "custodianId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fundAmount" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashEntry" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "costCodeId" TEXT,
    "wbsNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PettyCashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "category" "ComplianceCategory" NOT NULL,
    "subType" TEXT,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "amount" DECIMAL(18,2),
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PcabLicense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "classifications" TEXT NOT NULL,
    "licenseClass" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PcabLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "preferredSupplierId" TEXT,
    "restrictedProjectId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "specification" TEXT,
    "itemType" "ItemType" NOT NULL DEFAULT 'CONSUMABLE',
    "costCategory" "CostCategory" NOT NULL DEFAULT 'MATERIAL',
    "trackBatch" BOOLEAN NOT NULL DEFAULT false,
    "trackSerial" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "baseUnit" TEXT NOT NULL,
    "purchaseUnit" TEXT,
    "issueUnit" TEXT,
    "conversionFactor" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "barcode" TEXT,
    "qrCode" TEXT,
    "minStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "safetyStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "costingMethod" "CostingMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "standardCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lastPurchaseCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allowableWastePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "txnNo" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "txnType" "StockTxnType" NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "runningQty" DECIMAL(18,4) NOT NULL,
    "runningValue" DECIMAL(18,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "projectId" TEXT,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "boqItemId" TEXT,
    "costCenterId" TEXT,
    "reversalOfId" TEXT,
    "userId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "qtyOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT,
    "batchNo" TEXT NOT NULL,
    "lotNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "millCertificate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialUnit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "qrCode" TEXT,
    "status" "SerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "warehouseId" TEXT,
    "projectId" TEXT,
    "assignedEmployeeId" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "issuedAt" TIMESTAMP(3),
    "expectedReturnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SerialUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpeIssue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "itemId" TEXT NOT NULL,
    "serialUnitId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "replaceAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpeIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "neededDate" TIMESTAMP(3),
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "boqItemId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "issuedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "requestId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "requestedBy" TEXT,
    "approvedById" TEXT,
    "issuedById" TEXT NOT NULL,
    "receivedBy" TEXT,
    "vehicle" TEXT,
    "deliveryRef" TEXT,
    "signature" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssueLine" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "boqItemId" TEXT,
    "locationId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "returnedById" TEXT NOT NULL,
    "reason" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "boqItemId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "condition" "ReturnCondition" NOT NULL DEFAULT 'GOOD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "fromProjectId" TEXT,
    "toProjectId" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "adjustDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustmentLine" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "qtyDelta" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "systemQty" DECIMAL(18,4) NOT NULL,
    "physicalQty" DECIMAL(18,4) NOT NULL,
    "varianceQty" DECIMAL(18,4) NOT NULL,
    "varianceValue" DECIMAL(18,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "departmentId" TEXT,
    "projectId" TEXT,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "trade" TEXT,
    "biometricCode" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3),
    "dailyRate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyRate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hourlyCostRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "tin" TEXT,
    "sssNo" TEXT,
    "philhealthNo" TEXT,
    "pagibigNo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCertification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "graceMinutes" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "serialNo" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceImportBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "errorRows" INTEGER NOT NULL,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawAttendanceLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceUserCode" TEXT NOT NULL,
    "punchAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "issue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawAttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "shiftId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "timeIn" TIMESTAMP(3),
    "timeOut" TIMESTAMP(3),
    "regularHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "nightHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysPerYear" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(7,2) NOT NULL,
    "reason" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "totalGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtimePay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "holidayPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nightDiffPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sssContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "philhealthContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pagibigContribution" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "loanDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipProjectAllocation" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "hours" DECIMAL(9,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayslipProjectAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "deductionPerPeriod" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "EquipmentKind" NOT NULL DEFAULT 'HEAVY_EQUIPMENT',
    "type" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "plateNo" TEXT,
    "ownership" "OwnershipType" NOT NULL DEFAULT 'OWNED',
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currentProjectId" TEXT,
    "operatorId" TEXT,
    "engineHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "odometer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "registrationExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentUsageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "usageDate" TIMESTAMP(3) NOT NULL,
    "operatingHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "idleHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "downtimeHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "operatorId" TEXT,
    "costAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nextDueDate" TIMESTAMP(3),
    "nextDueHours" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "FuelTxnType" NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "equipmentId" TEXT,
    "projectId" TEXT,
    "driverId" TEXT,
    "liters" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "odometer" DECIMAL(12,2),
    "engineHours" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(18,2) NOT NULL,
    "salvageValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "accumulatedDepreciation" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "projectId" TEXT,
    "equipmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySiteReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "submittedById" TEXT NOT NULL,
    "weather" TEXT,
    "manpower" JSONB,
    "equipment" JSONB,
    "materialsReceived" JSONB,
    "materialsConsumed" JSONB,
    "workCompleted" TEXT,
    "issues" TEXT,
    "delays" TEXT,
    "visitors" TEXT,
    "safetyIncidents" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "remarks" TEXT,
    "aiSummary" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DailySiteReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "boqItemId" TEXT NOT NULL,
    "dailyReportId" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "qtyCompleted" DECIMAL(18,4) NOT NULL,
    "laborHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "recordedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "HseRecordType" NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT,
    "employeeId" TEXT,
    "correctiveAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retentionPct" DECIMAL(7,4) NOT NULL DEFAULT 10,
    "advancePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "advancePaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovered" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingPct" DECIMAL(7,4) NOT NULL DEFAULT 2,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 12,
    "penaltyTerms" TEXT,
    "paymentTerms" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subcontract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractItem" (
    "id" TEXT NOT NULL,
    "subcontractId" TEXT NOT NULL,
    "boqItemId" TEXT,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitRate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "claimedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subcontractId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossWork" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retention" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "backCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SubcontractClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractClaimLine" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyThisPeriod" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractClaimLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "type" "CompanyType" NOT NULL DEFAULT 'STANDALONE',
    "parentCompanyId" TEXT,
    "tin" TEXT,
    "secNo" TEXT,
    "dtiNo" TEXT,
    "philgepsNo" TEXT,
    "doleRegistrationNo" TEXT,
    "businessPermitNo" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatStatus" "VatStatus" NOT NULL DEFAULT 'VAT',
    "baseCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "accountName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "glAccountId" TEXT,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 0,
    "nextNo" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "projectId" TEXT,
    "parentWarehouseId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'CENTRAL',
    "address" TEXT,
    "managerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "LocationLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "qrCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCompany" BOOLEAN NOT NULL DEFAULT true,
    "tin" TEXT,
    "vatStatus" "VatStatus" NOT NULL DEFAULT 'VAT',
    "billingAddress" TEXT,
    "siteAddress" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bankInfo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tin" TEXT,
    "vatStatus" "VatStatus" NOT NULL DEFAULT 'VAT',
    "address" TEXT,
    "bankInfo" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "category" TEXT,
    "productCategories" TEXT,
    "accredited" BOOLEAN NOT NULL DEFAULT false,
    "accreditationExpiry" TIMESTAMP(3),
    "ewtCode" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tin" TEXT,
    "pcabLicenseNo" TEXT,
    "scope" TEXT,
    "address" TEXT,
    "bankInfo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPerson" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "subcontractorId" TEXT,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierEvaluation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "priceScore" INTEGER NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "deliveryScore" INTEGER NOT NULL,
    "responsivenessScore" INTEGER NOT NULL,
    "complianceScore" INTEGER NOT NULL,
    "rejectionRatePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "evaluatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "requesterId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "requiredDate" TIMESTAMP(3),
    "status" "PrStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionLine" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "boqItemId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "orderedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "estimatedUnitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "requiredDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requisitionId" TEXT,
    "projectId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "awardedQuotationId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqLine" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqSupplier" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quoteNo" TEXT,
    "quoteDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "deliveryDays" INTEGER,
    "paymentTerms" TEXT,
    "warranty" TEXT,
    "freight" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "brand" TEXT,
    "specification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "quotationId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "deliveryLocation" TEXT,
    "paymentTerms" TEXT,
    "terms" TEXT,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "freight" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "boqItemId" TEXT,
    "requisitionLineId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "invoicedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "taxPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "supplierDrNo" TEXT,
    "vehicle" TEXT,
    "driver" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "receivedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "receivedQty" DECIMAL(18,4) NOT NULL,
    "acceptedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejectedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quarantineQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "batchNo" TEXT NOT NULL DEFAULT '',
    "expiryDate" TIMESTAMP(3),
    "qcResult" "QcResult" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "receiptLineId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "result" "QcResult" NOT NULL,
    "checklist" JSONB,
    "testResult" TEXT,
    "certificateNo" TEXT,
    "remarks" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierInvoiceNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderId" TEXT,
    "projectId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "freight" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "matchNotes" JSONB,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "itemId" TEXT,
    "description" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "taxPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "managerId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL DEFAULT 'GENERAL_BUILDING',
    "status" "ProjectStatus" NOT NULL DEFAULT 'PIPELINE',
    "sector" "FundingSector" NOT NULL DEFAULT 'PRIVATE',
    "fundingSource" TEXT,
    "location" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "contractAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "originalEndDate" TIMESTAMP(3),
    "revisedEndDate" TIMESTAMP(3),
    "retentionPct" DECIMAL(7,4) NOT NULL DEFAULT 10,
    "advancePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 12,
    "ldRatePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "progressPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'LUMP_SUM',
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "currentAmount" DECIMAL(18,2) NOT NULL,
    "signedDate" TIMESTAMP(3),
    "noticeToProceed" TIMESTAMP(3),
    "clauses" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weightPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "progressPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WbsNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL DEFAULT 'MATERIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CostCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "EstimateType" NOT NULL DEFAULT 'PRELIMINARY',
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT,
    "overheadPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "profitPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "directCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoqItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "costCodeId" TEXT,
    "section" TEXT,
    "itemNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "equipmentCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subcontractCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overheadPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "profitPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "completedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateAnalysisLine" (
    "id" TEXT NOT NULL,
    "boqItemId" TEXT NOT NULL,
    "resourceType" "CostCategory" NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateAnalysisLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "category" "CostCategory" NOT NULL,
    "quantity" DECIMAL(18,4),
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "VariationStatus" NOT NULL DEFAULT 'POTENTIAL',
    "reason" TEXT,
    "scope" TEXT,
    "costImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "scheduleImpactDays" INTEGER NOT NULL DEFAULT 0,
    "materialImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "laborImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "equipmentImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subcontractImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clientApprovedAt" TIMESTAMP(3),
    "revisedContractValue" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ClaimType" NOT NULL,
    "title" TEXT NOT NULL,
    "noticeDate" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "daysClaimed" INTEGER NOT NULL DEFAULT 0,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "baselineStart" TIMESTAMP(3),
    "baselineFinish" TIMESTAMP(3),
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedFinish" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualFinish" TIMESTAMP(3),
    "percentComplete" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "plannedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityDependency" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfi" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsNodeId" TEXT,
    "drawingId" TEXT,
    "number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" "RfiStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "response" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Rfi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drawing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "discipline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FOR_REVIEW',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "supersedesId" TEXT,
    "uploadedById" TEXT,
    "issuedDate" TIMESTAMP(3),
    "distribution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloseoutItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloseoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyDefect" (
    "id" TEXT NOT NULL,
    "warrantyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleSubcontractorId" TEXT,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "userType" "UserType" NOT NULL DEFAULT 'INTERNAL',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "supplierId" TEXT,
    "subcontractorId" TEXT,
    "employeeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "projectId" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "ip" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "minAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRuleStep" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "roleName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRuleStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentNo" TEXT,
    "projectId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL DEFAULT 1,
    "stepRoles" JSONB NOT NULL,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalStatus" NOT NULL,
    "comment" TEXT,
    "ip" TEXT,
    "device" TEXT,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCostLedger_companyId_projectId_txnDate_idx" ON "ProjectCostLedger"("companyId", "projectId", "txnDate");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_sourceType_sourceId_idx" ON "ProjectCostLedger"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_projectId_costCodeId_idx" ON "ProjectCostLedger"("projectId", "costCodeId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_wbsNodeId_idx" ON "ProjectCostLedger"("wbsNodeId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_boqItemId_idx" ON "ProjectCostLedger"("boqItemId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_costCodeId_idx" ON "ProjectCostLedger"("costCodeId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_supplierId_idx" ON "ProjectCostLedger"("supplierId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_employeeId_idx" ON "ProjectCostLedger"("employeeId");

-- CreateIndex
CREATE INDEX "ProjectCostLedger_reversalOfId_idx" ON "ProjectCostLedger"("reversalOfId");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_reversalOfId_idx" ON "JournalEntry"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_entryNo_key" ON "JournalEntry"("companyId", "entryNo");

-- CreateIndex
CREATE INDEX "JournalLine_projectId_idx" ON "JournalLine"("projectId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCode_companyId_code_key" ON "TaxCode"("companyId", "code");

-- CreateIndex
CREATE INDEX "TaxRateVersion_taxCodeId_idx" ON "TaxRateVersion"("taxCodeId");

-- CreateIndex
CREATE INDEX "TaxCertificate_companyId_idx" ON "TaxCertificate"("companyId");

-- CreateIndex
CREATE INDEX "ClientBilling_projectId_idx" ON "ClientBilling"("projectId");

-- CreateIndex
CREATE INDEX "ClientBilling_customerId_idx" ON "ClientBilling"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBilling_companyId_number_key" ON "ClientBilling"("companyId", "number");

-- CreateIndex
CREATE INDEX "ClientBillingLine_billingId_idx" ON "ClientBillingLine"("billingId");

-- CreateIndex
CREATE INDEX "ClientBillingLine_boqItemId_idx" ON "ClientBillingLine"("boqItemId");

-- CreateIndex
CREATE INDEX "Collection_billingId_idx" ON "Collection"("billingId");

-- CreateIndex
CREATE INDEX "Collection_bankAccountId_idx" ON "Collection"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_companyId_number_key" ON "Collection"("companyId", "number");

-- CreateIndex
CREATE INDEX "RetentionEntry_projectId_direction_idx" ON "RetentionEntry"("projectId", "direction");

-- CreateIndex
CREATE INDEX "RetentionEntry_companyId_idx" ON "RetentionEntry"("companyId");

-- CreateIndex
CREATE INDEX "AdvancePayment_companyId_idx" ON "AdvancePayment"("companyId");

-- CreateIndex
CREATE INDEX "AdvancePayment_projectId_idx" ON "AdvancePayment"("projectId");

-- CreateIndex
CREATE INDEX "Payment_bankAccountId_idx" ON "Payment"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_companyId_number_key" ON "Payment"("companyId", "number");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_txnDate_idx" ON "BankTransaction"("bankAccountId", "txnDate");

-- CreateIndex
CREATE INDEX "BankTransaction_companyId_idx" ON "BankTransaction"("companyId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_employeeId_idx" ON "ExpenseClaim"("employeeId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_projectId_idx" ON "ExpenseClaim"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_companyId_number_key" ON "ExpenseClaim"("companyId", "number");

-- CreateIndex
CREATE INDEX "PettyCashFund_companyId_idx" ON "PettyCashFund"("companyId");

-- CreateIndex
CREATE INDEX "PettyCashFund_projectId_idx" ON "PettyCashFund"("projectId");

-- CreateIndex
CREATE INDEX "PettyCashFund_custodianId_idx" ON "PettyCashFund"("custodianId");

-- CreateIndex
CREATE INDEX "PettyCashEntry_fundId_idx" ON "PettyCashEntry"("fundId");

-- CreateIndex
CREATE INDEX "ComplianceDocument_companyId_idx" ON "ComplianceDocument"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceDocument_projectId_idx" ON "ComplianceDocument"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PcabLicense_companyId_licenseNo_key" ON "PcabLicense"("companyId", "licenseNo");

-- CreateIndex
CREATE INDEX "Document_companyId_entityType_entityId_idx" ON "Document"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_companyId_code_key" ON "UnitOfMeasure"("companyId", "code");

-- CreateIndex
CREATE INDEX "ItemCategory_parentId_idx" ON "ItemCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_companyId_parentId_name_key" ON "ItemCategory"("companyId", "parentId", "name");

-- CreateIndex
CREATE INDEX "Item_companyId_barcode_idx" ON "Item"("companyId", "barcode");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_preferredSupplierId_idx" ON "Item"("preferredSupplierId");

-- CreateIndex
CREATE INDEX "Item_restrictedProjectId_idx" ON "Item"("restrictedProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_companyId_sku_key" ON "Item"("companyId", "sku");

-- CreateIndex
CREATE INDEX "StockLedger_companyId_itemId_warehouseId_idx" ON "StockLedger"("companyId", "itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockLedger_sourceType_sourceId_idx" ON "StockLedger"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "StockLedger_batchNo_idx" ON "StockLedger"("batchNo");

-- CreateIndex
CREATE INDEX "StockLedger_txnDate_idx" ON "StockLedger"("txnDate");

-- CreateIndex
CREATE INDEX "StockLedger_warehouseId_idx" ON "StockLedger"("warehouseId");

-- CreateIndex
CREATE INDEX "StockLedger_locationId_idx" ON "StockLedger"("locationId");

-- CreateIndex
CREATE INDEX "StockLedger_itemId_idx" ON "StockLedger"("itemId");

-- CreateIndex
CREATE INDEX "StockLedger_projectId_idx" ON "StockLedger"("projectId");

-- CreateIndex
CREATE INDEX "StockLedger_wbsNodeId_idx" ON "StockLedger"("wbsNodeId");

-- CreateIndex
CREATE INDEX "StockLedger_costCodeId_idx" ON "StockLedger"("costCodeId");

-- CreateIndex
CREATE INDEX "StockLedger_boqItemId_idx" ON "StockLedger"("boqItemId");

-- CreateIndex
CREATE INDEX "StockLedger_costCenterId_idx" ON "StockLedger"("costCenterId");

-- CreateIndex
CREATE INDEX "StockLedger_reversalOfId_idx" ON "StockLedger"("reversalOfId");

-- CreateIndex
CREATE INDEX "StockBalance_companyId_itemId_idx" ON "StockBalance"("companyId", "itemId");

-- CreateIndex
CREATE INDEX "StockBalance_itemId_idx" ON "StockBalance"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_warehouseId_itemId_batchNo_stockStatus_key" ON "StockBalance"("warehouseId", "itemId", "batchNo", "stockStatus");

-- CreateIndex
CREATE INDEX "BatchRecord_itemId_idx" ON "BatchRecord"("itemId");

-- CreateIndex
CREATE INDEX "BatchRecord_supplierId_idx" ON "BatchRecord"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchRecord_companyId_itemId_batchNo_key" ON "BatchRecord"("companyId", "itemId", "batchNo");

-- CreateIndex
CREATE INDEX "SerialUnit_itemId_idx" ON "SerialUnit"("itemId");

-- CreateIndex
CREATE INDEX "SerialUnit_warehouseId_idx" ON "SerialUnit"("warehouseId");

-- CreateIndex
CREATE INDEX "SerialUnit_projectId_idx" ON "SerialUnit"("projectId");

-- CreateIndex
CREATE INDEX "SerialUnit_assignedEmployeeId_idx" ON "SerialUnit"("assignedEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_companyId_itemId_serialNo_key" ON "SerialUnit"("companyId", "itemId", "serialNo");

-- CreateIndex
CREATE INDEX "PpeIssue_companyId_idx" ON "PpeIssue"("companyId");

-- CreateIndex
CREATE INDEX "PpeIssue_employeeId_idx" ON "PpeIssue"("employeeId");

-- CreateIndex
CREATE INDEX "PpeIssue_projectId_idx" ON "PpeIssue"("projectId");

-- CreateIndex
CREATE INDEX "PpeIssue_itemId_idx" ON "PpeIssue"("itemId");

-- CreateIndex
CREATE INDEX "MaterialRequest_projectId_idx" ON "MaterialRequest"("projectId");

-- CreateIndex
CREATE INDEX "MaterialRequest_warehouseId_idx" ON "MaterialRequest"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_companyId_number_key" ON "MaterialRequest"("companyId", "number");

-- CreateIndex
CREATE INDEX "MaterialRequestLine_requestId_idx" ON "MaterialRequestLine"("requestId");

-- CreateIndex
CREATE INDEX "MaterialRequestLine_itemId_idx" ON "MaterialRequestLine"("itemId");

-- CreateIndex
CREATE INDEX "MaterialRequestLine_wbsNodeId_idx" ON "MaterialRequestLine"("wbsNodeId");

-- CreateIndex
CREATE INDEX "MaterialRequestLine_costCodeId_idx" ON "MaterialRequestLine"("costCodeId");

-- CreateIndex
CREATE INDEX "MaterialRequestLine_boqItemId_idx" ON "MaterialRequestLine"("boqItemId");

-- CreateIndex
CREATE INDEX "MaterialIssue_projectId_idx" ON "MaterialIssue"("projectId");

-- CreateIndex
CREATE INDEX "MaterialIssue_warehouseId_idx" ON "MaterialIssue"("warehouseId");

-- CreateIndex
CREATE INDEX "MaterialIssue_requestId_idx" ON "MaterialIssue"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIssue_companyId_number_key" ON "MaterialIssue"("companyId", "number");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_issueId_idx" ON "MaterialIssueLine"("issueId");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_itemId_idx" ON "MaterialIssueLine"("itemId");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_wbsNodeId_idx" ON "MaterialIssueLine"("wbsNodeId");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_costCodeId_idx" ON "MaterialIssueLine"("costCodeId");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_boqItemId_idx" ON "MaterialIssueLine"("boqItemId");

-- CreateIndex
CREATE INDEX "MaterialReturn_projectId_idx" ON "MaterialReturn"("projectId");

-- CreateIndex
CREATE INDEX "MaterialReturn_warehouseId_idx" ON "MaterialReturn"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReturn_companyId_number_key" ON "MaterialReturn"("companyId", "number");

-- CreateIndex
CREATE INDEX "MaterialReturnLine_returnId_idx" ON "MaterialReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "MaterialReturnLine_itemId_idx" ON "MaterialReturnLine"("itemId");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_fromWarehouseId_idx" ON "WarehouseTransfer"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_toWarehouseId_idx" ON "WarehouseTransfer"("toWarehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseTransfer_companyId_number_key" ON "WarehouseTransfer"("companyId", "number");

-- CreateIndex
CREATE INDEX "WarehouseTransferLine_transferId_idx" ON "WarehouseTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "WarehouseTransferLine_itemId_idx" ON "WarehouseTransferLine"("itemId");

-- CreateIndex
CREATE INDEX "StockAdjustment_warehouseId_idx" ON "StockAdjustment"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_companyId_number_key" ON "StockAdjustment"("companyId", "number");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_adjustmentId_idx" ON "StockAdjustmentLine"("adjustmentId");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_itemId_idx" ON "StockAdjustmentLine"("itemId");

-- CreateIndex
CREATE INDEX "StockCount_warehouseId_idx" ON "StockCount"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_companyId_number_key" ON "StockCount"("companyId", "number");

-- CreateIndex
CREATE INDEX "StockCountLine_countId_idx" ON "StockCountLine"("countId");

-- CreateIndex
CREATE INDEX "StockCountLine_itemId_idx" ON "StockCountLine"("itemId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_projectId_idx" ON "Employee"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_code_key" ON "Employee"("companyId", "code");

-- CreateIndex
CREATE INDEX "EmployeeCertification_companyId_idx" ON "EmployeeCertification"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeCertification_employeeId_idx" ON "EmployeeCertification"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_companyId_name_key" ON "Shift"("companyId", "name");

-- CreateIndex
CREATE INDEX "BiometricDevice_companyId_idx" ON "BiometricDevice"("companyId");

-- CreateIndex
CREATE INDEX "BiometricDevice_projectId_idx" ON "BiometricDevice"("projectId");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_companyId_idx" ON "AttendanceImportBatch"("companyId");

-- CreateIndex
CREATE INDEX "RawAttendanceLog_companyId_punchAt_idx" ON "RawAttendanceLog"("companyId", "punchAt");

-- CreateIndex
CREATE INDEX "RawAttendanceLog_employeeId_punchAt_idx" ON "RawAttendanceLog"("employeeId", "punchAt");

-- CreateIndex
CREATE INDEX "RawAttendanceLog_batchId_idx" ON "RawAttendanceLog"("batchId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_idx" ON "AttendanceRecord"("companyId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_projectId_idx" ON "AttendanceRecord"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_workDate_key" ON "AttendanceRecord"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_companyId_name_key" ON "LeaveType"("companyId", "name");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_idx" ON "LeaveRequest"("companyId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_number_key" ON "PayrollRun"("companyId", "number");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_employeeId_key" ON "Payslip"("runId", "employeeId");

-- CreateIndex
CREATE INDEX "PayslipProjectAllocation_payslipId_idx" ON "PayslipProjectAllocation"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipProjectAllocation_projectId_idx" ON "PayslipProjectAllocation"("projectId");

-- CreateIndex
CREATE INDEX "EmployeeLoan_companyId_idx" ON "EmployeeLoan"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeLoan_employeeId_idx" ON "EmployeeLoan"("employeeId");

-- CreateIndex
CREATE INDEX "Equipment_currentProjectId_idx" ON "Equipment"("currentProjectId");

-- CreateIndex
CREATE INDEX "Equipment_operatorId_idx" ON "Equipment"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_companyId_code_key" ON "Equipment"("companyId", "code");

-- CreateIndex
CREATE INDEX "EquipmentAllocation_companyId_idx" ON "EquipmentAllocation"("companyId");

-- CreateIndex
CREATE INDEX "EquipmentAllocation_equipmentId_idx" ON "EquipmentAllocation"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentAllocation_projectId_idx" ON "EquipmentAllocation"("projectId");

-- CreateIndex
CREATE INDEX "EquipmentUsageLog_companyId_idx" ON "EquipmentUsageLog"("companyId");

-- CreateIndex
CREATE INDEX "EquipmentUsageLog_equipmentId_idx" ON "EquipmentUsageLog"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentUsageLog_projectId_idx" ON "EquipmentUsageLog"("projectId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_companyId_idx" ON "MaintenanceRecord"("companyId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_equipmentId_idx" ON "MaintenanceRecord"("equipmentId");

-- CreateIndex
CREATE INDEX "FuelTransaction_companyId_idx" ON "FuelTransaction"("companyId");

-- CreateIndex
CREATE INDEX "FuelTransaction_equipmentId_idx" ON "FuelTransaction"("equipmentId");

-- CreateIndex
CREATE INDEX "FuelTransaction_projectId_idx" ON "FuelTransaction"("projectId");

-- CreateIndex
CREATE INDEX "FixedAsset_projectId_idx" ON "FixedAsset"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_companyId_code_key" ON "FixedAsset"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_assetId_periodYear_periodMonth_key" ON "DepreciationEntry"("assetId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "DailySiteReport_companyId_idx" ON "DailySiteReport"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySiteReport_projectId_reportDate_submittedById_key" ON "DailySiteReport"("projectId", "reportDate", "submittedById");

-- CreateIndex
CREATE INDEX "ProgressEntry_companyId_idx" ON "ProgressEntry"("companyId");

-- CreateIndex
CREATE INDEX "ProgressEntry_projectId_idx" ON "ProgressEntry"("projectId");

-- CreateIndex
CREATE INDEX "ProgressEntry_boqItemId_idx" ON "ProgressEntry"("boqItemId");

-- CreateIndex
CREATE INDEX "ProgressEntry_dailyReportId_idx" ON "ProgressEntry"("dailyReportId");

-- CreateIndex
CREATE INDEX "HseRecord_companyId_idx" ON "HseRecord"("companyId");

-- CreateIndex
CREATE INDEX "HseRecord_projectId_idx" ON "HseRecord"("projectId");

-- CreateIndex
CREATE INDEX "Subcontract_projectId_idx" ON "Subcontract"("projectId");

-- CreateIndex
CREATE INDEX "Subcontract_subcontractorId_idx" ON "Subcontract"("subcontractorId");

-- CreateIndex
CREATE UNIQUE INDEX "Subcontract_companyId_number_key" ON "Subcontract"("companyId", "number");

-- CreateIndex
CREATE INDEX "SubcontractItem_subcontractId_idx" ON "SubcontractItem"("subcontractId");

-- CreateIndex
CREATE INDEX "SubcontractItem_boqItemId_idx" ON "SubcontractItem"("boqItemId");

-- CreateIndex
CREATE INDEX "SubcontractClaim_subcontractId_idx" ON "SubcontractClaim"("subcontractId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractClaim_companyId_number_key" ON "SubcontractClaim"("companyId", "number");

-- CreateIndex
CREATE INDEX "SubcontractClaimLine_claimId_idx" ON "SubcontractClaimLine"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_parentCompanyId_idx" ON "Company"("parentCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE INDEX "BankAccount_glAccountId_idx" ON "BankAccount"("glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_companyId_accountNo_key" ON "BankAccount"("companyId", "accountNo");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_companyId_year_month_key" ON "AccountingPeriod"("companyId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_companyId_docType_year_key" ON "DocumentSequence"("companyId", "docType", "year");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId");

-- CreateIndex
CREATE INDEX "Warehouse_projectId_idx" ON "Warehouse"("projectId");

-- CreateIndex
CREATE INDEX "Warehouse_parentWarehouseId_idx" ON "Warehouse"("parentWarehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");

-- CreateIndex
CREATE INDEX "WarehouseLocation_companyId_idx" ON "WarehouseLocation"("companyId");

-- CreateIndex
CREATE INDEX "WarehouseLocation_parentId_idx" ON "WarehouseLocation"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_fullPath_key" ON "WarehouseLocation"("warehouseId", "fullPath");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Subcontractor_companyId_code_key" ON "Subcontractor"("companyId", "code");

-- CreateIndex
CREATE INDEX "ContactPerson_companyId_idx" ON "ContactPerson"("companyId");

-- CreateIndex
CREATE INDEX "ContactPerson_customerId_idx" ON "ContactPerson"("customerId");

-- CreateIndex
CREATE INDEX "ContactPerson_supplierId_idx" ON "ContactPerson"("supplierId");

-- CreateIndex
CREATE INDEX "ContactPerson_subcontractorId_idx" ON "ContactPerson"("subcontractorId");

-- CreateIndex
CREATE INDEX "SupplierEvaluation_companyId_idx" ON "SupplierEvaluation"("companyId");

-- CreateIndex
CREATE INDEX "SupplierEvaluation_supplierId_idx" ON "SupplierEvaluation"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_projectId_idx" ON "PurchaseRequisition"("projectId");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_warehouseId_idx" ON "PurchaseRequisition"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_companyId_number_key" ON "PurchaseRequisition"("companyId", "number");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_requisitionId_idx" ON "PurchaseRequisitionLine"("requisitionId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_itemId_idx" ON "PurchaseRequisitionLine"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_wbsNodeId_idx" ON "PurchaseRequisitionLine"("wbsNodeId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_costCodeId_idx" ON "PurchaseRequisitionLine"("costCodeId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_boqItemId_idx" ON "PurchaseRequisitionLine"("boqItemId");

-- CreateIndex
CREATE INDEX "Rfq_requisitionId_idx" ON "Rfq"("requisitionId");

-- CreateIndex
CREATE INDEX "Rfq_projectId_idx" ON "Rfq"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_companyId_number_key" ON "Rfq"("companyId", "number");

-- CreateIndex
CREATE INDEX "RfqLine_rfqId_idx" ON "RfqLine"("rfqId");

-- CreateIndex
CREATE INDEX "RfqLine_itemId_idx" ON "RfqLine"("itemId");

-- CreateIndex
CREATE INDEX "RfqSupplier_supplierId_idx" ON "RfqSupplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqSupplier_rfqId_supplierId_key" ON "RfqSupplier"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_companyId_idx" ON "SupplierQuotation"("companyId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_supplierId_idx" ON "SupplierQuotation"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotation_rfqId_supplierId_key" ON "SupplierQuotation"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierQuotationLine_quotationId_idx" ON "SupplierQuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "SupplierQuotationLine_itemId_idx" ON "SupplierQuotationLine"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_projectId_idx" ON "PurchaseOrder"("projectId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_warehouseId_idx" ON "PurchaseOrder"("warehouseId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_requisitionId_idx" ON "PurchaseOrder"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_number_key" ON "PurchaseOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_wbsNodeId_idx" ON "PurchaseOrderLine"("wbsNodeId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_costCodeId_idx" ON "PurchaseOrderLine"("costCodeId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_boqItemId_idx" ON "PurchaseOrderLine"("boqItemId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_orderId_idx" ON "GoodsReceipt"("orderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_supplierId_idx" ON "GoodsReceipt"("supplierId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_warehouseId_idx" ON "GoodsReceipt"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_companyId_number_key" ON "GoodsReceipt"("companyId", "number");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_receiptId_idx" ON "GoodsReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_orderLineId_idx" ON "GoodsReceiptLine"("orderLineId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_itemId_idx" ON "GoodsReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "QcInspection_companyId_idx" ON "QcInspection"("companyId");

-- CreateIndex
CREATE INDEX "QcInspection_receiptLineId_idx" ON "QcInspection"("receiptLineId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_orderId_idx" ON "SupplierInvoice"("orderId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_projectId_idx" ON "SupplierInvoice"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_companyId_number_key" ON "SupplierInvoice"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_supplierId_supplierInvoiceNo_key" ON "SupplierInvoice"("supplierId", "supplierInvoiceNo");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_invoiceId_idx" ON "SupplierInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Project_branchId_idx" ON "Project"("branchId");

-- CreateIndex
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");

-- CreateIndex
CREATE INDEX "Project_costCenterId_idx" ON "Project"("costCenterId");

-- CreateIndex
CREATE INDEX "Project_managerId_idx" ON "Project"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_companyId_number_key" ON "Contract"("companyId", "number");

-- CreateIndex
CREATE INDEX "WbsNode_companyId_idx" ON "WbsNode"("companyId");

-- CreateIndex
CREATE INDEX "WbsNode_parentId_idx" ON "WbsNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WbsNode_projectId_code_key" ON "WbsNode"("projectId", "code");

-- CreateIndex
CREATE INDEX "CostCode_parentId_idx" ON "CostCode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCode_companyId_code_key" ON "CostCode"("companyId", "code");

-- CreateIndex
CREATE INDEX "Estimate_companyId_idx" ON "Estimate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_projectId_version_key" ON "Estimate"("projectId", "version");

-- CreateIndex
CREATE INDEX "BoqItem_companyId_idx" ON "BoqItem"("companyId");

-- CreateIndex
CREATE INDEX "BoqItem_projectId_idx" ON "BoqItem"("projectId");

-- CreateIndex
CREATE INDEX "BoqItem_wbsNodeId_idx" ON "BoqItem"("wbsNodeId");

-- CreateIndex
CREATE INDEX "BoqItem_costCodeId_idx" ON "BoqItem"("costCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "BoqItem_estimateId_itemNo_key" ON "BoqItem"("estimateId", "itemNo");

-- CreateIndex
CREATE INDEX "RateAnalysisLine_boqItemId_idx" ON "RateAnalysisLine"("boqItemId");

-- CreateIndex
CREATE INDEX "RateAnalysisLine_itemId_idx" ON "RateAnalysisLine"("itemId");

-- CreateIndex
CREATE INDEX "Budget_companyId_idx" ON "Budget"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_projectId_version_key" ON "Budget"("projectId", "version");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_idx" ON "BudgetLine"("projectId");

-- CreateIndex
CREATE INDEX "BudgetLine_wbsNodeId_idx" ON "BudgetLine"("wbsNodeId");

-- CreateIndex
CREATE INDEX "BudgetLine_boqItemId_idx" ON "BudgetLine"("boqItemId");

-- CreateIndex
CREATE INDEX "BudgetLine_costCodeId_idx" ON "BudgetLine"("costCodeId");

-- CreateIndex
CREATE INDEX "Variation_projectId_idx" ON "Variation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_companyId_number_key" ON "Variation"("companyId", "number");

-- CreateIndex
CREATE INDEX "Claim_projectId_idx" ON "Claim"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_companyId_number_key" ON "Claim"("companyId", "number");

-- CreateIndex
CREATE INDEX "ScheduleActivity_companyId_idx" ON "ScheduleActivity"("companyId");

-- CreateIndex
CREATE INDEX "ScheduleActivity_wbsNodeId_idx" ON "ScheduleActivity"("wbsNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleActivity_projectId_code_key" ON "ScheduleActivity"("projectId", "code");

-- CreateIndex
CREATE INDEX "ActivityDependency_successorId_idx" ON "ActivityDependency"("successorId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityDependency_predecessorId_successorId_key" ON "ActivityDependency"("predecessorId", "successorId");

-- CreateIndex
CREATE INDEX "Rfi_projectId_idx" ON "Rfi"("projectId");

-- CreateIndex
CREATE INDEX "Rfi_wbsNodeId_idx" ON "Rfi"("wbsNodeId");

-- CreateIndex
CREATE INDEX "Rfi_drawingId_idx" ON "Rfi"("drawingId");

-- CreateIndex
CREATE UNIQUE INDEX "Rfi_companyId_number_key" ON "Rfi"("companyId", "number");

-- CreateIndex
CREATE INDEX "Drawing_companyId_idx" ON "Drawing"("companyId");

-- CreateIndex
CREATE INDEX "Drawing_supersedesId_idx" ON "Drawing"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "Drawing_projectId_number_revision_key" ON "Drawing"("projectId", "number", "revision");

-- CreateIndex
CREATE INDEX "CloseoutItem_companyId_idx" ON "CloseoutItem"("companyId");

-- CreateIndex
CREATE INDEX "CloseoutItem_projectId_idx" ON "CloseoutItem"("projectId");

-- CreateIndex
CREATE INDEX "WarrantyRecord_companyId_idx" ON "WarrantyRecord"("companyId");

-- CreateIndex
CREATE INDEX "WarrantyRecord_projectId_idx" ON "WarrantyRecord"("projectId");

-- CreateIndex
CREATE INDEX "WarrantyDefect_warrantyId_idx" ON "WarrantyDefect"("warrantyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_module_action_key" ON "RolePermission"("roleId", "module", "action");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_entityType_entityId_idx" ON "AuditLog"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_companyId_documentType_key" ON "ApprovalWorkflow"("companyId", "documentType");

-- CreateIndex
CREATE INDEX "ApprovalRule_workflowId_idx" ON "ApprovalRule"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRuleStep_ruleId_stepOrder_key" ON "ApprovalRuleStep"("ruleId", "stepOrder");

-- CreateIndex
CREATE INDEX "ApprovalRequest_companyId_status_idx" ON "ApprovalRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_documentType_documentId_idx" ON "ApprovalRequest"("documentType", "documentId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ApprovalAction_requestId_idx" ON "ApprovalAction"("requestId");

-- CreateIndex
CREATE INDEX "ApprovalAction_approverId_idx" ON "ApprovalAction"("approverId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_userId_key_route_key" ON "IdempotencyRecord"("userId", "key", "route");

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCostLedger" ADD CONSTRAINT "ProjectCostLedger_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "ProjectCostLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRateVersion" ADD CONSTRAINT "TaxRateVersion_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCertificate" ADD CONSTRAINT "TaxCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBilling" ADD CONSTRAINT "ClientBilling_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBilling" ADD CONSTRAINT "ClientBilling_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBilling" ADD CONSTRAINT "ClientBilling_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBillingLine" ADD CONSTRAINT "ClientBillingLine_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "ClientBilling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBillingLine" ADD CONSTRAINT "ClientBillingLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "ClientBilling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionEntry" ADD CONSTRAINT "RetentionEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionEntry" ADD CONSTRAINT "RetentionEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancePayment" ADD CONSTRAINT "AdvancePayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancePayment" ADD CONSTRAINT "AdvancePayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashFund" ADD CONSTRAINT "PettyCashFund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashFund" ADD CONSTRAINT "PettyCashFund_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashFund" ADD CONSTRAINT "PettyCashFund_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashEntry" ADD CONSTRAINT "PettyCashEntry_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PettyCashFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PcabLicense" ADD CONSTRAINT "PcabLicense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_restrictedProjectId_fkey" FOREIGN KEY ("restrictedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "StockLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRecord" ADD CONSTRAINT "BatchRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeIssue" ADD CONSTRAINT "PpeIssue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestLine" ADD CONSTRAINT "MaterialRequestLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "MaterialIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturn" ADD CONSTRAINT "MaterialReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturn" ADD CONSTRAINT "MaterialReturn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturn" ADD CONSTRAINT "MaterialReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "MaterialReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferLine" ADD CONSTRAINT "WarehouseTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WarehouseTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferLine" ADD CONSTRAINT "WarehouseTransferLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCertification" ADD CONSTRAINT "EmployeeCertification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCertification" ADD CONSTRAINT "EmployeeCertification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawAttendanceLog" ADD CONSTRAINT "RawAttendanceLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipProjectAllocation" ADD CONSTRAINT "PayslipProjectAllocation_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipProjectAllocation" ADD CONSTRAINT "PayslipProjectAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLoan" ADD CONSTRAINT "EmployeeLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_currentProjectId_fkey" FOREIGN KEY ("currentProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAllocation" ADD CONSTRAINT "EquipmentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAllocation" ADD CONSTRAINT "EquipmentAllocation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAllocation" ADD CONSTRAINT "EquipmentAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentUsageLog" ADD CONSTRAINT "EquipmentUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentUsageLog" ADD CONSTRAINT "EquipmentUsageLog_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentUsageLog" ADD CONSTRAINT "EquipmentUsageLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySiteReport" ADD CONSTRAINT "DailySiteReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySiteReport" ADD CONSTRAINT "DailySiteReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailySiteReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseRecord" ADD CONSTRAINT "HseRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseRecord" ADD CONSTRAINT "HseRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontract" ADD CONSTRAINT "Subcontract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontract" ADD CONSTRAINT "Subcontract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontract" ADD CONSTRAINT "Subcontract_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractItem" ADD CONSTRAINT "SubcontractItem_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractItem" ADD CONSTRAINT "SubcontractItem_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractClaim" ADD CONSTRAINT "SubcontractClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractClaim" ADD CONSTRAINT "SubcontractClaim_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractClaimLine" ADD CONSTRAINT "SubcontractClaimLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "SubcontractClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_parentWarehouseId_fkey" FOREIGN KEY ("parentWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEvaluation" ADD CONSTRAINT "SupplierEvaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEvaluation" ADD CONSTRAINT "SupplierEvaluation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplier" ADD CONSTRAINT "RfqSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcInspection" ADD CONSTRAINT "QcInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcInspection" ADD CONSTRAINT "QcInspection_receiptLineId_fkey" FOREIGN KEY ("receiptLineId") REFERENCES "GoodsReceiptLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsNode" ADD CONSTRAINT "WbsNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoqItem" ADD CONSTRAINT "BoqItem_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateAnalysisLine" ADD CONSTRAINT "RateAnalysisLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateAnalysisLine" ADD CONSTRAINT "RateAnalysisLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BoqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleActivity" ADD CONSTRAINT "ScheduleActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleActivity" ADD CONSTRAINT "ScheduleActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleActivity" ADD CONSTRAINT "ScheduleActivity_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityDependency" ADD CONSTRAINT "ActivityDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "ScheduleActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityDependency" ADD CONSTRAINT "ActivityDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "ScheduleActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "WbsNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Drawing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseoutItem" ADD CONSTRAINT "CloseoutItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseoutItem" ADD CONSTRAINT "CloseoutItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRecord" ADD CONSTRAINT "WarrantyRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRecord" ADD CONSTRAINT "WarrantyRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyDefect" ADD CONSTRAINT "WarrantyDefect_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "WarrantyRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRuleStep" ADD CONSTRAINT "ApprovalRuleStep_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ApprovalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
