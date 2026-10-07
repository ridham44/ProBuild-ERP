# Build from the repository root: docker build -f apps/api/Dockerfile -t probuild-api .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @probuild/api exec prisma generate \
 && pnpm --filter @probuild/shared build \
 && pnpm --filter @probuild/api build
RUN pnpm --filter @probuild/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/prisma /out/prisma

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/health || exit 1
# Migrations run as a separate release step: `node_modules/.bin/prisma migrate deploy`
CMD ["node", "dist/main.js"]
