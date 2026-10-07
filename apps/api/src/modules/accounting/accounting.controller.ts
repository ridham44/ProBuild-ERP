import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createAccountSchema,
  createJournalSchema,
  generalLedgerQuerySchema,
  journalListQuerySchema,
  periodActionSchema,
  reverseJournalSchema,
  trialBalanceQuerySchema,
  updateAccountSchema,
  type SessionUser,
} from '@probuild/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import { Idempotent } from '../../common/idempotency/idempotency.interceptor';
import { AccountingService } from './accounting.service';

class CreateAccountDto extends createZodDto(createAccountSchema) {}
class UpdateAccountDto extends createZodDto(updateAccountSchema) {}
class CreateJournalDto extends createZodDto(createJournalSchema) {}
class ReverseJournalDto extends createZodDto(reverseJournalSchema) {}
class JournalListQueryDto extends createZodDto(journalListQuerySchema) {}
class TrialBalanceQueryDto extends createZodDto(trialBalanceQuerySchema) {}
class GeneralLedgerQueryDto extends createZodDto(generalLedgerQuerySchema) {}
class PeriodActionDto extends createZodDto(periodActionSchema) {}

@ApiTags('accounting')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('accounts')
  @RequirePermission('finance.ledger', 'VIEW')
  listAccounts(@CurrentUser() user: SessionUser) {
    return this.accounting.listAccounts(user);
  }

  @Post('accounts')
  @RequirePermission('finance.ledger', 'CREATE')
  createAccount(@CurrentUser() user: SessionUser, @Body() body: CreateAccountDto) {
    return this.accounting.createAccount(user, body);
  }

  @Patch('accounts/:id')
  @RequirePermission('finance.ledger', 'EDIT')
  updateAccount(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAccountDto) {
    return this.accounting.updateAccount(user, id, body);
  }

  @Get('periods')
  @RequirePermission('finance.ledger', 'VIEW')
  listPeriods(@CurrentUser() user: SessionUser, @Query('year') year?: string) {
    return this.accounting.listPeriods(user, year ? Number(year) : undefined);
  }

  @Post('periods/years/:year')
  @RequirePermission('finance.ledger', 'CREATE')
  openYear(@CurrentUser() user: SessionUser, @Param('year', ParseIntPipe) year: number) {
    return this.accounting.openYear(user, year);
  }

  @Post('periods/:id/close')
  @HttpCode(200)
  @RequirePermission('finance.ledger', 'CLOSE')
  closePeriod(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: PeriodActionDto) {
    return this.accounting.setPeriodClosed(user, id, true, body.reason);
  }

  @Post('periods/:id/reopen')
  @HttpCode(200)
  @RequirePermission('finance.ledger', 'OVERRIDE')
  reopenPeriod(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: PeriodActionDto) {
    return this.accounting.setPeriodClosed(user, id, false, body.reason);
  }

  @Get('journals')
  @RequirePermission('finance.ledger', 'VIEW')
  listJournals(@CurrentUser() user: SessionUser, @Query() query: JournalListQueryDto) {
    return this.accounting.listJournals(user, query);
  }

  @Get('journals/:id')
  @RequirePermission('finance.ledger', 'VIEW')
  getJournal(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounting.getJournal(user, id);
  }

  @Post('journals')
  @Idempotent()
  @RequirePermission('finance.ledger', 'POST')
  createJournal(@CurrentUser() user: SessionUser, @Body() body: CreateJournalDto) {
    return this.accounting.createManualJournal(user, body);
  }

  @Post('journals/:id/reverse')
  @Idempotent()
  @HttpCode(201)
  @RequirePermission('finance.ledger', 'POST')
  reverseJournal(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReverseJournalDto) {
    return this.accounting.reverseJournal(user, id, body.reason);
  }

  @Get('trial-balance')
  @RequirePermission('finance.ledger', 'VIEW')
  trialBalance(@CurrentUser() user: SessionUser, @Query() query: TrialBalanceQueryDto) {
    return this.accounting.trialBalance(user, query);
  }

  @Get('general-ledger')
  @RequirePermission('finance.ledger', 'VIEW')
  generalLedger(@CurrentUser() user: SessionUser, @Query() query: GeneralLedgerQueryDto) {
    return this.accounting.generalLedger(user, query);
  }
}
