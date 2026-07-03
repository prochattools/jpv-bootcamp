import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { buildShadowValidationReport } from '../src/lib/shadowValidationReport'
import { validatePreviewReleaseCutoverPreflight } from '../src/lib/previewReleasePreflight'

async function main(): Promise<void> {
  const readinessPage = await readFile('src/app/(frontend)/operations/shadow-validation/page.tsx', 'utf8')
  assert.match(readinessPage, /notFound\(\)/)
  assert.doesNotMatch(readinessPage, /\bfetch\(|\baxios\b|\bprisma\./i)

  const healthy = await buildShadowValidationReport(
    {
      STRIPE_ENV: 'test',
      STRIPE_SECRET_KEY_TEST: 'sk_test_shadow',
      STRIPE_WEBHOOK_SECRET_TEST: 'whsec_shadow',
      STRIPE_PRICE_PRO_TEST: 'price_pro_shadow',
      STRIPE_PRICE_VIP_TEST: 'price_vip_shadow',
      APP_PUBLIC_URL: 'https://preview.example.test',
      STARTUP_MODE: 'application-only',
      DEPLOYMENT_RUNTIME: 'docker',
    } as unknown as NodeJS.ProcessEnv,
    {
      fixture: {
        repositoryReady: true,
        configurationReady: true,
        issueCounts: {
          identity: 0,
          entitlements: 0,
          billing: 0,
          email: 0,
          content: 0,
          community: 0,
          partners: 0,
          release: 0,
        },
        cutoverApprovals: {
          migrationExecution: false,
          previewDeployment: false,
          billingWebhookCheckoutPortal: false,
          providerEmailDryRun: false,
          providerEmailApply: false,
          communityJourneyVerification: false,
          partnerDeliveryVerification: false,
          finalCutover: false,
        },
      },
    }
  )

  assert.equal(healthy.repositoryReady, true)
  assert.equal(healthy.configurationReady, true)
  assert.equal(healthy.cutoverReady, false)
  assert.equal(healthy.issues.length, 0)
  assert.equal(healthy.domains.identity.issueCount, 0)
  assert.equal(healthy.domains.partners.issueCount, 0)
  assert.doesNotMatch(JSON.stringify(healthy), /sk_test_shadow|whsec_shadow|price_pro_shadow|price_vip_shadow|https:\/\/preview\.example\.test/i)

  const defaults = await buildShadowValidationReport()
  assert.equal(defaults.cutoverReady, false)
  assert.equal(defaults.domains.identity.issueCount >= 0, true)
  assert.equal(defaults.domains.billing.issueCount >= 0, true)
  assert.equal(defaults.domains.partners.issueCount >= 0, true)
  assert.equal(Array.isArray(defaults.journeys), true)

  const preflight = validatePreviewReleaseCutoverPreflight({})
  assert.equal(preflight.migrationExecution.authorized, false)
  assert.equal(preflight.previewDeployment.authorized, false)
  assert.equal(preflight.billingVerification.authorized, false)
  assert.equal(preflight.providerEmailDryRun.authorized, false)
  assert.equal(preflight.providerEmailApply.authorized, false)
  assert.equal(preflight.communityVerification.authorized, false)
  assert.equal(preflight.partnerDeliveryVerification.authorized, false)
  assert.equal(preflight.finalCutover.authorized, false)

  const approved = validatePreviewReleaseCutoverPreflight({
    migrationExecution: {
      authorized: true,
      environment: 'preview',
      migrationOrder: ['20260701_201500_member_email_verification', '20260702_001500_member_account_action_purposes'],
      operator: 'migration-op',
      approvalReference: 'approval-1',
      stopConditions: ['stop'],
    },
    previewDeployment: {
      authorized: true,
      commitSha: '00d874480ef075ca8a853f9fa127e251d7b6a7ce',
      imageReference: 'ghcr.io/prochattools/jpv-bootcamp:00d874480ef075ca8a853f9fa127e251d7b6a7ce',
      operator: 'deploy-op',
      approvalReference: 'approval-2',
      stopConditions: ['stop'],
    },
    billingVerification: {
      authorized: true,
      checkout: true,
      portal: true,
      webhook: true,
      operator: 'billing-op',
      approvalReference: 'approval-3',
      stopConditions: ['stop'],
    },
    providerEmailDryRun: {
      authorized: true,
      operator: 'email-op',
      approvalReference: 'approval-4',
      stopConditions: ['stop'],
    },
    providerEmailApply: {
      authorized: true,
      operator: 'email-op',
      approvalReference: 'approval-5',
      stopConditions: ['stop'],
    },
    communityVerification: {
      authorized: true,
      operator: 'community-op',
      approvalReference: 'approval-6',
      stopConditions: ['stop'],
    },
    partnerDeliveryVerification: {
      authorized: true,
      operator: 'partner-op',
      approvalReference: 'approval-7',
      stopConditions: ['stop'],
    },
    finalCutover: {
      authorized: true,
      operator: 'cutover-op',
      approvalReference: 'approval-8',
      stopConditions: ['stop'],
    },
  })

  assert.equal(approved.migrationExecution.ok, true)
  assert.equal(approved.previewDeployment.ok, true)
  assert.equal(approved.billingVerification.ok, true)
  assert.equal(approved.providerEmailDryRun.ok, true)
  assert.equal(approved.providerEmailApply.ok, true)
  assert.equal(approved.communityVerification.ok, true)
  assert.equal(approved.partnerDeliveryVerification.ok, true)
  assert.equal(approved.finalCutover.ok, true)

  const missingApproval = validatePreviewReleaseCutoverPreflight({
    finalCutover: {
      authorized: true,
      operator: 'cutover-op',
      stopConditions: ['stop'],
    },
  })
  assert.equal(missingApproval.finalCutover.errors.includes('approval_reference_required'), true)

  console.log('payload shadow validation tests passed')
}

main().catch((error) => {
  console.error('payload shadow validation tests failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
