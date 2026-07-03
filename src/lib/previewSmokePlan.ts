import { isImmutableImageReference } from './previewReleasePolicy'
import { validatePreviewReleasePreflight, type PreviewReleasePreflightInput } from './previewReleasePreflight'

export type SmokeCheckAuthorizationCategory =
  | 'smokeVerification'
  | 'providerDryRun'
  | 'providerApply'
  | 'migrationExecution'
  | 'previewDeployment'

export type SmokeCheckEvidenceField =
  | 'checkKey'
  | 'environmentLabel'
  | 'status'
  | 'safeStatus'
  | 'errorCode'
  | 'operator'
  | 'approvalReference'
  | 'artifactDigest'
  | 'commitSha'
  | 'imageReference'

export type SmokeCheckRisk = {
  networkRequired: boolean
  authenticationRequired: boolean
  mutationPossible: boolean
  databaseReadPossible: boolean
  databaseWritePossible: boolean
  providerCallPossible: boolean
  authorizationCategoryRequired: SmokeCheckAuthorizationCategory
}

export type SmokeCheckPlan = {
  key: string
  description: string
  authorizationCategory: SmokeCheckAuthorizationCategory
  automated: boolean
  risk: SmokeCheckRisk
  prerequisites: string[]
  expectedResult: string
  requiredEvidenceFields: SmokeCheckEvidenceField[]
  stopConditions: string[]
}

export type SmokePlanInput = {
  execute?: boolean
  target?: string
  authorization?: PreviewReleasePreflightInput
  imageReference?: string
}

export type SmokePlanResult = {
  executable: boolean
  errors: string[]
  checks: SmokeCheckPlan[]
}

export const PREVIEW_SMOKE_CHECKS: SmokeCheckPlan[] = [
  {
    key: 'public-root',
    description: 'Root page is reachable and login entry renders.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Exact HTTPS target is approved', 'Smoke verification approval is present'],
    expectedResult: 'Public root and login surfaces respond without exposing private data.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'commitSha', 'artifactDigest'],
    stopConditions: ['Unexpected redirect', 'Auth boundary leak', 'Sensitive text in response'],
  },
  {
    key: 'admin-member-separation',
    description: 'Administrator and member surfaces stay isolated.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Administrator and member test identities exist'],
    expectedResult: 'Admin sessions never resolve to member surfaces and member sessions never resolve to admin.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Identity crossover', 'Redirect escape', 'Session reuse across roles'],
  },
  {
    key: 'invalid-invitation-token',
    description: 'Invalid invitation tokens fail closed.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Invalid invitation tokens produce a generic safe response and no state change.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Token accepted', 'Token details leaked'],
  },
  {
    key: 'invalid-verification-token',
    description: 'Invalid verification tokens fail closed.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Invalid verification tokens produce a generic safe response and no state change.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Token accepted', 'Sensitive account state exposed'],
  },
  {
    key: 'invalid-setup-token',
    description: 'Invalid account setup tokens fail closed.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Invalid setup tokens produce a generic safe response and no state change.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Token accepted', 'Account setup path reveals internals'],
  },
  {
    key: 'invalid-reset-token',
    description: 'Invalid password reset tokens fail closed.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Invalid reset tokens produce a generic safe response and no state change.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Token accepted', 'Reset path exposes secrets'],
  },
  {
    key: 'test-member-account-flows',
    description: 'Approved test-member account flows remain safe and bounded.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Test member account is approved'],
    expectedResult: 'Approved test-member flows work without exposing secrets or crossing role boundaries.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Non-test member touched', 'Secret material serialized', 'Role boundary crossed'],
  },
  {
    key: 'authorized-course-module-lesson',
    description: 'Authorized course, module, and lesson routes resolve for entitled members.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Authorized member fixture exists'],
    expectedResult: 'Entitled members can read the expected course, module, and lesson surfaces.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'commitSha', 'artifactDigest'],
    stopConditions: ['Entitlement denied unexpectedly', 'Lesson content missing'],
  },
  {
    key: 'denied-entitlement',
    description: 'Denied entitlements remain denied.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Denied-member fixture exists'],
    expectedResult: 'Denied members cannot access protected course content.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Denied member gains access', 'Access denial leaks internals'],
  },
  {
    key: 'protected-resource',
    description: 'Protected lesson resources require authorization.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Protected resources cannot be fetched without the required access.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Protected file exposed', 'Permanent public URL observed'],
  },
  {
    key: 'progress-read-write',
    description: 'Progress read and write behavior is bounded to authorized members.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Authorized course fixture exists'],
    expectedResult: 'Progress can be read and updated only by the authorized learner.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator'],
    stopConditions: ['Unauthorized write succeeds', 'Progress state leaks'],
  },
  {
    key: 'billing-checkout',
    description: 'Billing checkout is available only through approved member flow.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: true,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Billing fixture exists'],
    expectedResult: 'Checkout starts only for eligible members and records safe evidence.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'approvalReference'],
    stopConditions: ['Unauthenticated checkout begins', 'Provider call without approval'],
  },
  {
    key: 'existing-subscription-rejection',
    description: 'Existing active subscriptions block duplicate checkout.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Existing subscription fixture exists'],
    expectedResult: 'Members with an active subscription cannot create a duplicate checkout.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Duplicate checkout proceeds', 'Subscription status omitted'],
  },
  {
    key: 'billing-portal',
    description: 'Billing portal opens from authorized member state.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: true,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Portal fixture exists'],
    expectedResult: 'Portal opens with server-derived identity and approved evidence.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Identity spoofing', 'Provider call without approval'],
  },
  {
    key: 'billing-webhook-projection',
    description: 'Billing webhook projection stays in sync with known events.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Webhook projection matches the repository-only event model.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'artifactDigest'],
    stopConditions: ['Projection mismatch', 'Unsafe webhook data leaked'],
  },
  {
    key: 'failed-recovered-payment',
    description: 'Failed and recovered payments are tracked without unsafe access changes.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Payment failure and recovery projections remain deterministic.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'artifactDigest'],
    stopConditions: ['Unsafe access transition', 'Sensitive payment fields exposed'],
  },
  {
    key: 'refund-dispute',
    description: 'Refund and dispute projections remain bounded and safe.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Refund and dispute state can be represented without changing access by itself.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'artifactDigest'],
    stopConditions: ['Access change without subscription authority', 'Charge identifiers exposed'],
  },
  {
    key: 'community-access',
    description: 'Accessible, private, and secret community spaces enforce visibility.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Community fixtures exist'],
    expectedResult: 'Only the expected community visibility level is reachable.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator'],
    stopConditions: ['Private space accessible publicly', 'Secret space leaks'],
  },
  {
    key: 'community-post-comment',
    description: 'Community post and comment creation stay authorized.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Community posting fixture exists'],
    expectedResult: 'Authorized members can post and comment within the approved space.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Unauthorized comment created', 'Hidden moderation state exposed'],
  },
  {
    key: 'community-moderation',
    description: 'Moderation actions remain scoped to the approved space.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Moderator fixture exists'],
    expectedResult: 'Moderation actions succeed only for authorized moderators.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Non-moderator moderation succeeds', 'Moderation audit missing'],
  },
  {
    key: 'community-protected-attachment',
    description: 'Protected community attachments require authorization.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Protected attachments are not exposed without the right access.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Protected attachment exposed', 'Public URL contains path/query'],
  },
  {
    key: 'partner-directory-detail',
    description: 'Partner directory and detail views are readable in approved scope.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Partner directory fixture exists'],
    expectedResult: 'Approved partner directory and detail entries render safely.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'artifactDigest'],
    stopConditions: ['Unauthorized detail exposure', 'Partner customer data serialized'],
  },
  {
    key: 'partner-application-history',
    description: 'Partner application persistence and history remain stable.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present', 'Partner application fixture exists'],
    expectedResult: 'Application history records are retained and scoped to the member.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Application history lost', 'History crosses member boundary'],
  },
  {
    key: 'partner-delivery-pending',
    description: 'Pending partner delivery states remain pending until approved action.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Pending delivery is preserved and visible in safe evidence.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'errorCode'],
    stopConditions: ['Pending becomes delivered without approval', 'Delivery destination exposed'],
  },
  {
    key: 'partner-admin-report-export-retry',
    description: 'Admin report, export, and retry flows stay scoped to approvals.',
    authorizationCategory: 'providerApply',
    automated: false,
    risk: {
      networkRequired: true,
      authenticationRequired: true,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: true,
      authorizationCategoryRequired: 'providerApply',
    },
    prerequisites: ['Provider apply approval is present', 'Admin operator is approved'],
    expectedResult: 'Reports, exports, and retries require explicit provider authorization.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Provider call without apply approval', 'Export or retry outside admin scope'],
  },
  {
    key: 'shadow-page-evidence',
    description: 'Shadow validation page and evidence export remain read-only.',
    authorizationCategory: 'smokeVerification',
    automated: true,
    risk: {
      networkRequired: false,
      authenticationRequired: true,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
    prerequisites: ['Smoke verification approval is present'],
    expectedResult: 'Shadow validation renders repository-only readiness and safe evidence export.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'artifactDigest'],
    stopConditions: ['Shadow page mutates state', 'Evidence contains secrets'],
  },
  {
    key: 'migration-verification',
    description: 'Migration inventory verification stays repository-only.',
    authorizationCategory: 'migrationExecution',
    automated: true,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'migrationExecution',
    },
    prerequisites: ['Migration execution approval is present'],
    expectedResult: 'Migration order and inventory are verified without applying anything.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'commitSha', 'artifactDigest'],
    stopConditions: ['Inventory mismatch', 'Migration execution implied'],
  },
  {
    key: 'provider-dry-run',
    description: 'Provider dry-run stays detached from provider apply.',
    authorizationCategory: 'providerDryRun',
    automated: false,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'providerDryRun',
    },
    prerequisites: ['Provider dry-run approval is present'],
    expectedResult: 'Dry-run plan can be inspected without executing provider calls.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Dry-run triggers provider activity', 'Apply authorization implied'],
  },
  {
    key: 'provider-apply',
    description: 'Provider apply remains explicitly authorized and separate.',
    authorizationCategory: 'providerApply',
    automated: false,
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: true,
      authorizationCategoryRequired: 'providerApply',
    },
    prerequisites: ['Provider apply approval is present'],
    expectedResult: 'Provider apply is not executable without exact apply approval.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'operator', 'approvalReference'],
    stopConditions: ['Provider apply runs from read-only approval', 'Recipient or sender data exposed'],
  },
  {
    key: 'final-cutover-readiness',
    description: 'Final cutover readiness remains pending until all live approvals are present.',
    authorizationCategory: 'previewDeployment',
    automated: false,
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'previewDeployment',
    },
    prerequisites: ['Preview deployment approval is present', 'Cutover approvals are present'],
    expectedResult: 'Cutover readiness remains a gating signal, not an execution step.',
    requiredEvidenceFields: ['checkKey', 'environmentLabel', 'status', 'safeStatus', 'commitSha', 'imageReference'],
    stopConditions: ['Cutover implied by readiness check', 'Pending approvals ignored'],
  },
]

export type SmokeEvidenceStatus = 'passed' | 'failed' | 'blocked' | 'skipped'

export type SmokeEvidenceInput = {
  schemaVersion: 1
  commitSha: string
  imageReference?: string
  environmentLabel: string
  checkKey: string
  startTime: string
  endTime: string
  status: SmokeEvidenceStatus
  safeStatus: string
  errorCode?: string
  operator?: string
  approvalReference?: string
  notes?: string
  artifactDigest: string
  authorizationCategory: SmokeCheckAuthorizationCategory
}

export type SmokeEvidenceValidationResult = {
  ok: boolean
  errors: string[]
}

function validHttpsTarget(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

function hasRequiredString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return hasRequiredString(value) && !Number.isNaN(Date.parse(value))
}

function hasSensitiveMaterial(value: string): boolean {
  return /(?:password|cookie|token|secret|apikey|api_key|session|customer[_-]?id|provider[_-]?id|database_url|postgres:\/\/|mysql:\/\/|https?:\/\/[^/\s]+\/[^\s?]+(?:\?[^\s]*)?)/i.test(value) ||
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(value)
}

const smokeCheckKeys = new Set(PREVIEW_SMOKE_CHECKS.map((check) => check.key))
const evidenceStatuses = new Set<SmokeEvidenceStatus>(['passed', 'failed', 'blocked', 'skipped'])

export function validatePreviewSmokeEvidence(input: Partial<SmokeEvidenceInput>): SmokeEvidenceValidationResult {
  const errors: string[] = []
  if (input.schemaVersion !== 1) errors.push('schema_version_required')
  if (!hasRequiredString(input.commitSha) || !/^[0-9a-f]{40}$/i.test(input.commitSha)) errors.push('commit_sha_required')
  if (input.imageReference !== undefined && !isImmutableImageReference(input.imageReference)) errors.push('immutable_image_required')
  if (!hasRequiredString(input.environmentLabel)) errors.push('environment_label_required')
  if (!smokeCheckKeys.has(input.checkKey ?? '')) errors.push('unknown_check_key')
  if (!isIsoTimestamp(input.startTime)) errors.push('start_time_required')
  if (!isIsoTimestamp(input.endTime)) errors.push('end_time_required')
  if (isIsoTimestamp(input.startTime) && isIsoTimestamp(input.endTime) && Date.parse(input.endTime) < Date.parse(input.startTime)) errors.push('invalid_time_range')
  if (!evidenceStatuses.has(input.status as SmokeEvidenceStatus)) errors.push('status_required')
  if (!hasRequiredString(input.safeStatus)) errors.push('safe_status_required')
  if (!hasRequiredString(input.artifactDigest)) errors.push('artifact_digest_required')
  if (!Object.values<SmokeCheckAuthorizationCategory>(['smokeVerification', 'providerDryRun', 'providerApply', 'migrationExecution', 'previewDeployment']).includes(input.authorizationCategory as SmokeCheckAuthorizationCategory)) {
    errors.push('authorization_category_required')
  }
  const check = PREVIEW_SMOKE_CHECKS.find((entry) => entry.key === input.checkKey)
  if (check && input.authorizationCategory !== check.authorizationCategory) errors.push('authorization_category_mismatch')
  if (check && input.status === 'passed' && input.safeStatus !== 'ok') errors.push('invalid_passed_status')
  if (check && input.status === 'failed' && !hasRequiredString(input.errorCode)) errors.push('error_code_required')
  if (hasRequiredString(input.notes) && hasSensitiveMaterial(input.notes)) errors.push('sensitive_notes_rejected')
  if (hasRequiredString(input.operator) && hasSensitiveMaterial(input.operator)) errors.push('sensitive_notes_rejected')
  if (hasRequiredString(input.approvalReference) && hasSensitiveMaterial(input.approvalReference)) errors.push('sensitive_notes_rejected')
  if (hasRequiredString(input.imageReference) && !isImmutableImageReference(input.imageReference)) errors.push('immutable_image_required')
  return { ok: errors.length === 0, errors }
}

export function buildPreviewSmokePlan(
  input: {
    execute?: boolean
    target?: string
    authorization?: PreviewReleasePreflightInput
    imageReference?: string
  } = {},
): SmokePlanResult {
  const errors: string[] = []
  if (!input.execute) {
    return { executable: false, errors: ['execute_flag_required'], checks: PREVIEW_SMOKE_CHECKS }
  }
  if (!validHttpsTarget(input.target)) errors.push('exact_https_target_required')
  if (input.imageReference && !isImmutableImageReference(input.imageReference)) {
    errors.push('immutable_image_required')
  }
  const preflight = validatePreviewReleasePreflight(input.authorization ?? {})
  if (!preflight.smokeVerification.ok || !preflight.smokeVerification.authorized) {
    errors.push('smoke_authorization_required')
  }
  const checkKeys = PREVIEW_SMOKE_CHECKS.map((check) => check.key)
  if (new Set(checkKeys).size !== checkKeys.length) errors.push('duplicate_check_key')
  return { executable: errors.length === 0, errors, checks: PREVIEW_SMOKE_CHECKS }
}
