# syntax=docker/dockerfile:1
# API (NestJS + Fastify) image. Targets linux/arm64, runs as a normal foreground
# process (no supervisor), non-root UID/GID 10001:10001. ESM build.

FROM --platform=linux/arm64 node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @smshop/db build && pnpm --filter @smshop/api build

FROM --platform=linux/arm64 node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 10001 -S nodejs && adduser -S -u 10001 -G nodejs nestjs
# Runtime layout for a pnpm workspace (ESM): root store, the app's workspace
# node_modules (dependency symlinks), the app's package.json (needed by Node to
# treat .js as ESM), the built output, and the built @smshop/db workspace package.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
