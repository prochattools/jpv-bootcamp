import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const learnIndexSource = readFileSync('src/app/(frontend)/learn/page.tsx', 'utf8')
const learnAccountSource = readFileSync('src/app/(frontend)/learn/account/page.tsx', 'utf8')
const learnBillingSource = readFileSync('src/app/(frontend)/learn/billing/page.tsx', 'utf8')
const learnLoginSource = readFileSync('src/app/(frontend)/learn/login/page.tsx', 'utf8')
const portalPageSource = readFileSync('src/app/(frontend)/portal/page.tsx', 'utf8')
const portalSectionsSource = readFileSync('src/app/(frontend)/portal/[section]/page.tsx', 'utf8')

function assertNoLegacyRouteImports(source: string, path: string): void {
  for (const forbidden of [
    'getCurrentPayloadMember',
    'payloadCourse/memberPortal',
    'billingStatusHelper',
    'MemberCheckoutButtons',
    'BillingPortalButton',
    'PortalShell',
    'stripe',
    'Payload',
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${path} must not import or reference ${forbidden}`,
    )
  }
}

function testLegacyIndexRedirect(): void {
  assert.match(learnIndexSource, /import \{ redirect \} from 'next\/navigation'/)
  assert.match(learnIndexSource, /redirect\('\/portal'\)/)
}

function testLegacyAccountRedirect(): void {
  assert.match(learnAccountSource, /import \{ redirect \} from 'next\/navigation'/)
  assert.match(learnAccountSource, /new URLSearchParams\(\)/)
  assert.match(learnAccountSource, /updated/)
  assert.match(learnAccountSource, /error/)
  assert.match(learnAccountSource, /display-name/)
  assert.match(learnAccountSource, /\/portal\/account/)
  assert.match(learnAccountSource, /redirect\(destination\)/)
}

function testLegacyBillingRedirect(): void {
  assert.match(learnBillingSource, /import \{ redirect \} from 'next\/navigation'/)
  assert.match(learnBillingSource, /new URLSearchParams\(\)/)
  assert.match(learnBillingSource, /checkout/)
  assert.match(learnBillingSource, /cancellation_requested/)
  assert.match(learnBillingSource, /cancellation_effective_at/)
  assert.match(learnBillingSource, /cancellation_error/)
  assert.match(learnBillingSource, /\/portal\/billing/)
  assert.match(learnBillingSource, /redirect\(destination\)/)
}

function testLegacyLoginRedirect(): void {
  assert.match(learnLoginSource, /redirect\('\/portal\?mode=login'\)/)
}

function testCompatibilityRoutesAreLogicFree(): void {
  assertNoLegacyRouteImports(learnIndexSource, 'src/app/(frontend)/learn/page.tsx')
  assertNoLegacyRouteImports(learnAccountSource, 'src/app/(frontend)/learn/account/page.tsx')
  assertNoLegacyRouteImports(learnBillingSource, 'src/app/(frontend)/learn/billing/page.tsx')
  assertNoLegacyRouteImports(learnLoginSource, 'src/app/(frontend)/learn/login/page.tsx')
}

function testCompatibilityRoutesDoNotRenderUi(): void {
  for (const [path, source] of [
    ['src/app/(frontend)/learn/page.tsx', learnIndexSource],
    ['src/app/(frontend)/learn/account/page.tsx', learnAccountSource],
    ['src/app/(frontend)/learn/billing/page.tsx', learnBillingSource],
    ['src/app/(frontend)/learn/login/page.tsx', learnLoginSource],
  ] as const) {
    assert.doesNotMatch(source, /return\s*\(/, `${path} must not render JSX`)
    assert.doesNotMatch(source, /<main|<div|<section|<PortalShell/, `${path} must not contain legacy UI markup`)
  }
}

function testCanonicalPortalRoutesStillExist(): void {
  assert.match(portalPageSource, /requirePortalMember/)
  assert.match(portalSectionsSource, /section === 'account'/)
  assert.match(portalSectionsSource, /section === 'billing'/)
}

function testDeeperLearnRoutesRemainPresent(): void {
  for (const path of [
    'src/app/(frontend)/learn/[courseSlug]/page.tsx',
    'src/app/(frontend)/learn/[courseSlug]/[lessonSlug]/page.tsx',
    'src/app/(frontend)/learn/community/page.tsx',
    'src/app/(frontend)/learn/community/[spaceSlug]/page.tsx',
    'src/app/(frontend)/learn/community/[spaceSlug]/posts/[postId]/page.tsx',
    'src/app/(frontend)/learn/community/moderation/page.tsx',
    'src/app/(frontend)/learn/community/submissions/page.tsx',
    'src/app/(frontend)/learn/community/files/[fileId]/route.ts',
    'src/app/(frontend)/learn/resources/[resourceId]/route.ts',
  ]) {
    assert.ok(existsSync(path), `expected deeper learn route to remain active: ${path}`)
  }
}

try {
  testLegacyIndexRedirect()
  testLegacyAccountRedirect()
  testLegacyBillingRedirect()
  testLegacyLoginRedirect()
  testCompatibilityRoutesAreLogicFree()
  testCompatibilityRoutesDoNotRenderUi()
  testCanonicalPortalRoutesStillExist()
  testDeeperLearnRoutesRemainPresent()
  console.log('legacy_member_shell_redirects.test.ts passed')
} catch (error) {
  console.error('legacy_member_shell_redirects.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
