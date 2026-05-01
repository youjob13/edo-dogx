# Build context: repository root
# Usage: docker build -f apps/gateway/Dockerfile .

FROM node:24.15.0-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/gateway/package.json ./apps/gateway/
COPY shared/ts-types/package.json ./shared/ts-types/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/gateway ./apps/gateway
COPY shared/ts-types ./shared/ts-types
COPY shared/proto ./shared/proto

WORKDIR /repo/apps/gateway
RUN pnpm build

# Produce a self-contained deployment bundle with all production deps resolved
WORKDIR /repo
RUN pnpm --filter gateway deploy --prod /gateway-deploy

# ── Runtime ──────────────────────────────────────────────────────────
FROM node:24.15.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/apps/gateway/dist ./dist
COPY --from=builder /gateway-deploy/node_modules ./node_modules
COPY --from=builder /repo/shared/proto ./shared/proto

EXPOSE 3000
CMD ["node", "dist/main.js"]
