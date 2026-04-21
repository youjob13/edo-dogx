# Build context: repository root
# Usage: docker build -f apps/frontend/Dockerfile .

FROM node:24.15.0-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY shared/ts-types/package.json ./shared/ts-types/

RUN pnpm install --frozen-lockfile

COPY apps/frontend ./apps/frontend
COPY shared/ts-types ./shared/ts-types

WORKDIR /repo/apps/frontend
RUN pnpm build:ssr

# ── Runtime ──────────────────────────────────────────────────────────
FROM node:24.15.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /repo/apps/frontend/dist/frontend ./dist/frontend

EXPOSE 4000
CMD ["node", "dist/frontend/server/server.mjs"]
