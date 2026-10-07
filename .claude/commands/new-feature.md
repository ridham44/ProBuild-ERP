Build a new feature following our engineering standards: $ARGUMENTS

Steps:
1. Read CLAUDE.md, apps/api/CLAUDE.md, apps/web/CLAUDE.md, and one existing feature module as a reference.
2. Present a plan and wait for approval:
   - Prisma model changes and indexes
   - Zod schemas in packages/shared
   - API endpoints (method, path, roles, pagination)
   - Frontend routes, components, and query hooks
   - Tests to add
   - Open questions about business rules
3. After approval, implement in this order: Prisma schema + migration → shared Zod schemas → NestJS module (repository, service, controller) → tests → regenerate api-client → frontend.
4. Run `pnpm lint && pnpm typecheck && pnpm test` and fix all failures.
5. Summarize what was built, files changed, and anything the reviewer should check.
