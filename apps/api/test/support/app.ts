import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { createApp } from '../../src/bootstrap';

export type TestContext = { app: INestApplication; prisma: PrismaClient; http: () => ReturnType<typeof request> };

export async function startApp(): Promise<TestContext> {
  const app = await createApp();
  await app.init();
  const prisma = new PrismaClient();
  return { app, prisma, http: () => request(app.getHttpServer()) };
}

export async function stopApp(ctx: TestContext): Promise<void> {
  await ctx.app.close();
  await ctx.prisma.$disconnect();
}

/** A logged-in HTTP client that carries the session cookie. */
export async function login(ctx: TestContext, email: string, password: string): Promise<TestAgent> {
  const agent = request.agent(ctx.app.getHttpServer());
  const res = await agent.post('/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
