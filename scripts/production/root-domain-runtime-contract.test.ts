import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dockerfile = readFileSync('Dockerfile.production', 'utf8')
const startup = readFileSync('scripts/release/start-production.sh', 'utf8')
const payloadMigrationRunner = readFileSync('scripts/release/run-production-payload-migrations.mjs', 'utf8')
const prismaMigrationRunner = readFileSync('scripts/release/run-production-prisma-migrations.sh', 'utf8')
const productionWorkflow = readFileSync('.github/workflows/publish-root-domain-image.yml', 'utf8')

assert.match(dockerfile, /ARG NEXT_PUBLIC_APP_URL=https:\/\/jpvbootcamp\.com/)
assert.match(dockerfile, /ARG APP_BASE_URL=https:\/\/jpvbootcamp\.com/)
assert.match(dockerfile, /ARG NEXT_PUBLIC_SERVER_URL=https:\/\/jpvbootcamp\.com/)
assert.match(dockerfile, /ENV DEPLOYMENT_ENV=production/)
assert.match(dockerfile, /CMD \["bash", "scripts\/release\/start-production\.sh"\]/)
assert.doesNotMatch(dockerfile, /start-staging\.sh/)
assert.match(startup, /DEPLOYMENT_ENV.*production/)
assert.match(startup, /PRODUCTION_DATABASE_HOST\/PORT\/NAME\/SCHEMA/)
assert.match(startup, /database migrations are not run|migration state before application startup/)
assert.match(startup, /PAYLOAD_MIGRATION_SCHEMA=/)
assert.match(startup, /run-production-payload-migrations\.mjs/)
assert.ok(
  startup.indexOf('run-production-payload-migrations.mjs') < startup.indexOf('PAYLOAD_SCHEMA_PREFLIGHT'),
)
assert.match(startup, /node server\.js/)
assert.match(dockerfile, /COPY --from=builder \/app\/scripts \.\/scripts/)
assert.match(prismaMigrationRunner, /run-production-payload-migrations\.mjs/)
assert.match(payloadMigrationRunner, /DEPLOYMENT_ENV !== 'production'/)
assert.match(payloadMigrationRunner, /PRODUCTION_DATABASE_SCHEMA/)
assert.match(payloadMigrationRunner, /JPV_PAYLOAD_MIGRATION_APPLIED/)
assert.doesNotMatch(productionWorkflow, /Apply guarded production database migrations/)
assert.match(productionWorkflow, /Trigger root Dokploy deployment/)

console.log('Root-domain production runtime contract: PASS')
