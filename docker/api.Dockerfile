# syntax=docker/dockerfile:1
# API (NestJS + Fastify) image. Targets linux/arm64, runs as a normal foreground
# process (no supervisor), non-root UID/GID 10001:10001. ESM build.
#
# This image is also the migration image: the deployment contract reuses the API
# image for the one-shot `prisma migrate deploy` job. The runtime stage therefore
# keeps the Prisma CLI and the built `@smshop/db` package (schema, migrations,
# `prisma7.config.ts`) and defaults its working directory to `/app/packages/db`
# so `prisma migrate deploy` resolves the Prisma config and schema without any
# extra flags. The API server itself is started by an absolute path, so the
# working directory does not affect the running application.

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
# Copy the installed workspace dependency trees needed to build, then the
# source. `.dockerignore` excludes node_modules, so the source COPY does not
# overwrite them. `prisma generate` (via the db build) recreates the generated
# client, which is not part of the build context.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @smshop/db build && pnpm --filter @smshop/api build

FROM --platform=linux/arm64 node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 10001 -S nodejs && adduser -S -u 10001 -G nodejs nestjs
# Runtime layout for a pnpm workspace (ESM): root store, the app's workspace
# node_modules (dependency symlinks), the app's package.json (needed by Node to
# treat .js as ESM), the built output, and the built @smshop/db workspace
# package including its node_modules (Prisma CLI + engines for migrations).
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
# Expose the workspace-local Prisma CLI for the migration job.
ENV PATH="/app/packages/db/node_modules/.bin:${PATH}"
# Default working directory is the db package so `prisma migrate deploy` finds
# `prisma7.config.ts` and `prisma/schema.prisma`.
WORKDIR /app/packages/db
USER nestjs
EXPOSE 3001
CMD ["node", "/app/apps/api/dist/main.js"]
