# Deploying to Vercel (+ Neon)

One Vercel project with two services (web + api) from this repo, served on one domain.

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

## 2. One Vercel project (services)
Vercel -> New Project -> import the repo -> leave **Root Directory** empty (the repo root).
The root [vercel.json](vercel.json) defines two services on one domain:

| Service | Root | Public path |
|---|---|---|
| `web` (Next.js) | `apps/web` | everything except `/api/*` |
| `api` (NestJS) | `apps/api` | `/api/*` (the app serves `/v1/*`, so `/api` is stripped by `apps/api/src/strip-public-prefix.ts`) |

`web` calls `api` server-side through a binding; Vercel injects its URL as `API_URL`. **Do not set `API_URL` yourself.**
The browser only calls `/api/*` on the same domain, so the session cookie never crosses origins.

Paste the contents of `.env.vercel` (repo root, gitignored) into Project Settings -> Environment Variables:
`NODE_ENV`, `DATABASE_URL` (Neon pooled + `pgbouncer=true&connection_limit=1`), `WEB_ORIGINS`, `SESSION_TTL_HOURS`,
`LOG_LEVEL`, `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_MODEL`.
Set `WEB_ORIGINS` to the project's public URL (no trailing slash) and redeploy after the first deploy gives you that URL.

## 4. After first login
Change the admin password when prompted, and open the current accounting year (Accounting -> Periods)
if the demo seed was not run.

## Limits to know
- Cold start of a few seconds after idle.
- Hobby plan functions stop at 10s (`maxDuration: 30` needs Pro); long imports/reports will time out.
- No background jobs run on Vercel; `@nestjs/schedule` is registered but nothing uses it yet.
