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

function testCommunityPageLinksToUpgrade(): void {
  const content = readFileSync('src/app/(frontend)/portal/community/page.tsx', 'utf8')
  assert.ok(content.includes('/upgrade'), 'community page must link to /upgrade')
}

function testCommunitySpacePageLinksToUpgrade(): void {
  const content = readFileSync('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx', 'utf8')
  assert.ok(content.includes('/upgrade'), 'community space page must link to /upgrade')
}

function testPageCopyIncludesPreviewWording(): void {
  const files = [
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  ]
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    assert.ok(
      content.toLowerCase().includes('preview'),
      `${file} must include preview wording`,
    )
  }
}

function testPageCopyDoesNotClaimLiveCutover(): void {
  const files = [
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  ]
  const liveClaims = [
    /live community (is|has been|now) (live|launched|complete|ready)/i,
    /community is now (live|open|active|available)/i,
    /full community (features|functionality).*(launched|complete|active)/i,
  ]
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const pattern of liveClaims) {
      assert.doesNotMatch(content, pattern, `${file} must not claim live cutover`)
    }
  }
}

function testCommunityPageDoesNotClaimLiveMessaging(): void {
  const files = [
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  ]
  const messagingClaims = [
    /send (messages|replies|comments)/i,
    /real.time (messaging|chat|notifications)/i,
    /live (chat|messaging|notifications)/i,
    /notification.*(digest|email|alert)/i,
  ]
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const pattern of messagingClaims) {
      assert.doesNotMatch(content, pattern, `${file} must not claim live messaging/notifications`)
    }
  }
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

function testNoDbNetworkOrMigrationCommands(): void {
  const allFiles = [...COMMUNITY_FILES, ...ROOT_COMMUNITY_REDIRECT_FILES]
  const forbidden = ['prisma.', 'payload.', 'fetch(', 'axios', 'https.request', '.env', 'DATABASE_URL']
  for (const file of allFiles) {
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

try {
  testModelExists()
  testAtLeastThreeSpaces()
  testEverySpaceHasRequiredFields()
  testPublicSafeSummaryExists()
  testGetSpaceBySlug()
  testPortalCommunityRouteExists()
  testRootCommunityRoutesAreRedirects()
  testDashboardLinksToPortalCommunity()
  testCommunityPageLinksToUpgrade()
  testCommunitySpacePageLinksToUpgrade()
  testPageCopyIncludesPreviewWording()
  testPageCopyDoesNotClaimLiveCutover()
  testCommunityPageDoesNotClaimLiveMessaging()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  console.log('community_preview_mvp.test.ts passed')
} catch (error) {
  console.error('community_preview_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
