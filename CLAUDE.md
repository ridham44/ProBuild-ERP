# Engineering Standards (AI + Developers)

This file defines how every application in our company is built. Follow it exactly.
If a request conflicts with these rules, stop and ask before proceeding.

## How to work

1. Before writing code, read the relevant existing code and follow its patterns.
2. For any task touching more than 2–3 files, first give a short plan (files to change, approach, risks) and wait for approval.
3. State assumptions explicitly. Never guess business rules — ask.
4. Make the smallest change that solves the problem. No unrelated refactors.
5. Do not add a new dependency without explaining why and what alternatives exist. Prefer what is already installed.
6. After changes, run: `pnpm lint && pnpm typecheck && pnpm test`. Fix all failures before saying you are done.
7. Never commit secrets, disable lint rules, use `any`, or add `@ts-ignore` to make errors disappear. Fix the cause.
8. Write code a developer with 2 years of experience can understand. Clarity beats cleverness.

## Tech stack (do not substitute)

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| Client data | TanStack Query |
| Forms | React Hook Form + Zod |
| Backend | NestJS + TypeScript (strict) |
| Database | PostgreSQL + Prisma |
| Cache / jobs | Redis + BullMQ — only when a real need exists |
| File storage | S3-compatible — only when needed |
| API | REST, versioned `/v1`, OpenAPI generated from code |
| Testing | Vitest (unit), Supertest (API), Playwright (critical flows) |
| Logging / errors | pino (structured JSON), Sentry |

## Repository structure

```
apps/
  web/        # Next.js — UI and rendering only
  api/        # NestJS — all business logic and DB access
packages/
  shared/     # Zod schemas, shared types, constants
  api-client/ # Generated from OpenAPI — never edit by hand
  config/     # Shared eslint, tsconfig, prettier
```

## Architecture rules

- **NestJS owns all business logic and database access.** Next.js never imports Prisma or queries the DB.
- **Modular monolith.** One NestJS app split into feature modules. No microservices unless approved by the tech lead.
- **Stateless services.** No in-memory sessions or state; anything shared lives in Postgres or Redis. Every service must run with multiple instances.
- **One source of truth for types.** Request/response schemas are Zod schemas in `packages/shared`. The frontend uses the generated API client.
- **Dependencies point inward.** Controllers → services → repositories/Prisma. Controllers never touch Prisma directly.

## Security (mandatory)

- Validate every input on the server with Zod, even if the frontend validates too.
- Auth: httpOnly, Secure, SameSite cookie sessions stored in Redis/Postgres. JWT only for mobile or third-party clients (short-lived access + rotating refresh).
- Authorization: RBAC guards on every endpoint. Deny by default. Always check the user can access *this specific record* (tenant/owner check), not just the role.
- Passwords hashed with argon2. Never log passwords, tokens, or personal data.
- Rate limit auth and public endpoints. Use Helmet and a CORS allowlist.
- Secrets only from environment variables, validated with Zod at startup. Never hardcode or commit them.
- Use Prisma parameterized queries. If raw SQL is required, use `$queryRaw` with tagged templates — never string concatenation.
- File uploads: validate type and size, use pre-signed URLs, never serve user files from the app domain.

## Database rules

- Schema changes only through `prisma migrate`. Never edit the production DB manually.
- Every table has `id`, `createdAt`, `updatedAt`. Use soft delete (`deletedAt`) for business records.
- Index every foreign key and every column used in frequent `where`/`orderBy`.
- Always use `select` or `include` deliberately; never return full records with sensitive fields.
- Avoid N+1 queries. Batch with `include` or `in` queries.
- Multi-step writes that must succeed together use `prisma.$transaction`.
- Money: store as integer minor units (e.g. cents) or `Decimal`, never float.

## API conventions

- REST, plural nouns: `GET /v1/orders`, `POST /v1/orders`, `PATCH /v1/orders/:id`.
- List endpoints are always paginated (cursor-based by default, max page size 100).
- Errors use one consistent shape (RFC 9457 problem details): `type`, `title`, `status`, `detail`, `errors?`.
- Every endpoint documented via OpenAPI decorators. Regenerate `packages/api-client` after API changes.
- Long-running work (emails, reports, imports) goes to a BullMQ job, not the request.
- Payment-like or non-repeatable operations accept an `Idempotency-Key` header.

## Performance

- Paginate all lists. Never load unbounded data.
- Cache only with a clear reason, a TTL, and an invalidation plan.
- Frontend: lazy load heavy components, use `next/image`, keep client components small.

## Code style

- TypeScript strict mode. No `any`; use `unknown` and narrow.
- Files: `kebab-case.ts`. Components: `PascalCase`. Functions/variables: `camelCase`.
- Functions do one thing; keep them under ~50 lines where practical.
- No commented-out code. Comments explain *why*, not *what*.
- Handle errors explicitly. Never swallow errors with empty `catch`.

## Testing

- Every service method with business logic has unit tests.
- Every endpoint has at least one API test covering success, validation failure, and unauthorized access.
- Bug fixes include a test that fails without the fix.
- Critical user journeys (login, checkout, core workflow) have Playwright tests.

## Observability

- Structured logs via pino with `requestId` on every log line.
- Log at boundaries (incoming request, external calls, job start/finish), not every function.
- `/health` (liveness) and `/ready` (DB + Redis check) endpoints in every service.
- Unhandled errors reported to Sentry.

## Git and PRs

- Branches: `feat/…`, `fix/…`, `chore/…`. Commits follow Conventional Commits.
- One concern per PR. Include what changed, why, and how it was tested.
- CI must pass: lint, typecheck, test, build.

## Do NOT

- Add microservices, GraphQL, new state libraries, or new ORMs.
- Put business logic in Next.js or in controllers.
- Use `localStorage` for tokens.
- Return stack traces or internal errors to clients.
- Bypass validation, auth guards, or tests "temporarily".

See `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md` for app-specific rules.
