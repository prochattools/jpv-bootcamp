import { readFile } from 'node:fs/promises'
import { buildBillingReadinessReport } from '@/lib/billingReadiness'
import { expectedPayloadMigrationOrder } from '@/lib/previewReleasePreflight'

export type ShadowIssueCode =
  | 'identity_pending_migration'
  | 'entitlement_reconciliation_pending'
  | 'billing_live_verification_pending'
  | 'billing_subscription_projection_unreviewed'
  | 'billing_payment_projection_unreviewed'
  | 'email_migration_pending'
  | 'content_inventory_unverified'
  | 'community_visibility_unverified'
  | 'community_orphan_unreviewed'
  | 'partner_delivery_unverified'
  | 'partner_integrity_unverified'
  | 'release_approval_missing'
  | 'cutover_approval_missing'

export type ShadowIssue = {
  code: ShadowIssueCode
  severity: 'info' | 'warning' | 'error'
  domain: 'identity' | 'entitlements' | 'billing' | 'email' | 'content' | 'community' | 'partners' | 'release'
  detail: string
}

export type ShadowValidationReport = {
  checkedAt: string
  repositoryReady: boolean
  configurationReady: boolean
  migrationExecutionPending: boolean
  liveVerificationPending: boolean
  cutoverReady: boolean
  domains: {
    identity: { ready: boolean; issueCount: number; pendingMigrations: string[] }
    entitlements: { ready: boolean; issueCount: number }
    billing: { ready: boolean; issueCount: number }
    email: { ready: boolean; issueCount: number; pendingMigrations: string[] }
    content: { ready: boolean; issueCount: number }
    community: { ready: boolean; issueCount: number }
    partners: { ready: boolean; issueCount: number }
    release: { ready: boolean; issueCount: number }
  }
  issues: ShadowIssue[]
  metadata: {
    commitSha: string | null
    nodeVersion: string
    pnpmVersion: string
    startupMode: string | null
    migrationOrder: string[]
    approvalsPresent: {
      migrationExecution: boolean
      previewDeployment: boolean
      billingWebhookCheckoutPortal: boolean
      providerEmailDryRun: boolean
      providerEmailApply: boolean
      communityJourneyVerification: boolean
      partnerDeliveryVerification: boolean
      finalCutover: boolean
    }
  }
}

export type ShadowValidationFixture = {
  domainIssueCounts?: Partial<Record<ShadowIssue['domain'], number>>
  approvals?: Partial<ShadowValidationReport['metadata']['approvalsPresent']>
  repositoryReady?: boolean
  configurationReady?: boolean
}

function present(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

async function safeRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

function countBool(values: boolean[]): number {
  return values.filter(Boolean).length
}

function commitShaFromEnv(): string | null {
  return present(process.env.GITHUB_SHA) ? process.env.GITHUB_SHA!.trim() : null
}

export async function buildShadowValidationReport(
  env: NodeJS.ProcessEnv = process.env,
  fixture: ShadowValidationFixture = {},
  approvals = {
    migrationExecution: false,
    previewDeployment: false,
    billingWebhookCheckoutPortal: false,
    providerEmailDryRun: false,
    providerEmailApply: false,
    communityJourneyVerification: false,
    partnerDeliveryVerification: false,
    finalCutover: false,
  },
): Promise<ShadowValidationReport> {
  const [billing, phase10Doc, integrationDoc, migrationDoc, communityPage, partnerPage] = await Promise.all([
    buildBillingReadinessReport(env),
    safeRead('docs/PREVIEW_RELEASE_READINESS.md'),
    safeRead('docs/PAYLOAD_INTEGRATION_PLAN.md'),
    safeRead('docs/PAYLOAD_MIGRATION.md'),
    safeRead('src/app/(frontend)/learn/community/page.tsx'),
    safeRead('src/app/(frontend)/portal/partners/page.tsx'),
  ])

  const pendingMigrations = expectedPayloadMigrationOrder()
  const emailMigrationPending = ['20260701_201500_member_email_verification', '20260702_001500_member_account_action_purposes']
  const domainCounts = {
    identity: fixture.domainIssueCounts?.identity ?? 1,
    entitlements: fixture.domainIssueCounts?.entitlements ?? 1,
    billing: fixture.domainIssueCounts?.billing ?? 2,
    email: fixture.domainIssueCounts?.email ?? 1,
    content: fixture.domainIssueCounts?.content ?? 1,
    community: fixture.domainIssueCounts?.community ?? 1,
    partners: fixture.domainIssueCounts?.partners ?? 1,
    release: fixture.domainIssueCounts?.release ?? 1,
  }

  const issues: ShadowIssue[] = [
    ...(domainCounts.identity > 0
      ? [{
          code: 'identity_pending_migration',
          severity: 'info',
          domain: 'identity',
          detail: 'Member verification and account-action migrations remain part of the live approval path.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.entitlements > 0
      ? [{
          code: 'entitlement_reconciliation_pending',
          severity: billing.repositoryReady ? 'warning' : 'error',
          domain: 'entitlements',
          detail: 'Course and access reconciliation is still a shadow validation step before cutover.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.billing > 0
      ? [{
          code: 'billing_live_verification_pending',
          severity: 'warning',
          domain: 'billing',
          detail: 'Billing configuration is ready, but live verification remains pending.',
        } satisfies ShadowIssue,
        {
          code: 'billing_payment_projection_unreviewed',
          severity: 'warning',
          domain: 'billing',
          detail: 'Subscription and payment projection remain read-only validation targets.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.email > 0
      ? [{
          code: 'email_migration_pending',
          severity: 'warning',
          domain: 'email',
          detail: 'Account-security email migrations are still pending live execution.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.content > 0
      ? [{
          code: 'content_inventory_unverified',
          severity: 'warning',
          domain: 'content',
          detail: 'Course, module, lesson, and resource inventory should be shadow-checked before cutover.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.community > 0
      ? [{
          code: 'community_visibility_unverified',
          severity: 'warning',
          domain: 'community',
          detail: 'Community space visibility, membership, post, comment, and file checks remain read-only.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.partners > 0
      ? [{
          code: 'partner_delivery_unverified',
          severity: 'warning',
          domain: 'partners',
          detail: 'Partner delivery, retry, and reconciliation remain in the shadow phase until approved.',
        } satisfies ShadowIssue]
      : []),
    ...(domainCounts.release > 0
      ? [{
          code: 'release_approval_missing',
          severity: 'warning',
          domain: 'release',
          detail: 'Preview deployment, provider, and cutover approvals are isolated and still pending live use.',
        } satisfies ShadowIssue]
      : []),
  ]

  const repositoryReady = fixture.repositoryReady ?? Boolean(
    billing.repositoryReady &&
      phase10Doc &&
      integrationDoc &&
      migrationDoc &&
      communityPage &&
      partnerPage,
  )
  const configurationReady = fixture.configurationReady ?? billing.configurationReady
  const migrationExecutionPending = !(fixture.approvals?.migrationExecution ?? approvals.migrationExecution)
  const liveVerificationPending = true
  const cutoverReady = false

  return {
    checkedAt: new Date().toISOString(),
    repositoryReady,
    configurationReady,
    migrationExecutionPending,
    liveVerificationPending,
    cutoverReady,
    domains: {
      identity: { ready: false, issueCount: domainCounts.identity, pendingMigrations },
      entitlements: { ready: false, issueCount: domainCounts.entitlements },
      billing: { ready: false, issueCount: domainCounts.billing },
      email: { ready: false, issueCount: domainCounts.email, pendingMigrations: emailMigrationPending },
      content: { ready: false, issueCount: domainCounts.content },
      community: { ready: false, issueCount: domainCounts.community },
      partners: { ready: false, issueCount: domainCounts.partners },
      release: { ready: false, issueCount: domainCounts.release },
    },
    issues,
    metadata: {
      commitSha: commitShaFromEnv(),
      nodeVersion: '20',
      pnpmVersion: '10.33.0',
      startupMode: env.STARTUP_MODE ?? null,
      migrationOrder: pendingMigrations,
      approvalsPresent: {
        migrationExecution: fixture.approvals?.migrationExecution ?? approvals.migrationExecution,
        previewDeployment: fixture.approvals?.previewDeployment ?? approvals.previewDeployment,
        billingWebhookCheckoutPortal: fixture.approvals?.billingWebhookCheckoutPortal ?? approvals.billingWebhookCheckoutPortal,
        providerEmailDryRun: fixture.approvals?.providerEmailDryRun ?? approvals.providerEmailDryRun,
        providerEmailApply: fixture.approvals?.providerEmailApply ?? approvals.providerEmailApply,
        communityJourneyVerification: fixture.approvals?.communityJourneyVerification ?? approvals.communityJourneyVerification,
        partnerDeliveryVerification: fixture.approvals?.partnerDeliveryVerification ?? approvals.partnerDeliveryVerification,
        finalCutover: fixture.approvals?.finalCutover ?? approvals.finalCutover,
      },
    },
  }
}

export function shadowIssueTotals(report: ShadowValidationReport): Record<ShadowIssue['domain'], number> {
  return {
    identity: report.domains.identity.issueCount,
    entitlements: report.domains.entitlements.issueCount,
    billing: report.domains.billing.issueCount,
    email: report.domains.email.issueCount,
    content: report.domains.content.issueCount,
    community: report.domains.community.issueCount,
    partners: report.domains.partners.issueCount,
    release: report.domains.release.issueCount,
  }
}
