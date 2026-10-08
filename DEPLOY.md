# Deploying to Vercel (+ Neon)

Two Vercel projects from this one repo. The browser only ever talks to the **web** URL; the web project proxies
`/api/*` to the API project (see `apps/web/next.config.ts`), so the session cookie stays same-origin.

## 1. Database (Neon)
Use a **dedicated** Neon database or branch for ProBuild (never one that holds another app's tables).
Run these locally, with `DATABASE_URL` pointing at the **direct** host (the pooled URL without `-pooler`):

```powershell
$env:DATABASE_URL = "postgresql://USER:PASS@ep-xxx.REGION.aws.neon.tech/DB?sslmode=require"
pnpm --filter @probuild/api exec prisma migrate deploy
$env:SEED_ADMIN_PASSWORD = "<a strong password, 12+ chars with a letter and a number>"
pnpm --filter @probuild/api prisma:seed
pnpm --filter @probuild/api prisma:seed:demo   # optional: demo customers, suppliers, items, projects
```

## 2. API project (`apps/api`)
Vercel -> New Project -> import the repo -> **Root Directory: `apps/api`** (framework: Other; settings come from `apps/api/vercel.json`).

| Env var | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **pooled** URL + `&pgbouncer=true&connection_limit=1` |
| `WEB_ORIGINS` | the web project's public URL, e.g. `https://probuild.vercel.app` |
| `SESSION_TTL_HOURS` | `12` |
| `LOG_LEVEL` | `info` |
| `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL`, `SENTRY_DSN` | optional |

## 3. Web project (`apps/web`)
Vercel -> New Project -> same repo -> **Root Directory: `apps/web`** (settings come from `apps/web/vercel.json`).

| Env var | Value |
|---|---|
| `API_URL` | the API project's URL, e.g. `https://probuild-api.vercel.app` |

Deploy the API first, then set `API_URL` on the web project, then deploy the web project.
`API_URL` is read at build time (rewrites), so redeploy the web project whenever it changes.

## 4. After first login
Change the admin password when prompted, and open the current accounting year (Accounting -> Periods)
if the demo seed was not run.

## Limits to know
- Cold start of a few seconds after idle.
- Hobby plan functions stop at 10s (`maxDuration: 30` needs Pro); long imports/reports will time out.
- No background jobs run on Vercel; `@nestjs/schedule` is registered but nothing uses it yet.
