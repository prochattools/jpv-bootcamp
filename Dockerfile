# ---- Base ----
FROM node:20-bullseye AS base
WORKDIR /app

# ---- Deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma PrismaClient() reads DATABASE_URL at module-eval during page data collection.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — must use real production value.
ENV NEXT_PUBLIC_APP_URL=https://jpvbootcamp.com
ENV APP_BASE_URL=https://jpvbootcamp.com
RUN --mount=type=cache,target=/app/.next/cache \
    npx prisma generate --schema=prisma/system.prisma && \
    npm run build

# ---- Runner ----
FROM node:20-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["sh", "scripts/runtime/start-prod.sh"]
