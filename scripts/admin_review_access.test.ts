import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { isPayloadAdminIdentity } from '../src/lib/admin/currentAdmin'
import {
  getOperatorNavigationRoutes,
  getPublicNavigationRoutes,
} from '../src/lib/navigation/mvpRouteRegistry'

const ADMIN_ROUTE_FILES = [
  {
    path: 'src/app/(frontend)/admin/review/page.tsx',
    firstProtectedRead: 'const sections = getAdminReviewSections()',
  },
  {
    path: 'src/app/(frontend)/admin/review/[sectionSlug]/page.tsx',
    firstProtectedRead: 'const { sectionSlug } = await params',
  },
]

function testAnonymousIdentityIsDenied(): void {
  assert.equal(isPayloadAdminIdentity(null), false)
  assert.equal(isPayloadAdminIdentity(undefined), false)
}

function testMemberIdentityIsDenied(): void {
  assert.equal(
    isPayloadAdminIdentity({ id: 'member-1', collection: 'payload_members' }),
    false,
  )
}

function testPayloadAdministratorIdentityIsAllowed(): void {
  assert.equal(
    isPayloadAdminIdentity({ id: 'admin-1', collection: 'payload_users' }),
    true,
  )
}

function testMalformedAdministratorIdentityIsDenied(): void {
  assert.equal(isPayloadAdminIdentity({ collection: 'payload_users' }), false)
  assert.equal(isPayloadAdminIdentity({ id: '', collection: 'payload_users' }), false)
}

function testEveryAdminReviewPageRequiresAdminBeforeReadingRouteData(): void {
  for (const route of ADMIN_ROUTE_FILES) {
    const content = readFileSync(route.path, 'utf8')
    const guardCall = 'await requireCurrentPayloadAdmin()'
    const guardIndex = content.indexOf(guardCall)
    const protectedReadIndex = content.indexOf(route.firstProtectedRead)

    assert.ok(
      content.includes("import { requireCurrentPayloadAdmin } from '@/lib/admin/currentAdmin'"),
      `${route.path} must import the Payload administrator guard`,
    )
    assert.ok(guardIndex >= 0, `${route.path} must await the Payload administrator guard`)
    assert.ok(
      protectedReadIndex > guardIndex,
      `${route.path} must authenticate before reading review route data`,
    )
  }
}

function testAdminReviewIsNotPublicNavigation(): void {
  const publicHrefs = getPublicNavigationRoutes().map((route) => route.href)
  assert.equal(publicHrefs.includes('/admin/review'), false)
}

function testAdminReviewRemainsOperatorNavigation(): void {
  const operatorHrefs = getOperatorNavigationRoutes().map((route) => route.href)
  assert.equal(operatorHrefs.includes('/admin/review'), true)
}

try {
  testAnonymousIdentityIsDenied()
  testMemberIdentityIsDenied()
  testPayloadAdministratorIdentityIsAllowed()
  testMalformedAdministratorIdentityIsDenied()
  testEveryAdminReviewPageRequiresAdminBeforeReadingRouteData()
  testAdminReviewIsNotPublicNavigation()
  testAdminReviewRemainsOperatorNavigation()
  console.log('admin_review_access.test.ts passed')
} catch (error) {
  console.error(
    'admin_review_access.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
