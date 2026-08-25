import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dockerfile = readFileSync('Dockerfile.legacy', 'utf8')
const startup = readFileSync('scripts/runtime/start-legacy-domain.sh', 'utf8')
const session = readFileSync('src/lib/partners-session.ts', 'utf8')
const returnUrl = readFileSync('src/lib/billing-portal-return.ts', 'utf8')

assert.match(dockerfile, /legacy\.jpvbootcamp\.com/)
assert.match(dockerfile, /start-legacy-domain\.sh/)
assert.doesNotMatch(dockerfile, /(?:APP_URL|BASE_URL|SERVER_URL)=https:\/\/jpvbootcamp\.com/)
assert.match(startup, /DEPLOYMENT_ENV.*production/)
assert.match(startup, /database migrations are not run/)
assert.match(startup, /NEXT_PUBLIC_APP_DOMAIN/)
assert.match(session, /NEXT_PUBLIC_APP_DOMAIN/)
assert.match(returnUrl, /configuredAppOrigin/)

console.log('Legacy-domain production runtime contract: PASS')
