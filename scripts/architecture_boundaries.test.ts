import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(absolute)
    return /\.(?:ts|tsx|js|jsx|mjs|mts|scss)$/.test(entry.name) ? [absolute] : []
  })
}

const absoluteFiles = sourceFiles(sourceRoot)
const relative = (absolute: string) => path.relative(root, absolute).split(path.sep).join('/')
const files = new Map(absoluteFiles.map((absolute) => [relative(absolute), fs.readFileSync(absolute, 'utf8')]))
const failures: string[] = []

function fail(message: string): void {
  failures.push(message)
}

function assertExactCounts(
  label: string,
  pattern: RegExp,
  expected: Record<string, number>,
  include: (file: string) => boolean = () => true,
): void {
  const actual: Record<string, number> = {}
  for (const [file, content] of files) {
    if (!include(file)) continue
    const count = (content.match(pattern) ?? []).length
    if (count > 0) actual[file] = count
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} changed. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

// Every privileged Payload override is an intentional, registered exception.
// Adding one requires an architecture-register update in the same change.
const privilegedOverrideCounts: Record<string, number> = {
  'src/__tests__/checkout-and-livekit-regressions.test.ts': 2,
  'src/__tests__/email-operator-actions.test.ts': 1,
  'src/__tests__/operator-actions-route.test.ts': 3,
  'src/__tests__/portal-admin-foundation.test.ts': 2,
  'src/app/(frontend)/portal/[section]/page.tsx': 1,
  'src/app/(frontend)/portal/community/[spaceSlug]/calls/[sessionId]/page.tsx': 1,
  'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx': 3,
  'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx': 5,
  'src/app/(frontend)/portal/community/actions.ts': 4,
  'src/app/(frontend)/portal/community/page.tsx': 1,
  'src/app/(frontend)/portal/content/page.tsx': 1,
  'src/app/(frontend)/portal/live-sessions/[sessionId]/page.tsx': 2,
  'src/app/(frontend)/portal/live-sessions/page.tsx': 2,
  'src/app/(frontend)/portal/notifications/page.tsx': 2,
  'src/app/api/admin/community-smoke-check/route.ts': 4,
  'src/app/api/admin/operator-actions/route.ts': 4,
  'src/app/api/admin/pay-it-forward/queue/route.ts': 1,
  'src/app/api/admin/queued-emails/route.ts': 5,
  'src/app/api/admin/sessions/[id]/route.ts': 1,
  'src/app/api/admin/sessions/route.ts': 2,
  'src/app/api/admin/sponsored-applications/[id]/approve/route.ts': 1,
  'src/app/api/bunny/video/route.ts': 6,
  'src/app/api/community/files/route.ts': 2,
  'src/app/api/livekit/token/route.ts': 5,
  'src/app/api/portal/announcements/media/route.ts': 1,
  'src/app/api/portal/announcements/route.ts': 1,
  'src/app/api/portal/bookmarks/route.ts': 4,
  'src/app/api/portal/community/comments/route.ts': 1,
  'src/app/api/portal/community/posts/delete/route.ts': 3,
  'src/app/api/portal/live-sessions/[id]/route.ts': 1,
  'src/app/api/portal/live-sessions/route.ts': 3,
  'src/app/api/portal/notifications/route.ts': 6,
  'src/app/api/sponsored-applications/decision/route.ts': 1,
  'src/app/api/webhook/bunny/route.ts': 5,
  'src/collections/PayloadLiveSession.ts': 2,
  'src/collections/members/Members.ts': 1,
  'src/components/payload/JPVAdminDashboard.tsx': 1,
  'src/components/payload/JPVBillingOverview.tsx': 4,
  'src/lib/actions/openBillingPortal.ts': 1,
  'src/lib/auth/adminMemberIdentity.ts': 7,
  'src/lib/auth/payloadMemberAccountActions.ts': 2,
  'src/lib/auth/payloadMemberEmailVerification.ts': 7,
  'src/lib/auth/requirePortalAccess.ts': 1,
  'src/lib/auth/requirePortalMember.ts': 1,
  'src/lib/billing/delinquencySweep.ts': 2,
  'src/lib/billing/membershipReadModel.ts': 1,
  'src/lib/billing/stripeMemberIdentityReconciliation.ts': 1,
  'src/lib/billing/stripeOperatorActions.ts': 5,
  'src/lib/billing/stripePayloadReconciliation.ts': 5,
  'src/lib/community/persistence.ts': 2,
  'src/lib/email/emailOperatorActions.ts': 2,
  'src/lib/liveSessions/audience.ts': 5,
  'src/lib/liveSessions/memberSessions.ts': 4,
  'src/lib/liveSessions/sessionLifecycle.ts': 3,
  'src/lib/members/accountStatus.ts': 3,
  'src/lib/members/changeMemberEmail.ts': 9,
  'src/lib/members/changeMemberPassword.ts': 3,
  'src/lib/members/cleanupSensitiveEmailEvents.ts': 2,
  'src/lib/members/completeMemberSetup.ts': 6,
  'src/lib/members/completePasswordReset.ts': 5,
  'src/lib/members/currentMember.ts': 1,
  'src/lib/members/deleteMemberStripeCustomer.ts': 1,
  'src/lib/members/inviteMember.ts': 5,
  'src/lib/members/memberCoverImage.ts': 7,
  'src/lib/members/provisionMemberFromCheckout.ts': 4,
  'src/lib/members/redactDeliveredResetLink.ts': 2,
  'src/lib/members/registerFreeMember.ts': 6,
  'src/lib/members/requestPasswordReset.ts': 3,
  'src/lib/members/updateMemberProfile.ts': 5,
  'src/lib/membership-support/webhookReconciliation.ts': 5,
  'src/lib/partnerAffiliateReporting.ts': 1,
  'src/lib/payload/privilegedAccess.ts': 2,
  'src/lib/payloadContent/announcements.ts': 3,
  'src/lib/payloadContent/memberContent.ts': 2,
  'src/lib/payloadContent/memberMedia.ts': 2,
  'src/lib/payloadCourse/accessService.ts': 11,
  'src/lib/payloadCourse/adminGrants.ts': 5,
  'src/lib/payloadCourse/affiliateReporting.ts': 4,
  'src/lib/payloadCourse/bookmarks.ts': 1,
  'src/lib/payloadCourse/communityDiscussion.ts': 3,
  'src/lib/payloadCourse/communityFiles.ts': 5,
  'src/lib/payloadCourse/communityModeration.ts': 2,
  'src/lib/payloadCourse/communityModerationNotifications.ts': 2,
  'src/lib/payloadCourse/communityPortal.ts': 5,
  'src/lib/payloadCourse/communityPostNotifications.ts': 10,
  'src/lib/payloadCourse/communityPosting.ts': 7,
  'src/lib/payloadCourse/emailSender.ts': 7,
  'src/lib/payloadCourse/events.ts': 4,
  'src/lib/payloadCourse/leaderboard.ts': 5,
  'src/lib/payloadCourse/lessonDiscussion.ts': 10,
  'src/lib/payloadCourse/lessonResources.ts': 2,
  'src/lib/payloadCourse/memberBillingPortal.ts': 1,
  'src/lib/payloadCourse/memberDirectory.ts': 3,
  'src/lib/payloadCourse/memberNotifications.ts': 2,
  'src/lib/payloadCourse/memberPortal.ts': 4,
  'src/lib/payloadCourse/partnerApplications.ts': 7,
  'src/lib/payloadCourse/partnerDelivery.ts': 4,
  'src/lib/payloadCourse/reactions.ts': 13,
  'src/lib/payloadCourse/reconcileEntitlements.ts': 1,
  'src/lib/payloadCourse/spaceMemberships.ts': 7,
  'src/lib/payloadCourse/stripeShadowSync.ts': 9,
  'src/lib/portal/portalSettings.ts': 1,
  'src/lib/portalAdmin/adminPortal.ts': 1,
  'src/lib/shadowValidationReport.ts': 2,
  'src/lib/sponsored-admin-grant.ts': 2,
  'src/lib/sponsored-recipient.ts': 7,
  'src/lib/sponsored-seat-notifications.ts': 3,
  'src/lib/staging-auto-provision.ts': 10,
}
assertExactCounts('privileged Payload access register', /overrideAccess\s*:\s*true/g, privilegedOverrideCounts)

function assertPathAllowlist(
  label: string,
  pattern: RegExp,
  allowedPaths: Record<string, number>,
  include: (file: string) => boolean = () => true,
): void {
  const allowed = new Set(Object.keys(allowedPaths))
  const countPattern = new RegExp(pattern.source, pattern.flags.replace('g', ''))
  for (const [file, content] of files) {
    if (!include(file)) continue
    if ((content.match(countPattern) ?? []).length > 0 && !allowed.has(file)) {
      fail(`${label} contains an unregistered path: ${file}`)
    }
  }
  for (const file of allowed) {
    if (!files.has(file)) fail(`${label} registers a missing path: ${file}`)
  }
}

assertPathAllowlist('privileged Payload access allowlist', /overrideAccess\s*:\s*true/g, privilegedOverrideCounts)

// Direct Prisma imports are legacy/operational boundaries and are inventoried
// here so a new route-level data owner cannot appear silently.
const directPrismaImportCounts: Record<string, number> = {
  'src/app/(frontend)/billing/portal/route.ts': 1,
  'src/app/(frontend)/operations/partners-clicks/page.tsx': 2,
  'src/app/(frontend)/operations/sponsored-applications/page.tsx': 1,
  'src/app/(frontend)/out/[partnerSlug]/route.ts': 1,
  'src/app/api/admin/pay-it-forward/queue/route.ts': 1,
  'src/app/api/admin/sponsored-applications/[id]/approve/route.ts': 1,
  'src/app/api/admin/sponsored-applications/[id]/reject/route.ts': 1,
  'src/app/api/entitlements/route.ts': 1,
  'src/app/api/sponsored-applications/decision/route.ts': 1,
  'src/app/api/sponsored-applications/route.ts': 1,
  'src/app/api/stripe/billing-portal/route.ts': 1,
  'src/app/api/subscribe/route.ts': 1,
  'src/components/payload/JPVAdminDashboard.tsx': 1,
  'src/lib/actions/openBillingPortal.ts': 1,
  'src/lib/actions/startMemberCheckout.ts': 1,
  'src/lib/billing/billingStatusHelper.ts': 1,
  'src/lib/billing/commitmentProjection.ts': 1,
  'src/lib/email.ts': 1,
  'src/lib/idempotency.ts': 1,
  'src/lib/partners-session.ts': 1,
  'src/lib/provisioning.ts': 1,
  'src/lib/sponsored/claimSponsoredSeat.ts': 1,
  'src/lib/sponsored-admin-grant.ts': 2,
  'src/lib/sponsored-grants.ts': 1,
  'src/lib/sponsored-recipient.ts': 1,
  'src/lib/sponsored-seat-notifications.ts': 1,
  'src/lib/sponsored-seats.ts': 1,
  'src/lib/support/persistence.ts': 1,
}
assertExactCounts(
  'direct Prisma import register',
  /^import\s[^\n;]*(?:from\s+['"][^'"]*prisma[^'"]*['"]|from\s+['"]@prisma\/client['"])/gm,
  directPrismaImportCounts,
  (file) => file.startsWith('src/app/') || file.startsWith('src/components/') || file.startsWith('src/lib/'),
)
assertPathAllowlist(
  'direct Prisma import allowlist',
  /^import\s[^\n;]*(?:from\s+['"][^'"]*prisma[^'"]*['"]|from\s+['"]@prisma\/client['"])/gm,
  directPrismaImportCounts,
  (file) => file.startsWith('src/app/') || file.startsWith('src/components/') || file.startsWith('src/lib/'),
)

// Persistence writes belong to named server-only services, never pages or
// components. Keep this empty allowlist explicit so a future exception must
// be reviewed in this guard and the architecture register.
const pageWriteExceptions = new Set<string>()
const pageOrComponentWritePattern = /\b(?:payload|prisma|tx)\s*\.\s*(?:create|update|delete|upsert|\$transaction)\s*\(/g
for (const [file, content] of files) {
  if (!/(?:\/page\.(?:ts|tsx|js|jsx)$|\/components\/)/.test(`/${file}`)) continue
  if ((content.match(pageOrComponentWritePattern) ?? []).length > 0 && !pageWriteExceptions.has(file)) {
    fail(`unregistered direct persistence write from page/component: ${file}`)
  }
}

const serverOnlyFiles = new Set(
  [...files].filter(([, content]) => /(?:^|\n)\s*import\s+['"]server-only['"]/.test(content)).map(([file]) => file),
)
const allowedServerActionImports = new Set([
  'src/lib/actions/openBillingPortal.ts',
  'src/lib/actions/startMemberCheckout.ts',
  'src/lib/actions/requestMembershipCancellation.ts',
  'src/lib/actions/resumeMembershipCancellation.ts',
])
const clientFiles = [...files].filter(([, content]) => /^\s*['"]use client['"];?/m.test(content))
function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`.replace(/\.(?:ts|tsx|js|jsx)$/, '')
  if (!specifier.startsWith('.')) return null
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier)).replace(/\.(?:ts|tsx|js|jsx)$/, '')
}
for (const [file, content] of clientFiles) {
  for (const match of content.matchAll(/\bfrom\s+(['"])([^'"]+)\1/g)) {
    const resolvedBase = resolveImport(file, match[2]!)
    if (!resolvedBase) continue
    const target = [...serverOnlyFiles].find((candidate) => candidate.replace(/\.(?:ts|tsx|js|jsx)$/, '') === resolvedBase)
    if (target && !allowedServerActionImports.has(target)) {
      fail(`client module imports unapproved server-only module: ${file} -> ${target}`)
    }
  }
}

const legacyAdminHelperFiles = new Set([
  'src/app/api/admin/partner-applications/[id]/retry/route.ts',
  'src/app/api/admin/partner-applications/export/route.ts',
  'src/app/(frontend)/operations/partner-applications/page.tsx',
  'src/app/(frontend)/operations/shadow-validation/page.tsx',
  'src/app/api/admin/shadow-validation/evidence/route.ts',
  'src/app/api/portal/live-sessions/route.ts',
])
const adminHelperPattern = /\b(?:function\s+(?:requireAdmin|isAdminId)|(?:const|let)\s+(?:requireAdmin|isAdminId)\s*=)/g
for (const [file, content] of files) {
  if ((content.match(adminHelperPattern) ?? []).length === 0) continue
  if (file !== 'src/lib/auth/requirePortalAdmin.ts' && !legacyAdminHelperFiles.has(file)) {
    fail(`duplicated admin-auth helper outside the registered legacy list: ${file}`)
  }
}

const designTokenDeclarationFiles = new Set([
  'src/lib/brand/jpvDesignSystem.ts',
  'src/assets/styles/globals.scss',
  'src/app/(payload)/jpv-admin.scss',
])
for (const [file, content] of files) {
  if (/--jpv-[\w-]+\s*:/.test(content) && !designTokenDeclarationFiles.has(file)) {
    fail(`unregistered JPV design-token declaration: ${file}`)
  }
}
const designAuthorityDeclarationFiles = [...files]
  .filter(([, content]) => /\b(?:const|let|var)\s+(?:jpvDesignTokens|jpvCssVariables)\s*=/.test(content))
  .map(([file]) => file)
if (JSON.stringify(designAuthorityDeclarationFiles) !== JSON.stringify(['src/lib/brand/jpvDesignSystem.ts'])) {
  fail('canonical JPV design-token authority is missing')
}

const reconciliation = files.get('src/lib/billing/stripePayloadReconciliation.ts') ?? ''
if ((reconciliation.match(/if \(mode === 'apply'\) await options\.onCheckpoint\?\.\(checkpoint\)/g) ?? []).length !== 2) {
  fail('Stripe reconciliation checkpoints must be write-capable only in apply mode')
}

const expectedPayloadReads = new Set([
  'src/components/payload/JPVAdminDashboard.tsx',
  'src/components/payload/JPVBillingOverview.tsx',
])
for (const [file, content] of files) {
  if (content.includes('getPayload(') && file.startsWith('src/components/') && !expectedPayloadReads.has(file)) {
    fail(`unregistered direct Payload access from component: ${file}`)
  }
}

if (failures.length > 0) {
  throw new Error(`Architecture boundary checks failed:\n${failures.join('\n')}`)
}

console.log('architecture boundaries passed')
