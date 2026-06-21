# ---- Base ----
FROM node:20-bullseye AS base
WORKDIR /app

# Pin pnpm 10.x which supports Node 20 (pnpm 11+ requires Node 22)
RUN npm install -g pnpm@10.33.0

# ---- Deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma PrismaClient() reads DATABASE_URL at module-eval during page data collection.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — must use real production value.
ENV NEXT_PUBLIC_APP_URL=https://jpvbootcamp.com
ENV APP_BASE_URL=https://jpvbootcamp.com
ENV NEXT_PUBLIC_SERVER_URL=https://jpvbootcamp.com
RUN --mount=type=cache,target=/app/.next/cache \
    node_modules/.bin/prisma generate --schema=prisma/system.prisma && \
    pnpm run build

# ---- Script deps (kept separate to avoid conflicting with standalone's pnpm symlinks) ----
# standalone/node_modules uses pnpm symlinks; overlaying a second node_modules on top
# causes "cannot copy to non-directory" in buildkit. Separate path avoids the conflict.
# newrelic: loaded via NODE_OPTIONS=--require newrelic (not traced by Next.js standalone)
# pg: used by scripts/db/init-tenant.js at deploy time
# prisma: CLI needed for db:migrate:prod (devDep, not included in standalone)
FROM node:20-bullseye-slim AS script-deps
WORKDIR /script-deps
RUN echo '{"dependencies":{"newrelic":"^13.18.0","pg":"^8","prisma":"6.15.0"}}' > package.json
RUN npm install --omit=dev --ignore-scripts 2>&1 | tail -1

# ---- Runner ----
FROM node:20-bullseye AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Install postgresql-client-15
RUN apt-get update && apt-get install -y \
    lsb-release \
    curl \
    gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
    && echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y postgresql-client-15 \
    && rm -rf /var/lib/apt/lists/*

# Script-only deps at a separate path — does not touch standalone's node_modules
COPY --from=script-deps /script-deps/node_modules /script-deps/node_modules
# prisma CLI available to npm run scripts; pg + newrelic resolvable via NODE_PATH
ENV PATH="/script-deps/node_modules/.bin:${PATH}"
ENV NODE_PATH=/script-deps/node_modules

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', res => process.exit(res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["bash", "scripts/runtime/start-prod.sh"]
