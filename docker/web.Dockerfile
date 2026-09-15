# syntax=docker/dockerfile:1
# Frontend (Next.js) image — feasibility draft. Finalize paths at production
# image-build time. Targets linux/arm64, runs as a normal foreground process
# (no supervisor), non-root UID/GID 10001:10001.

FROM --platform=linux/arm64 node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --filter @smshop/web --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @smshop/web build

FROM --platform=linux/arm64 node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 10001 -S nodejs && adduser -S -u 10001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# `public/` is optional in Next.js. This application has no static public
# assets yet (no `apps/web/public` directory exists and nothing references it),
# so no COPY is performed; the standalone server serves the app regardless.
# When public assets are introduced, add the directory and restore a COPY here.
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
