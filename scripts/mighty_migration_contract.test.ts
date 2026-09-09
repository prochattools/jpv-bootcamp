import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const api = readFileSync('src/lib/mighty/adminApi.ts', 'utf8')
const sync = readFileSync('src/lib/mighty/accessSync.ts', 'utf8')
const config = readFileSync('src/lib/mighty/config.ts', 'utf8')
const webhook = readFileSync('src/lib/stripe-webhook-handler.ts', 'utf8')
const home = readFileSync('src/app/(frontend)/page.tsx', 'utf8')
const signIn = readFileSync('src/app/(frontend)/sign-in/page.tsx', 'utf8')
const login = readFileSync('src/app/(frontend)/login/page.tsx', 'utf8')
const upgrade = readFileSync('src/app/(frontend)/upgrade/page.tsx', 'utf8')
const bridge = readFileSync('scripts/mighty/buildEntitledMemberBridge.mts', 'utf8')
const systemSchema = readFileSync('prisma/system.prisma', 'utf8')
const migration = readFileSync('prisma/migrations/20260909090000_add_mighty_access_sync/migration.sql', 'utf8')

test('typed Mighty config is fail-closed and environment-only', () => {
	assert.match(config, /MIGHTY_API_BASE_URL/)
	assert.match(config, /MIGHTY_NETWORK_ID/)
	assert.match(config, /MIGHTY_ACCESS_PLAN_ID/)
	assert.match(config, /MIGHTY_ADMIN_API_TOKEN/)
	assert.match(config, /MIGHTY_STUDENT_LOGIN_URL/)
})

test('member discovery uses the documented paginated members endpoint', () => {
	assert.match(api, /networks\/\$\{numericId\(this\.config\.networkId\)\}\/members/)
	assert.match(api, /page\.links\?\.next/)
	assert.match(api, /normalizeEmail\(member\.email\)/)
})

test('member creation suppresses Mighty invitation/welcome behavior', () => {
	assert.match(api, /send_welcome_email: false/)
	assert.doesNotMatch(api, /invite/i)
})

test('grant uses the existing non-paid Plan endpoint and user_id query', () => {
	assert.match(api, /plans\/\$\{numericId\(planId\)\}\/members/)
	assert.match(api, /user_id: numericId\(memberId\)/)
})

test('revoke uses immediate purchase removal and tolerates 404', () => {
	assert.match(api, /purchases\/\$\{numericId\(purchaseId\)\}/)
	assert.match(api, /immediate: params\.immediate === false \? 'false' : 'true'/)
	assert.match(api, /response\.status === 404 && allowNotFound/)
})

test('durable schema stores provider IDs, desired access, retries, and reconciliation timestamps', () => {
	for (const field of ['desiredAccess', 'mightyMemberId', 'mightyPurchaseId', 'attemptCount', 'lastError', 'nextAttemptAt', 'lastSucceededAt', 'lastReconciledAt']) {
		assert.match(systemSchema, new RegExp(field))
		assert.match(migration, new RegExp(field.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`)))
	}
})

test('Stripe events queue local desired state without provider calls in the webhook', () => {
	assert.match(webhook, /queueMightyAccessFromStripeEvent\(event\)/)
	assert.match(sync, /not call Mighty[\s\S]*worker owns all provider I\/O and retries/)
	assert.match(sync, /mightyAccessSync\.upsert/)
})

test('payment failure denies immediately and paid recovery allows/restores', () => {
	assert.match(sync, /case 'invoice\.payment_failed'/)
	assert.match(sync, /desiredAccess = 'DENIED'/)
	assert.match(sync, /case 'invoice\.paid'/)
	assert.match(sync, /desiredAccess = 'ALLOWED'/)
})

test('scheduled cancellation is not treated as an immediate revoke', () => {
	const plan = readFileSync('docs/migration/MIGHTY_MIGRATION_IMPLEMENTATION_PLAN.md', 'utf8')
	assert.match(plan, /cancel_at_period_end.*does not enqueue premature removal/)
	assert.match(sync, /customer\.subscription\.deleted/)
})

test('welcome email is ordered after Mighty access reconciliation', () => {
	assert.match(webhook, /deferWelcomeUntilMightyAccess: true/)
	assert.match(sync, /restoreAccess\(memberId, config\.accessPlanId\)/)
	assert.match(sync, /await \(params\.sendWelcome \?\? sendMightyWelcome\)\(params\.row\)/)
	assert.match(sync, /MIGHTY_STUDENT_LOGIN_URL/)
})

test('worker has a dedicated authenticated route and no synchronous webhook dependency', () => {
	const route = readFileSync('src/app/api/admin/process-mighty-access-sync/route.ts', 'utf8')
	assert.match(route, /MIGHTY_ACCESS_SYNC_WORKER_SECRET/)
	assert.match(route, /processMightyAccessSync\(limit\)/)
})

test('public Sign In targets the canonical Mighty URL', () => {
	assert.match(home, /MIGHTY_STUDENT_LOGIN_URL/)
	assert.match(signIn, /redirect\(MIGHTY_STUDENT_LOGIN_URL\)/)
	assert.match(login, /redirect\(MIGHTY_STUDENT_LOGIN_URL\)/)
})

test('Join preserves the current pricing and Stripe Checkout entrypoints', () => {
	assert.match(home, /href="#pricing"/)
	assert.match(upgrade, /billing=monthly/)
	assert.match(upgrade, /billing=annual/)
	assert.match(upgrade, /api\/stripe\/checkout/)
})

test('manual bridge is read-only and does not import provider mutation clients', () => {
	assert.match(bridge, /findMany\(/)
	assert.doesNotMatch(bridge, /create\(|update\(|delete\(|fetch\(|MightyAdminApi|getStripe|Stripe\(/i)
})

test('legacy portal source remains present for controlled rollback', () => {
	assert.ok(readFileSync('src/app/(frontend)/portal/page.tsx', 'utf8').length > 0)
})
