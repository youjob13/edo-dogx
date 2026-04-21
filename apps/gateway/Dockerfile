# Build context: repository root
# Usage: docker build -f apps/gateway/Dockerfile .

FROM node:24.15.0-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/gateway/package.json ./apps/gateway/
COPY shared/ts-types/package.json ./shared/ts-types/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/gateway ./apps/gateway
COPY shared/ts-types ./shared/ts-types

WORKDIR /repo/apps/gateway
RUN pnpm build

# ── Runtime ──────────────────────────────────────────────────────────
FROM node:24.15.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/apps/gateway/dist ./dist
COPY --from=builder /repo/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/main.js"]
