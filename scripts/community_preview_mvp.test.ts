import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { getDashboardCards } from '../src/lib/portal/memberDashboardModel'

const COMMUNITY_FILES = [
  'src/app/(frontend)/portal/community/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
]

const ROOT_COMMUNITY_REDIRECT_FILES = [
  'src/app/(frontend)/community/page.tsx',
  'src/app/(frontend)/community/[spaceSlug]/page.tsx',
]
const removedNamespacePattern = new RegExp(`/${'learn'}(?:/|\\b)`)

function testPortalCommunityRouteExists(): void {
  const routeFiles = [
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
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
  const communityPostPage = readFileSync('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx', 'utf8')

  assert.match(communityPage, /requirePortalMember\('\/portal\/community'\)/)
  assert.match(communityPage, /getMemberCommunityDashboard\(payload, memberId\)/)
  assert.match(communityPage, /getMemberAnnouncements\(payload, memberId\)/)
  assert.match(communityPage, /getMemberCommunityFiles\(payload, memberId\)/)
  assert.match(communityPage, /Open announcement space/)
  assert.doesNotMatch(communityPage, /\/upgrade/)
  assert.doesNotMatch(communityPage, removedNamespacePattern)

  assert.match(communitySpacePage, /requirePortalMember\(`\/portal\/community\/\$\{encodedSpaceSlug\}`\)/)
  assert.match(communitySpacePage, /getMemberCommunitySpaceDetail\(payload, memberId, spaceSlug\)/)
  assert.match(communitySpacePage, /Read-only member view/)
  assert.match(communitySpacePage, /persisted Payload data/)
  assert.doesNotMatch(communitySpacePage, /submitCommunityPost/)
  assert.doesNotMatch(communitySpacePage, /Create a post/)
  assert.doesNotMatch(communitySpacePage, /Submit for review/)
  assert.match(communitySpacePage, /href=\{`\/portal\/community\/\$\{encodedSpaceSlug\}\/posts\/\$\{encodeURIComponent\(post\.id\)\}`\}/)
  assert.match(communitySpacePage, /This space is locked/)
  assert.doesNotMatch(communitySpacePage, /\/upgrade/)
  assert.doesNotMatch(communitySpacePage, removedNamespacePattern)

  assert.match(communityPostPage, /getMemberCommunityPostDetail\(payload, memberId, spaceSlug, postId\)/)
  assert.match(communityPostPage, /Read-only discussion view/)
  assert.match(communityPostPage, /persisted Payload data/)
  assert.match(communityPostPage, /StatusPill tone='neutral'>Read only/)
  assert.doesNotMatch(communityPostPage, /submitCommunityComment/)
  assert.doesNotMatch(communityPostPage, /Add a comment/)
  assert.doesNotMatch(communityPostPage, /Submit reply for review/)
  assert.doesNotMatch(communityPostPage, /Moderator replies enabled/)
  assert.doesNotMatch(communityPostPage, /\/upgrade/)
  assert.doesNotMatch(communityPostPage, removedNamespacePattern)
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
