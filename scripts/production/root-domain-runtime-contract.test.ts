import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dockerfile = readFileSync('Dockerfile.production', 'utf8')
const startup = readFileSync('scripts/release/start-production.sh', 'utf8')

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
assert.match(startup, /node server\.js/)

console.log('Root-domain production runtime contract: PASS')
