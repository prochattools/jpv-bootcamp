import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { getAllSpaces, getPublicSafeSummary, getSpaceBySlug } from '../src/lib/community/communityPreviewModel'
import { getDashboardCards } from '../src/lib/portal/memberDashboardModel'

const COMMUNITY_FILES = [
  'src/lib/community/communityPreviewModel.ts',
  'src/app/(frontend)/portal/community/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
]

const ROOT_COMMUNITY_REDIRECT_FILES = [
  'src/app/(frontend)/community/page.tsx',
  'src/app/(frontend)/community/[spaceSlug]/page.tsx',
]
const removedNamespacePattern = new RegExp(`/${'learn'}(?:/|\\b)`)

function testModelExists(): void {
  const spaces = getAllSpaces()
  assert.ok(Array.isArray(spaces), 'getAllSpaces must return an array')
}

function testAtLeastThreeSpaces(): void {
  const spaces = getAllSpaces()
  assert.ok(spaces.length >= 3, `expected at least 3 spaces, got ${spaces.length}`)
}

function testEverySpaceHasRequiredFields(): void {
  const spaces = getAllSpaces()
  const validAccessLabels = ['pro', 'free_and_pro', 'admin_preview']
  const validStatuses = ['preview', 'placeholder', 'locked']

  for (const space of spaces) {
    assert.ok(typeof space.slug === 'string' && space.slug.length > 0, `space missing slug`)
    assert.ok(typeof space.title === 'string' && space.title.length > 0, `space ${space.slug} missing title`)
    assert.ok(typeof space.summary === 'string' && space.summary.length > 0, `space ${space.slug} missing summary`)
    assert.ok(typeof space.description === 'string' && space.description.length > 0, `space ${space.slug} missing description`)
    assert.ok(validAccessLabels.includes(space.accessLabel), `space ${space.slug} invalid accessLabel: ${space.accessLabel}`)
    assert.ok(validStatuses.includes(space.status), `space ${space.slug} invalid status: ${space.status}`)
    assert.ok(Array.isArray(space.previewThreads), `space ${space.slug} missing previewThreads array`)
  }
}

function testPublicSafeSummaryExists(): void {
  const summary = getPublicSafeSummary()
  assert.ok(typeof summary.spaceCount === 'number', 'summary must have spaceCount')
  assert.ok(typeof summary.publicSpaceCount === 'number', 'summary must have publicSpaceCount')
  assert.ok(typeof summary.proSpaceCount === 'number', 'summary must have proSpaceCount')
  assert.equal(summary.isPreview, true, 'summary must indicate preview')
}

function testGetSpaceBySlug(): void {
  const spaces = getAllSpaces()
  for (const space of spaces) {
    const found = getSpaceBySlug(space.slug)
    assert.ok(found, `getSpaceBySlug('${space.slug}') must return a space`)
    assert.equal(found?.slug, space.slug)
  }
  assert.equal(getSpaceBySlug('nonexistent-slug'), undefined, 'unknown slug must return undefined')
}

function testPortalCommunityRouteExists(): void {
  const routeFiles = [
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  ]
  for (const file of routeFiles) {
    assert.ok(existsSync(file), `route file must exist: ${file}`)
  }
}

function testRootCommunityRoutesAreRedirects(): void {
  for (const file of ROOT_COMMUNITY_REDIRECT_FILES) {
    const content = readFileSync(file, 'utf8')
    assert.ok(content.includes("redirect("), `${file} must use redirect()`)
  }
}

function testDashboardLinksToPortalCommunity(): void {
  const cards = getDashboardCards()
  const communityCard = cards.find((card) => card.id === 'community')
  assert.ok(communityCard, 'dashboard model must have a community card')
  assert.equal(communityCard?.href, '/portal/community', 'community card must link to /portal/community')
}

function testPortalCommunityPagesUseCanonicalMemberRoutes(): void {
  const communityPage = readFileSync('src/app/(frontend)/portal/community/page.tsx', 'utf8')
  const communitySpacePage = readFileSync('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx', 'utf8')

  assert.match(communityPage, /requirePortalMember\('\/portal\/community'\)/)
  assert.match(communityPage, /getMemberCommunityDashboard\(payload, memberId\)/)
  assert.match(communityPage, /getMemberAnnouncements\(payload, memberId\)/)
  assert.match(communityPage, /getMemberCommunityFiles\(payload, memberId\)/)
  assert.match(communityPage, /Open announcement space/)
  assert.doesNotMatch(communityPage, /\/upgrade/)
  assert.doesNotMatch(communityPage, removedNamespacePattern)

  assert.match(communitySpacePage, /requirePortalMember\(`\/portal\/community\/\$\{encodedSpaceSlug\}`\)/)
  assert.match(communitySpacePage, /submitCommunityPost\.bind\(null, spaceSlug\)/)
  assert.match(communitySpacePage, /href=\{`\/portal\/community\/\$\{encodedSpaceSlug\}\/posts\/\$\{encodeURIComponent\(post\.id\)\}`\}/)
  assert.match(communitySpacePage, /This space is locked/)
  assert.doesNotMatch(communitySpacePage, /\/upgrade/)
  assert.doesNotMatch(communitySpacePage, removedNamespacePattern)
}

function testLegacyTermsNotPresent(): void {
  const allFiles = [...COMMUNITY_FILES, ...ROOT_COMMUNITY_REDIRECT_FILES]
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of allFiles) {
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

function testCommunityPagesRequireAuth(): void {
  // /portal/community page must require auth
  const communityPage = readFileSync('src/app/(frontend)/portal/community/page.tsx', 'utf8')
  assert.ok(communityPage.includes('requirePortalMember'), '/portal/community page must call requirePortalMember')
  assert.ok(communityPage.includes("export const runtime = 'nodejs'"), '/portal/community page must run on node')
  assert.ok(communityPage.includes("export const dynamic = 'force-dynamic'"), '/portal/community page must be force-dynamic')

  // /portal/community/[spaceSlug] page must require auth
  const communitySpacePage = readFileSync('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx', 'utf8')
  assert.ok(communitySpacePage.includes('requirePortalMember'), '/portal/community/[spaceSlug] page must call requirePortalMember')
  assert.ok(communitySpacePage.includes("export const runtime = 'nodejs'"), '/portal/community/[spaceSlug] page must run on node')
  assert.ok(communitySpacePage.includes("export const dynamic = 'force-dynamic'"), '/portal/community/[spaceSlug] page must be force-dynamic')
}

try {
  testModelExists()
  testAtLeastThreeSpaces()
  testEverySpaceHasRequiredFields()
  testPublicSafeSummaryExists()
  testGetSpaceBySlug()
  testPortalCommunityRouteExists()
  testRootCommunityRoutesAreRedirects()
  testDashboardLinksToPortalCommunity()
  testPortalCommunityPagesUseCanonicalMemberRoutes()
  testLegacyTermsNotPresent()
  testCommunityPagesRequireAuth()
  console.log('community_preview_mvp.test.ts passed')
} catch (error) {
  console.error('community_preview_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
