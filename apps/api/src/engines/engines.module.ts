import { Global, Module } from '@nestjs/common';
import { AccessService } from '../common/access.service';
import { ApprovalWorkflowsController, ApprovalsController } from './approvals/approvals.controller';
import { ApprovalsService } from './approvals/approvals.service';
import { AuditService } from './audit/audit.service';
import { CostLedgerService } from './cost-ledger/cost-ledger.service';
import { JournalService } from './journal/journal.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { NumberingService } from './numbering/numbering.service';
import { StockLedgerService } from './stock-ledger/stock-ledger.service';

/** Core engines every feature module builds on. Global so feature modules just inject them. */
@Global()
@Module({
  controllers: [ApprovalsController, ApprovalWorkflowsController, NotificationsController],
  providers: [
    AccessService,
    AuditService,
    NumberingService,
    StockLedgerService,
    CostLedgerService,
    JournalService,
    ApprovalsService,
    NotificationsService,
  ],
  exports: [
    AccessService,
    AuditService,
    NumberingService,
    StockLedgerService,
    CostLedgerService,
    JournalService,
    ApprovalsService,
    NotificationsService,
  ],
})
export class EnginesModule {}
