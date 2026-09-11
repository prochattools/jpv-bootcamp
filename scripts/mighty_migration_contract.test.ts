import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const api = readFileSync('src/lib/mighty/adminApi.ts', 'utf8')
const sync = readFileSync('src/lib/mighty/accessSync.ts', 'utf8')
const entitlement = readFileSync('src/lib/mighty/entitlement.ts', 'utf8')
const mutationPolicy = readFileSync('src/lib/mighty/mutationPolicy.ts', 'utf8')
const reconciliation = readFileSync('src/lib/mighty/reconciliation.ts', 'utf8')
const dryRun = readFileSync('scripts/mighty/reconcileAccessDryRun.mts', 'utf8')
const packageJson = readFileSync('package.json', 'utf8')
const provider = readFileSync('src/lib/mighty/adminApi.ts', 'utf8')
const config = readFileSync('src/lib/mighty/config.ts', 'utf8')
const webhook = readFileSync('src/lib/stripe-webhook-handler.ts', 'utf8')
const home = readFileSync('src/app/(frontend)/page.tsx', 'utf8')
const signIn = readFileSync('src/app/(frontend)/sign-in/page.tsx', 'utf8')
const login = readFileSync('src/app/(frontend)/login/page.tsx', 'utf8')
const upgrade = readFileSync('src/app/(frontend)/upgrade/page.tsx', 'utf8')
const bridge = readFileSync('scripts/mighty/buildEntitledMemberBridge.mts', 'utf8')
const stagingAcceptance = readFileSync('scripts/mighty/runStagingAcceptance.mts', 'utf8')
const productionAcceptance = readFileSync('scripts/mighty/runProductionAcceptance.mts', 'utf8')
const configurationCheck = readFileSync('scripts/mighty/checkConfiguration.mts', 'utf8')
const manualAccessAudit = readFileSync('scripts/mighty/auditManualAccess.mts', 'utf8')
const cutoverRehearsal = readFileSync('scripts/mighty/rehearseCutover.mts', 'utf8')
const adminCanaryProcedure = readFileSync('docs/migration/MIGHTY_ADMIN_CANARY_PROCEDURE.md', 'utf8')
const migrationPlan = readFileSync('docs/migration/MIGHTY_MIGRATION_IMPLEMENTATION_PLAN.md', 'utf8')
const roadmapStatus = readFileSync('docs/client/ROADMAP_PROGRESS_STATUS.md', 'utf8')
const currentHandoff = readFileSync('docs/CURRENT_WORK_HANDOFF.md', 'utf8')
const stagingScheduler = readFileSync('.github/workflows/staging-mighty-access-sync.yml', 'utf8')
const productionScheduler = readFileSync('.github/workflows/mighty-access-sync.yml', 'utf8')
const stagingEvidence = readFileSync('docs/migration/MIGHTY_STAGING_PROVIDER_VERIFICATION.md', 'utf8')
const systemSchema = readFileSync('prisma/system.prisma', 'utf8')
const migration = readFileSync('prisma/migrations/20260909090000_add_mighty_access_sync/migration.sql', 'utf8')
const eventOrderingMigration = readFileSync('prisma/migrations/20260909093000_add_mighty_event_ordering/migration.sql', 'utf8')

test('typed Mighty config is fail-closed and environment-only', () => {
	assert.match(config, /MIGHTY_API_BASE_URL/)
	assert.match(config, /api\.mn\.co\/admin\/v1/)
	assert.match(config, /MIGHTY_NETWORK_ID/)
	assert.match(config, /MIGHTY_ACCESS_PLAN_ID/)
	assert.match(config, /MIGHTY_ADMIN_API_TOKEN/)
	assert.match(config, /MIGHTY_STUDENT_LOGIN_URL/)
	assert.match(config, /jpv-community\.mn\.co.*sign_in/)
})

test('member discovery uses the documented paginated members endpoint', () => {
	assert.match(api, /members\/by_email/)
	assert.match(api, /findMemberByEmail\(email\)/)
	assert.doesNotMatch(api, /async listMembers\(/)
	assert.doesNotMatch(api, /async findAllPurchases\(/)
	assert.match(api, /'User-Agent': MIGHTY_USER_AGENT/)
})

test('member creation suppresses Mighty invitation/welcome behavior', () => {
	assert.match(api, /send_welcome_email: false/)
	assert.doesNotMatch(api, /invite/i)
})

test('grant uses the existing non-paid Plan endpoint and user_id query', () => {
	assert.match(api, /plans\/\$\{numericId\(planId\)\}\/members/)
	assert.match(api, /user_id: numericId\(memberId\)/)
})

test('revoke targets Plan membership and preserves legacy purchase cleanup as overlap handling', () => {
	assert.match(api, /plans\/\$\{numericId\(planId\)\}\/members\/\$\{numericId\(memberId\)\}/)
	assert.match(api, /purchases\/\$\{numericId\(purchaseId\)\}/)
	assert.match(api, /immediate: params\.immediate === false \? 'false' : 'true'/)
	assert.match(api, /response\.status === 404 && allowNotFound/)
	assert.match(sync, /revokePlanAccess\(memberId as string, config\.accessPlanId\)/)
})

test('durable schema stores provider IDs, event ordering, desired access, retries, and reconciliation timestamps', () => {
	for (const field of ['desiredAccess', 'mightyMemberId', 'mightyPurchaseId', 'attemptCount', 'lastError', 'nextAttemptAt', 'lastSucceededAt', 'lastReconciledAt', 'lastStripeEventCreatedAt', 'lastStripeEventType']) {
		assert.match(systemSchema, new RegExp(field))
		const snakeCase = field.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`)
		assert.match(`${migration}\n${eventOrderingMigration}`, new RegExp(snakeCase))
	}
})

test('Stripe events queue local desired state without provider calls in the webhook', () => {
	assert.match(webhook, /queueMightyAccessFromStripeEvent\(event\)/)
	assert.match(sync, /not call Mighty[\s\S]*worker owns all provider I\/O and retries/)
	assert.match(sync, /findExistingSyncRow/)
	assert.match(sync, /mightyAccessSync\.create/)
	assert.match(sync, /mightyAccessSync\.update/)
	assert.match(sync, /lastStripeEventCreatedAt/)
	assert.match(sync, /shouldApplyMightyStripeEvent/)
})

test('provider exposes an explicit current-access query', () => {
	assert.match(provider, /async getAccessState\(/)
	assert.match(provider, /hasAccess:/)
})

test('Stripe identity remains primary when the billing email changes', () => {
	assert.match(sync, /stripeCustomerId: params\.stripeCustomerId\.trim\(\)/)
	assert.match(sync, /stripeSubscriptionId: params\.stripeSubscriptionId\.trim\(\)/)
	assert.match(sync, /mighty_identity_conflict/)
	assert.match(stagingAcceptance, /mightyMemberId: testMemberId/)
})

test('payment failure denies immediately and paid recovery allows/restores', () => {
	assert.match(entitlement, /eventType === 'invoice\.payment_failed'/)
	assert.match(entitlement, /eventType === 'invoice\.paid'/)
	assert.match(entitlement, /return 'DENIED'/)
	assert.match(entitlement, /return 'ALLOWED'/)
})

test('one canonical entitlement function drives Stripe projection and access reconciliation', () => {
	assert.match(entitlement, /export function deriveMightyDesiredAccess/)
	assert.match(entitlement, /invoice\.payment_failed/)
	assert.match(entitlement, /customer\.subscription\.deleted/)
	assert.match(readFileSync('src/lib/mighty/stripeEntitlementSummary.ts', 'utf8'), /deriveMightyDesiredAccess/)
	assert.match(sync, /deriveMightyDesiredAccess/)
})

test('production mutations are explicitly scoped and fail closed for unresolved identity roles', () => {
	assert.match(mutationPolicy, /MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST/)
	assert.match(mutationPolicy, /AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS/)
	assert.match(mutationPolicy, /const liveTestOnly = providerEnv === 'production'/)
	assert.match(mutationPolicy, /assertMightyMutationRuntimeReady/)
	assert.match(mutationPolicy, /MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS/)
	assert.match(mutationPolicy, /mighty_identity_review_required/)
	assert.match(mutationPolicy, /mighty_host_mutation_protected/)
	assert.match(sync, /assertMightyMutationAllowed/)
	assert.match(sync, /assertIdentityMutationSafe/)
})

test('reconciliation and dry-run remain read-only and classify overlap/privilege risks', () => {
	assert.match(reconciliation, /OVERLAPPING_ACCESS_REVIEW/)
	assert.match(reconciliation, /PRIVILEGED_EXCLUDED/)
	assert.match(reconciliation, /mutationPerformed: false/)
	assert.match(reconciliation, /readOnly: true/)
	assert.match(reconciliation, /mutationPerformed: false/)
	assert.match(dryRun, /assertReadOnlyProductionBoundary/)
	assert.equal(JSON.parse(packageJson).scripts['mighty:access-dry-run'], 'tsx scripts/mighty/rehearseCutover.mts')
	assert.equal(JSON.parse(packageJson).scripts['mighty:cutover-rehearsal'], 'tsx scripts/mighty/rehearseCutover.mts')
	assert.match(cutoverRehearsal, /STRIPE_ENV !== 'live'/)
	assert.match(cutoverRehearsal, /MIGHTY_PROVIDER_ENV\?\.trim\(\) !== 'production'/)
	assert.match(cutoverRehearsal, /exactly three authorized live test identities/)
	assert.doesNotMatch(cutoverRehearsal, /api\.listMembers|api\.findAllPurchases|listActiveSubscriptions/)
	assert.match(cutoverRehearsal, /mutationPerformed: false/)
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
	assert.match(sync, /leaseUntil: candidate\.leaseUntil/)
	assert.match(sync, /lastStripeEventId: row\.lastStripeEventId/)
})

test('staging worker scheduling is fixed to non-production and secret-scoped', () => {
	assert.match(stagingScheduler, /cron: ['"]\*\/5 \* \* \* \*['"]?/)
	assert.match(stagingScheduler, /environment: staging-mighty-sync/)
	assert.match(stagingScheduler, /STAGING_ORIGIN: https:\/\/staging\.jpvbootcamp\.com/)
	assert.match(stagingScheduler, /MIGHTY_ACCESS_SYNC_WORKER_SECRET/)
	assert.doesNotMatch(stagingScheduler, /https:\/\/jpvbootcamp\.com(?:\/|['"\s])/)
	assert.match(stagingEvidence, /no matching Mighty\/JPV schedule found|no matching Mighty\/JPV schedule/i)
})

test('production worker scheduling is fixed to the production origin and secret-scoped', () => {
	assert.match(productionScheduler, /cron: ['"]\*\/5 \* \* \* \*['"]?/)
	assert.match(productionScheduler, /environment: production-mighty-sync/)
	assert.match(productionScheduler, /PRODUCTION_ORIGIN: https:\/\/jpvbootcamp\.com/)
	assert.match(productionScheduler, /MIGHTY_ACCESS_SYNC_WORKER_SECRET/)
	assert.match(productionScheduler, /MIGHTY_ACCESS_SYNC_ENABLED == 'true'/)
	assert.match(productionScheduler, /run_production_sync/)
	assert.match(productionScheduler, /inputs\.run_production_sync == 'yes'/)
	assert.doesNotMatch(productionScheduler, /staging\.jpvbootcamp\.com/)
})

test('staging acceptance harness requires explicit non-production guards', () => {
	assert.match(stagingAcceptance, /MIGHTY_PROVIDER_ENV/)
	assert.match(stagingAcceptance, /environment !== 'staging'/)
	assert.match(stagingAcceptance, /MIGHTY_STAGING_ALLOW_API_MUTATIONS/)
	assert.match(stagingAcceptance, /mighty_acceptance_test_member_must_be_disposable_and_absent/)
	assert.match(stagingEvidence, /MIGHTY_STAGING_TEST_EMAIL_CHANGED/)
})

test('production acceptance harness requires explicit production guards and preserves final access', () => {
	assert.match(productionAcceptance, /MIGHTY_PROVIDER_ENV\?\.trim\(\) !== 'production'/)
	assert.match(productionAcceptance, /MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS/)
	assert.match(productionAcceptance, /MIGHTY_PRODUCTION_TEST_EMAIL/)
	assert.match(productionAcceptance, /reconcileAccess\(/)
	assert.match(productionAcceptance, /getAccessState\(/)
	assert.match(productionAcceptance, /const preExistingMember = await api\.findMember\(email\)/)
	assert.match(productionAcceptance, /memberReusedThroughReconcileAccess: Boolean\(preExistingMember\)/)
	assert.doesNotMatch(productionAcceptance, /mighty_acceptance_test_member_must_be_disposable_and_absent/)
	assert.match(productionAcceptance, /acceptance cleanup must leave disposable test access granted/)
	assert.match(productionAcceptance, /finalStateAccessGranted: true/)
	assert.doesNotMatch(productionAcceptance, /MIGHTY_STAGING|staging\.jpvbootcamp\.com/)
	assert.match(productionAcceptance, /westhoek@hotmail\.com/)
	assert.match(productionAcceptance, /MIGHTY_IDENTITY_ROLE_OVERRIDES/)
})

test('configuration check is read-only and reports Plan verification separately', () => {
	assert.match(configurationCheck, /readOnly: true/)
	assert.match(configurationCheck, /MIGHTY_ACCESS_PLAN_ID/)
	assert.match(configurationCheck, /planIdVerification/)
	assert.match(configurationCheck, /provider_lookup_required/)
	assert.match(configurationCheck, /readyForAcceptance: configurationShapeReady && planIdVerification === 'verified'/)
})

test('manual access audit is read-only and identifies direct or overlapping access risk', () => {
	assert.match(manualAccessAudit, /config\.accessPlanId/)
	assert.match(manualAccessAudit, /AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS/)
	assert.match(manualAccessAudit, /findMemberByEmail\(email\)/)
	assert.doesNotMatch(manualAccessAudit, /listMembers\(\)|findAllPurchases\(\)/)
	assert.match(manualAccessAudit, /directAccessWithoutTargetPlanCount/)
	assert.match(manualAccessAudit, /otherPlanOverlapCount/)
	assert.match(manualAccessAudit, /mutationPerformed: false/)
	assert.doesNotMatch(manualAccessAudit, /createMember|grantAccess|restoreAccess|revokeAccess/)
})

test('silent-build rollout and administrator canary procedure are canonical and unexecuted', () => {
	for (const document of [migrationPlan, roadmapStatus, currentHandoff]) {
		assert.match(document, /Phase A|silent build/i)
		assert.match(document, /Phase B|owner acceptance/i)
		assert.match(document, /Phase C|administrator canary/i)
		assert.match(document, /Phase D|member migration/i)
		assert.match(document, /Phase E|automation enablement/i)
	}
	assert.match(adminCanaryProcedure, /Phase C|administrator canary/i)
	assert.match(adminCanaryProcedure, /prepared and remains unexecuted/)
	assert.match(adminCanaryProcedure, /supplies exactly one administrator identity/)
	assert.match(adminCanaryProcedure, /explicitly\s+authorizes that identity/)
	assert.match(adminCanaryProcedure, /does not create or modify a second test identity/)
	assert.match(migrationPlan, /stop-on-error/)
	assert.match(migrationPlan, /resumable checkpoints/)
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
