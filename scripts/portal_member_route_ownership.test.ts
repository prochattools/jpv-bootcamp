import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const FILES = {
  portalPage: 'src/app/(frontend)/portal/page.tsx',
  portalLayout: 'src/app/(frontend)/portal/layout.tsx',
  accountBilling: 'src/app/(frontend)/portal/[section]/page.tsx',
  courseIndex: 'src/app/(frontend)/portal/courses/page.tsx',
  courseDetail: 'src/app/(frontend)/portal/courses/[courseSlug]/page.tsx',
  lessonDetail: 'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx',
  communityIndex: 'src/app/(frontend)/portal/community/page.tsx',
  communitySpace: 'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  communityPost: 'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  communityModeration: 'src/app/(frontend)/portal/community/moderation/page.tsx',
  communitySubmissions: 'src/app/(frontend)/portal/community/submissions/page.tsx',
  lessonResourcesRoute: 'src/app/(frontend)/portal/resources/[resourceId]/route.ts',
  communityFilesRoute: 'src/app/(frontend)/portal/community/files/[fileId]/route.ts',
  communityActions: 'src/app/(frontend)/portal/community/actions.ts',
} as const

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

const removedNamespacePattern = new RegExp(`['"\`]/${'learn'}(?:/|\\b)`)
const removedImportPattern = new RegExp(`from .+${'learn'}/`)

function testRouteFilesExist(): void {
  for (const path of Object.values(FILES)) {
    assert.ok(existsSync(path), `expected canonical route or helper file: ${path}`)
  }
}

function testCanonicalPortalOwnership(): void {
  assert.match(source(FILES.portalPage), /requirePortalMember/)
  assert.match(source(FILES.courseIndex), /requirePortalMember\('\/portal\/courses'\)/)
  assert.match(source(FILES.courseDetail), /requirePortalMember\(requestedPath\)/)
  assert.match(source(FILES.lessonDetail), /requirePortalMember\(requestedPath\)/)
  assert.match(source(FILES.lessonDetail), /markMemberLessonComplete/)
  assert.match(source(FILES.communityIndex), /requirePortalMember\('\/portal\/community'\)/)
  assert.match(source(FILES.communitySpace), /requirePortalMember\(`\/portal\/community\/\$\{encodedSpaceSlug\}`\)/)
  assert.match(source(FILES.communityPost), /requirePortalMember\(/)
  assert.match(source(FILES.communityModeration), /requirePortalMember\('\/portal\/community\/moderation'\)/)
  assert.match(source(FILES.communitySubmissions), /requirePortalMember\('\/portal\/community\/submissions'\)/)
}

function testCanonicalRoutesUsePortalUrlsOnly(): void {
  for (const path of [
    FILES.courseIndex,
    FILES.courseDetail,
    FILES.lessonDetail,
    FILES.communityIndex,
    FILES.communitySpace,
    FILES.communityPost,
    FILES.communityModeration,
    FILES.communitySubmissions,
    FILES.communityActions,
  ]) {
    const content = source(path)
    assert.doesNotMatch(content, removedNamespacePattern, `${path} must not target the removed member namespace`)
    assert.doesNotMatch(content, removedImportPattern, `${path} must not import from the removed member namespace`)
  }
}

function testProtectedFileRoutesAreCanonical(): void {
  const lessonResources = source(FILES.lessonResourcesRoute)
  const communityFiles = source(FILES.communityFilesRoute)

  for (const content of [lessonResources, communityFiles]) {
    assert.match(content, /runtime = 'nodejs'/)
    assert.match(content, /dynamic = 'force-dynamic'/)
    assert.match(content, /Cache-Control': 'private, no-store'/)
    assert.match(content, /X-Content-Type-Options': 'nosniff'/)
    assert.match(content, /notFoundResponse/)
    assert.doesNotMatch(content, /status:\s*401|status:\s*403|Unauthorized|Forbidden/)
  }
}

function testPortalLayoutOwnsMemberNavigation(): void {
  const layout = source(FILES.portalLayout)
  assert.match(layout, /\/portal\/programme/)
  assert.match(layout, /\/portal\/courses/)
  assert.match(layout, /\/portal\/community/)
  assert.match(layout, /\/portal\/account/)
  assert.match(layout, /\/portal\/billing/)
  assert.doesNotMatch(layout, /\/portal\/groups/)
  assert.doesNotMatch(layout, removedNamespacePattern)
}

try {
  testRouteFilesExist()
  testCanonicalPortalOwnership()
  testCanonicalRoutesUsePortalUrlsOnly()
  testProtectedFileRoutesAreCanonical()
  testPortalLayoutOwnsMemberNavigation()
  console.log('portal_member_route_ownership.test.ts passed')
} catch (error) {
  console.error(
    'portal_member_route_ownership.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
