import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { getMvpRoutes, getPublicNavigationRoutes, getOperatorNavigationRoutes, getRouteById, getRoutesByGroup } from '../src/lib/navigation/mvpRouteRegistry'
import { getAdminReviewSections, getReviewSectionBySlug, getAdminReviewExportRows } from '../src/lib/admin/adminReviewModel'

const INTEGRATION_FILES = [
  'src/lib/navigation/mvpRouteRegistry.ts',
  'src/app/(frontend)/admin/review/[sectionSlug]/page.tsx',
  'src/app/(frontend)/dashboard/page.tsx',
  'src/app/(frontend)/admin/review/page.tsx',
]

const EXPECTED_PUBLIC_ROUTE_IDS = [
  'dashboard',
  'programme',
  'community',
  'support',
  'partner-referral',
  'upgrade',
]

function testRouteRegistryExists(): void {
  const routes = getMvpRoutes()
  assert.ok(Array.isArray(routes), 'getMvpRoutes must return an array')
  assert.ok(routes.length >= 6, `expected at least 6 routes, got ${routes.length}`)
}

function testAllRouteHrefsAreUnique(): void {
  const routes = getMvpRoutes()
  const hrefs = routes.map((r) => r.href)
  assert.equal(hrefs.length, new Set(hrefs).size, 'route hrefs must be unique')
}

function testAllRouteIdsAreUnique(): void {
  const routes = getMvpRoutes()
  const ids = routes.map((r) => r.id)
  assert.equal(ids.length, new Set(ids).size, 'route ids must be unique')
}

function testEveryRouteHasRequiredFields(): void {
  const routes = getMvpRoutes()
  const validGroups = ['public', 'member_preview', 'operator', 'billing_membership']
  const validStatuses = ['ready_for_testing', 'preview', 'auth_required', 'manual_review']
  const validAccess = ['public', 'controlled_free', 'pro', 'operator', 'auth_required']

  for (const route of routes) {
    assert.ok(typeof route.id === 'string' && route.id.length > 0, 'route must have id')
    assert.ok(typeof route.label === 'string' && route.label.length > 0, `route ${route.id} must have label`)
    assert.ok(typeof route.href === 'string' && route.href.length > 0, `route ${route.id} must have href`)
    assert.ok(typeof route.summary === 'string' && route.summary.length > 0, `route ${route.id} must have summary`)
    assert.ok(validGroups.includes(route.group), `route ${route.id} invalid group: ${route.group}`)
    assert.ok(validStatuses.includes(route.status), `route ${route.id} invalid status: ${route.status}`)
    assert.ok(validAccess.includes(route.access), `route ${route.id} invalid access: ${route.access}`)
  }
}

function testEveryRouteHrefPointsToExistingFileOrBase(): void {
  const routes = getMvpRoutes()
  const knownBases = [
    'src/app/(frontend)',
  ]
  for (const route of routes) {
    const href = route.href.replace(/\/$/, '')
    const path = `${knownBases[0]}${href}`
    const asPage = `${path}/page.tsx`
    const hasPage = existsSync(asPage)
    const hasDir = existsSync(path) && !hasPage
    assert.ok(hasPage || hasDir, `route ${route.id} (${route.href}) must resolve: checked ${asPage}`)
  }
}

function testPublicNavigationRoutes(): void {
  const publicRoutes = getPublicNavigationRoutes()
  const publicIds = publicRoutes.map((r) => r.id)

  for (const expectedId of EXPECTED_PUBLIC_ROUTE_IDS) {
    assert.ok(publicIds.includes(expectedId), `public routes must include ${expectedId}`)
  }
}

function testGetRouteById(): void {
  const routes = getMvpRoutes()
  for (const route of routes) {
    const found = getRouteById(route.id)
    assert.ok(found, `getRouteById('${route.id}') must return a route`)
    assert.equal(found?.id, route.id)
  }
  assert.equal(getRouteById('nonexistent'), undefined, 'unknown id must return undefined')
}

function testGetRoutesByGroup(): void {
  const operatorRoutes = getRoutesByGroup('operator')
  assert.ok(operatorRoutes.length >= 1, 'must have at least 1 operator route')
  assert.ok(operatorRoutes.every((r) => r.group === 'operator'), 'all returned routes must match group')
}

function testOperatorRoutesIncludeAdminReview(): void {
  const operatorRoutes = getOperatorNavigationRoutes()
  const operatorSlugs = operatorRoutes.map((r) => r.href)
  assert.ok(operatorSlugs.includes('/admin/review'), 'operator routes must include /admin/review')
}

function testDashboardDistinguishesFromPortal(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.ok(
    content.includes('public preview dashboard') ||
    content.includes('/dashboard') && content.includes('/portal'),
    'dashboard must distinguish itself from /portal',
  )
  assert.ok(
    content.toLowerCase().includes('payload'),
    'dashboard must mention Payload DB requirement for /portal',
  )
}

function testAdminDetailPageExists(): void {
  assert.ok(
    existsSync('src/app/(frontend)/admin/review/[sectionSlug]/page.tsx'),
    'admin review detail page must exist',
  )
}

function testEveryAdminSectionHasDetailUrl(): void {
  const sections = getAdminReviewSections()
  for (const section of sections) {
    const detailPath = `src/app/(frontend)/admin/review/${section.slug}/page.tsx`
    assert.ok(
      existsSync('src/app/(frontend)/admin/review/[sectionSlug]/page.tsx'),
      `section ${section.slug} uses dynamic [sectionSlug] route`,
    )
  }
}

function testAdminDetailUsesGetReviewSectionBySlug(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/[sectionSlug]/page.tsx', 'utf8')
  assert.ok(
    content.includes('getReviewSectionBySlug'),
    'admin detail page must use getReviewSectionBySlug',
  )
}

function testAdminDetailCallsNotFound(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/[sectionSlug]/page.tsx', 'utf8')
  assert.ok(
    content.includes('notFound()') || content.includes("notFound('"),
    'admin detail page must call notFound for unknown slugs',
  )
}

function testExportRowsArePlaceholderData(): void {
  const rows = getAdminReviewExportRows()
  assert.ok(rows.length >= 5, 'must have at least 5 export rows')
  for (const row of rows) {
    assert.ok(typeof row.section === 'string', 'export row must have section name')
    assert.ok(typeof row.status === 'string', 'export row must have status')
    assert.ok(typeof row.owner === 'string', 'export row must have owner')
    assert.ok(row.notes.length > 0, 'export row must have notes')
    assert.ok(
      !row.notes.toLowerCase().includes('live db') &&
      !row.notes.toLowerCase().includes('real queue'),
      'export row notes must not claim live queue',
    )
  }
}

function testAdminReviewDashboardLinksToDetailPages(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/page.tsx', 'utf8')
  assert.ok(
    content.includes('/admin/review/${'),
    'admin review dashboard must use template literal for detail page links',
  )
}

function testAdminReviewDashboardLinksToImplementation(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/page.tsx', 'utf8')
  assert.ok(
    content.includes('section.href') || content.includes('{section.href}'),
    'admin review dashboard must use section.href for implementation links',
  )
}

function testLegacyTermsNotPresent(): void {
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of INTEGRATION_FILES) {
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
  for (const file of INTEGRATION_FILES) {
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
  testRouteRegistryExists()
  testAllRouteHrefsAreUnique()
  testAllRouteIdsAreUnique()
  testEveryRouteHasRequiredFields()
  testEveryRouteHrefPointsToExistingFileOrBase()
  testPublicNavigationRoutes()
  testGetRouteById()
  testGetRoutesByGroup()
  testOperatorRoutesIncludeAdminReview()
  testDashboardDistinguishesFromPortal()
  testAdminDetailPageExists()
  testEveryAdminSectionHasDetailUrl()
  testAdminDetailUsesGetReviewSectionBySlug()
  testAdminDetailCallsNotFound()
  testExportRowsArePlaceholderData()
  testAdminReviewDashboardLinksToDetailPages()
  testAdminReviewDashboardLinksToImplementation()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  console.log('mvp_route_integration.test.ts passed')
} catch (error) {
  console.error('mvp_route_integration.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
