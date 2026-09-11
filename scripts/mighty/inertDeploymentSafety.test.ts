import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const productionWorkflow = readFileSync('.github/workflows/mighty-access-sync.yml', 'utf8')
const stagingWorkflow = readFileSync('.github/workflows/staging-mighty-access-sync.yml', 'utf8')
const productionStartup = readFileSync('scripts/release/start-production.sh', 'utf8')
const stagingStartup = readFileSync('scripts/release/start-staging.sh', 'utf8')
const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')
const stripeWebhook = readFileSync('src/lib/stripe-webhook-handler.ts', 'utf8')
const accessSync = readFileSync('src/lib/mighty/accessSync.ts', 'utf8')
const workerRoute = readFileSync('src/app/api/admin/process-mighty-access-sync/route.ts', 'utf8')

function schedulerEnabled(value: string | undefined): boolean {
	return value?.trim() === 'true'
}

test('production scheduler is opt-in and every non-true value stays disabled', () => {
	assert.match(productionWorkflow, /github.event_name == 'schedule' && vars\.MIGHTY_ACCESS_SYNC_ENABLED == 'true'/)
	assert.match(productionWorkflow, /inputs\.run_production_sync == 'yes'/)
	assert.match(stagingWorkflow, /STAGING_ORIGIN: https:\/\/staging\.jpvbootcamp\.com/)
	assert.doesNotMatch(stagingWorkflow, /https:\/\/jpvbootcamp\.com(?:\/|['"\s])/)
	for (const value of [undefined, '', 'false', '0', 'invalid', ' TRUE ']) {
		assert.equal(schedulerEnabled(value), false, `scheduler value ${String(value)} must remain disabled`)
	}
	assert.equal(schedulerEnabled('true'), true)
})
test('staging and production startup do not invoke Mighty population work', () => {
	for (const startup of [productionStartup, stagingStartup, payloadConfig]) {
		assert.doesNotMatch(startup, /processMightyAccessSync|queueMightyAccessFromStripeEvent|reconcileAccess\(/)
	}
})

test('verified Stripe webhooks only persist desired state; the worker owns provider I/O', () => {
	assert.match(stripeWebhook, /queueMightyAccessFromStripeEvent\(event\)/)
	assert.doesNotMatch(stripeWebhook, /createMightyAdminApi|reconcileAccess|grantAccess|revokeAccess|createMember/)
	assert.match(accessSync, /assertMightyMutationRuntimeReady\(mutationScope\)/)
	assert.match(accessSync, /claimRows\(limit, mutationScope\.allowedEmails\)/)
	assert.match(accessSync, /reconcileAccess\(\{ row, config, api, mutationScope \}\)/)
})

test('worker route requires a dedicated bearer secret and cannot bypass the runtime scope', () => {
	assert.match(workerRoute, /MIGHTY_ACCESS_SYNC_WORKER_SECRET/)
	assert.match(workerRoute, /timingSafeEqual/)
	assert.match(workerRoute, /processMightyAccessSync\(limit\)/)
	assert.match(accessSync, /normalizedEmail: \{ in: \[\.\.\.allowedEmails\] \}/)
	assert.doesNotMatch(workerRoute, /console\.log\(.*secret/i)
})
