-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "currentRole" TEXT;

-- CreateIndex
CREATE INDEX "ApprovalRequest_companyId_status_currentRole_idx" ON "ApprovalRequest"("companyId", "status", "currentRole");
