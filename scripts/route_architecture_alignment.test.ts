import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { getCanonicalRoutes, getCompatibilityRedirects } from '../src/lib/navigation/mvpRouteRegistry'
import { getDashboardCards } from '../src/lib/portal/memberDashboardModel'
import { getAdminReviewSections } from '../src/lib/admin/adminReviewModel'

const ALIGNMENT_FILES = [
  'src/lib/navigation/mvpRouteRegistry.ts',
  'src/lib/portal/memberDashboardModel.ts',
  'src/lib/admin/adminReviewModel.ts',
  'src/app/(frontend)/dashboard/page.tsx',
  'src/app/(frontend)/programme/page.tsx',
  'src/app/(frontend)/community/page.tsx',
  'src/app/(frontend)/support/page.tsx',
  'src/app/(frontend)/partner-referral/page.tsx',
  'src/app/(frontend)/portal/programme/page.tsx',
  'src/app/(frontend)/portal/community/page.tsx',
  'src/app/(frontend)/portal/support/page.tsx',
  'src/app/(frontend)/portal/partner-referral/page.tsx',
]

const CANONICAL_PORTAL_SUBROUTES = [
  'src/app/(frontend)/portal/programme/page.tsx',
  'src/app/(frontend)/portal/community/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  'src/app/(frontend)/portal/support/page.tsx',
  'src/app/(frontend)/portal/partner-referral/page.tsx',
]

function testDocumentedArchitecture(): void {
  const plan = readFileSync('docs/PAYLOAD_INTEGRATION_PLAN.md', 'utf8')
  assert.ok(plan.includes('/admin'), 'architecture doc must reference /admin')
  assert.ok(plan.includes('/portal'), 'architecture doc must reference /portal')
  assert.ok(plan.includes('Administrator back office'), 'architecture doc must mention admin back office')
  assert.ok(plan.includes('Member/student portal'), 'architecture doc must mention member portal')
}

function testPortalPageExists(): void {
  assert.ok(existsSync('src/app/(frontend)/portal/page.tsx'), '/portal page.tsx must exist')
}

function testCanonicalPortalSubroutesExist(): void {
  for (const route of CANONICAL_PORTAL_SUBROUTES) {
    assert.ok(existsSync(route), `canonical portal subroute must exist: ${route}`)
  }
}

function testRootRoutesAreRedirects(): void {
  const redirectTargets = ['/portal', '/portal/programme', '/portal/community', '/portal/support', '/portal/partner-referral']
  const rootRoutes = [
    'src/app/(frontend)/dashboard/page.tsx',
    'src/app/(frontend)/programme/page.tsx',
    'src/app/(frontend)/community/page.tsx',
    'src/app/(frontend)/support/page.tsx',
    'src/app/(frontend)/partner-referral/page.tsx',
  ]
  for (const route of rootRoutes) {
    const content = readFileSync(route, 'utf8')
    assert.ok(
      content.includes("redirect("),
      `${route} must use redirect() for compatibility`,
    )
    const hasAnyTarget = redirectTargets.some((target) => content.includes(target))
    assert.ok(hasAnyTarget, `${route} must redirect to a canonical portal route`)
  }
}

function testCommunitySpaceSlugIsRedirect(): void {
  const content = readFileSync('src/app/(frontend)/community/[spaceSlug]/page.tsx', 'utf8')
  assert.ok(content.includes("redirect("), 'community/[spaceSlug] must use redirect()')
  assert.ok(content.includes('/portal/community/'), 'community/[spaceSlug] must redirect to /portal/community/')
}

function testDashboardModelLinksToCanonicalPortalRoutes(): void {
  const cards = getDashboardCards()
  for (const card of cards) {
    assert.ok(
      card.href.startsWith('/portal/') || card.href === '/portal' || card.href.startsWith('/admin/'),
      `dashboard card "${card.id}" must link to canonical portal route, got: ${card.href}`,
    )
  }
  const programmeCard = cards.find((c) => c.id === 'programme')
  assert.equal(programmeCard?.href, '/portal/programme', 'programme card must link to /portal/programme')

  const communityCard = cards.find((c) => c.id === 'community')
  assert.equal(communityCard?.href, '/portal/community', 'community card must link to /portal/community')

  const supportCard = cards.find((c) => c.id === 'support')
  assert.equal(supportCard?.href, '/portal/support', 'support card must link to /portal/support')

  const partnerCard = cards.find((c) => c.id === 'partner-referral')
  assert.equal(partnerCard?.href, '/portal/partner-referral', 'partner-referral card must link to /portal/partner-referral')
}

function testAdminReviewModelLinksToCanonicalRoutes(): void {
  const sections = getAdminReviewSections()
  const sectionMap = new Map(sections.map((s) => [s.slug, s]))

  const partnerSection = sectionMap.get('partner-referrals')
  assert.equal(partnerSection?.href, '/portal/partner-referral', 'partner-referrals section must link to /portal/partner-referral')

  const supportSection = sectionMap.get('support-pay-it-forward')
  assert.equal(supportSection?.href, '/portal/support', 'support section must link to /portal/support')

  const programmeSection = sectionMap.get('programme')
  assert.equal(programmeSection?.href, '/portal/programme', 'programme section must link to /portal/programme')

  const communitySection = sectionMap.get('community')
  assert.equal(communitySection?.href, '/portal/community', 'community section must link to /portal/community')
}

function testRouteRegistryMarksCanonicalVsCompatibility(): void {
  const canonical = getCanonicalRoutes()
  const compatibility = getCompatibilityRedirects()

  assert.ok(canonical.length >= 6, `expected at least 6 canonical routes, got ${canonical.length}`)
  assert.ok(compatibility.length >= 3, `expected at least 3 compatibility redirects, got ${compatibility.length}`)

  const canonicalHrefs = canonical.map((r) => r.href)
  assert.ok(canonicalHrefs.includes('/portal'), 'canonical routes must include /portal')
  assert.ok(canonicalHrefs.includes('/portal/programme'), 'canonical routes must include /portal/programme')
  assert.ok(canonicalHrefs.includes('/portal/community'), 'canonical routes must include /portal/community')
  assert.ok(canonicalHrefs.includes('/portal/support'), 'canonical routes must include /portal/support')
  assert.ok(canonicalHrefs.includes('/portal/partner-referral'), 'canonical routes must include /portal/partner-referral')

  for (const route of compatibility) {
    assert.equal(route.kind, 'compatibility_redirect')
    assert.ok(typeof route.canonicalHref === 'string', `compatibility route ${route.id} must have canonicalHref`)
  }
}

function testNoRootMvpRoutesAsCanonical(): void {
  const canonicalHrefs = getCanonicalRoutes().map((r) => r.href)
  const rootOnlyHrefs = ['/dashboard', '/programme', '/community', '/support', '/partner-referral']
  for (const href of rootOnlyHrefs) {
    assert.ok(!canonicalHrefs.includes(href), `root route ${href} must not be canonical`)
  }
}

function testLegacyTermsNotPresent(): void {
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of ALIGNMENT_FILES) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const term of legacyTerms) {
      if (term === 'old portal') {
        if (content.toLowerCase().includes('old portal')) continue
        if (content.toLowerCase().includes('old-portal')) continue
      }
      assert.doesNotMatch(
        content,
        new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        `${file} must not contain legacy term: ${term}`,
      )
    }
  }
}

function testNoDbNetworkOrMigrationCommands(): void {
  const forbidden = ['prisma.', 'payload.', 'fetch(', 'axios', 'https.request', '.env', 'DATABASE_URL']
  for (const file of ALIGNMENT_FILES) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${file} must not contain: ${pattern}`,
      )
    }
  }
}

function testAuthRequiredForProgrammeAndCommunity(): void {
  // /portal/programme requires auth
  const programmePage = readFileSync('src/app/(frontend)/portal/programme/page.tsx', 'utf8')
  assert.ok(programmePage.includes('requirePortalMember'), '/portal/programme must import requirePortalMember')
  assert.ok(programmePage.includes("'/portal/programme'"), '/portal/programme must require auth for /portal/programme path')

  // /portal/community requires auth
  const communityPage = readFileSync('src/app/(frontend)/portal/community/page.tsx', 'utf8')
  assert.ok(communityPage.includes('requirePortalMember'), '/portal/community must import requirePortalMember')
  assert.ok(communityPage.includes("'/portal/community'"), '/portal/community must require auth for /portal/community path')

  // /portal/community/[spaceSlug] requires auth
  const communitySpacePage = readFileSync('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx', 'utf8')
  assert.ok(communitySpacePage.includes('requirePortalMember'), '/portal/community/[spaceSlug] must import requirePortalMember')
  assert.ok(communitySpacePage.includes('/portal/community/'), '/portal/community/[spaceSlug] must require auth for portal/community path')
}

function testSupportAndPartnerReferralRemainPublicIntake(): void {
  // Support page should be public and clearly marked as intake form
  const supportPage = readFileSync('src/app/(frontend)/portal/support/page.tsx', 'utf8')
  assert.ok(!supportPage.includes('requirePortalMember'), '/portal/support must remain public intake')
  assert.ok(supportPage.includes('Support') || supportPage.includes('support'), '/portal/support must mention support')
  assert.ok(supportPage.includes('Free access'), '/portal/support must mention Free access')

  // Partner referral page should be public and clearly marked as intake form
  const partnerPage = readFileSync('src/app/(frontend)/portal/partner-referral/page.tsx', 'utf8')
  assert.ok(!partnerPage.includes('requirePortalMember'), '/portal/partner-referral must remain public intake')
  assert.ok(partnerPage.includes('Partner'), '/portal/partner-referral must mention partner')
}

function testRouteRegistryAuthAlignment(): void {
  const canonical = getCanonicalRoutes()
  const programmeRoute = canonical.find((r) => r.id === 'portal-programme')
  assert.ok(programmeRoute, 'route registry must include portal-programme')
  assert.equal(programmeRoute?.access, 'auth_required', 'portal-programme must be auth_required in registry')
  assert.equal(programmeRoute?.group, 'member_preview', 'portal-programme must be in member_preview group')

  const communityRoute = canonical.find((r) => r.id === 'portal-community')
  assert.ok(communityRoute, 'route registry must include portal-community')
  assert.equal(communityRoute?.access, 'auth_required', 'portal-community must be auth_required in registry')
  assert.equal(communityRoute?.group, 'member_preview', 'portal-community must be in member_preview group')

  const supportRoute = canonical.find((r) => r.id === 'portal-support')
  assert.ok(supportRoute, 'route registry must include portal-support')
  assert.equal(supportRoute?.access, 'public', 'portal-support must be public in registry')

  const partnerRoute = canonical.find((r) => r.id === 'portal-partner-referral')
  assert.ok(partnerRoute, 'route registry must include portal-partner-referral')
  assert.equal(partnerRoute?.access, 'public', 'portal-partner-referral must be public in registry')
}

try {
  testDocumentedArchitecture()
  testPortalPageExists()
  testCanonicalPortalSubroutesExist()
  testRootRoutesAreRedirects()
  testCommunitySpaceSlugIsRedirect()
  testDashboardModelLinksToCanonicalPortalRoutes()
  testAdminReviewModelLinksToCanonicalRoutes()
  testRouteRegistryMarksCanonicalVsCompatibility()
  testNoRootMvpRoutesAsCanonical()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  testAuthRequiredForProgrammeAndCommunity()
  testSupportAndPartnerReferralRemainPublicIntake()
  testRouteRegistryAuthAlignment()
  console.log('route_architecture_alignment.test.ts passed')
} catch (error) {
  console.error('route_architecture_alignment.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
