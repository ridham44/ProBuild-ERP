# ProBuild ERP

ERP for Philippine construction contractors. pnpm + Turborepo monorepo: NestJS API, Prisma/PostgreSQL, shared Zod schemas, generated API client. Engineering rules live in [CLAUDE.md](CLAUDE.md).

```
apps/api            NestJS API (all business logic and database access)
apps/web            Next.js UI (not started)
packages/shared     Zod schemas, permissions, chart of accounts, Asia/Manila date helpers
packages/api-client Typed client generated from the API's OpenAPI document
packages/config     Shared tsconfig / eslint / prettier
```

## Run it locally

```bash
pnpm install
docker compose up -d                     # Postgres on :5434 (dev) and :5435 (tests)
cp apps/api/.env.example apps/api/.env   # then edit; DATABASE_URL must point at :5434
pnpm --filter @probuild/api prisma:migrate
pnpm --filter @probuild/api prisma:seed  # prints a one-time admin password; change required at first login
pnpm --filter @probuild/api build && node apps/api/dist/main.js   # API on :4000, docs on /docs (dev only)
```

The API must run from the compiled output (`nest build`) or `nest start`; `tsx` cannot emit the decorator metadata Nest needs.

## Quality gate

```bash
pnpm lint && pnpm typecheck && pnpm test      # unit tests
pnpm --filter @probuild/api test:e2e          # integration tests against the :5435 test database
pnpm build
pnpm api-client                               # regenerate openapi.json and the typed client after API changes
```

CI (`.github/workflows/ci.yml`) runs all of the above, checks migrations apply to an empty database with no schema drift, and fails if the generated client is stale.

## Production notes

- `NODE_ENV=production` makes the session cookie `Secure` and hides `/docs` unless `ENABLE_API_DOCS=true`.
- Seeding in production requires `SEED_ADMIN_PASSWORD`; there are no default credentials.
- Run `prisma migrate deploy` as a separate release step, not at container start.
- Build the image from the repo root: `docker build -f apps/api/Dockerfile -t probuild-api .`
- Ledger tables (`StockLedger`, `ProjectCostLedger`, `JournalLine`, `AuditLog`, …) are append-only via database triggers. Corrections are reversal rows.
