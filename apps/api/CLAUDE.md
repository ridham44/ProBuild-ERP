# Backend Rules (NestJS)

Applies in addition to the root CLAUDE.md.

## Module structure

```
src/
  modules/<feature>/
    <feature>.module.ts
    <feature>.controller.ts   # HTTP only: parse, validate, call service, return
    <feature>.service.ts      # Business logic
    <feature>.repository.ts   # Prisma queries (optional for simple modules)
    dto/                      # Zod-based DTOs (nestjs-zod) from packages/shared
    <feature>.service.spec.ts
  common/                     # guards, interceptors, filters, decorators
  config/                     # Zod-validated env config
  prisma/                     # PrismaService
  jobs/                       # BullMQ queues and processors
```

## Layer responsibilities

- **Controller:** routing, DTO validation, auth decorators, OpenAPI decorators. No business logic, no Prisma.
- **Service:** business rules, orchestration, transactions. Throws domain errors.
- **Repository / Prisma:** data access only. No business decisions.
- Modules communicate through exported services, never by importing another module's repository.

## Validation and DTOs

- Use `nestjs-zod` with schemas from `packages/shared` so frontend and backend share one definition.
- Strip unknown fields. Never pass a raw request body to Prisma.
- Response DTOs define exactly what is returned; never return raw Prisma models.

## Auth and authorization

- Global auth guard; public routes must be explicitly marked `@Public()`.
- Role checks with a `@Roles()` decorator and `RolesGuard`.
- Ownership/tenant checks inside the service: always scope queries by `tenantId`/`userId` where applicable.

## Errors

- Global exception filter maps errors to RFC 9457 problem details.
- Throw NestJS HTTP exceptions or custom domain errors; never return error objects with 200.
- Log unexpected errors with `requestId`; return a generic message to the client.

## Background jobs

- Use BullMQ for emails, notifications, exports, imports, webhooks, and anything slower than ~1s.
- Jobs must be idempotent (safe to retry) and have retry limits with backoff.
- Job payloads contain IDs, not full objects; reload fresh data inside the processor.

## Config

- All env vars defined and validated in `config/` with Zod. App fails to start if invalid.
- Access config through the injected config service, not `process.env` scattered in code.

## Testing

- Unit test services with mocked repositories.
- API tests with Supertest against a real test database (Docker), reset between tests.
- Test the unauthorized and forbidden paths for every protected endpoint.
