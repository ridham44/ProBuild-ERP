import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Transaction client or the root client; engines accept either so callers control the transaction. */
export type Db = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Document postings (receipts, issues, counts) run many statements in one transaction; Prisma's 5s default is too tight
    // when the database is busy, and a timed-out posting would surface as a 500 even though nothing was wrong.
    super({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
