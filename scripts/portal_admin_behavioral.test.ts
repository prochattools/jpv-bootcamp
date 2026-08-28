/**
 * portal_admin_behavioral.test.ts
 *
 * Source-level behavioral contract verification for the portal admin implementation.
 * Reads source files with readFileSync and checks patterns via regex/string search.
 * These are NOT runtime or integration tests — they verify that source-code structure
 * encodes the required contracts (ownership validation, space verification, audit
 * event calls, access control patterns, etc.) without executing the application.
 *
 * Run: pnpm exec tsx scripts/portal_admin_behavioral.test.ts
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

function source(rel: string): string {
  return readFileSync(path.resolve(ROOT, rel), 'utf8')
}

// ---------------------------------------------------------------------------
// Test 1 — Page-local inline server actions removed
// ---------------------------------------------------------------------------
function testNoInlineServerActions() {
  const postPage = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.doesNotMatch(
    postPage,
    /'use server'/,
    'post page must not contain inline server actions',
  )
}

// ---------------------------------------------------------------------------
// Test 2 — PostModerationPanel wired with spaceId verification
// ---------------------------------------------------------------------------
function testPostModerationWired() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.match(src, /PostModerationPanel/, 'post page must use PostModerationPanel')
  assert.match(src, /spaceId=\{/, 'PostModerationPanel must receive spaceId prop')
}

// ---------------------------------------------------------------------------
// Test 3 — CommentModerationActions wired for admin comments
// ---------------------------------------------------------------------------
function testCommentModerationWired() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.match(
    src,
    /CommentModerationActions/,
    'post page must use CommentModerationActions',
  )
  assert.match(
    src,
    /commentId=\{comment\.id\}/,
    'CommentModerationActions must receive commentId prop',
  )
}

// ---------------------------------------------------------------------------
// Test 4 — CourseAdminPanel wired with full course data
// ---------------------------------------------------------------------------
function testCourseAdminPanelWired() {
  const src = source('src/app/(frontend)/portal/courses/[courseSlug]/page.tsx')
  assert.match(src, /CourseAdminPanel/, 'course page must use CourseAdminPanel')
  assert.match(src, /courseId=\{course\.id\}/, 'CourseAdminPanel must receive courseId')
  assert.match(src, /modules=\{/, 'CourseAdminPanel must receive modules prop')
  assert.match(src, /status=\{course\.status\}/, 'CourseAdminPanel must receive status prop')
}

// ---------------------------------------------------------------------------
// Test 5 — SpaceAdminPanel wired on community index
// ---------------------------------------------------------------------------
function testSpaceAdminPanelWired() {
  const src = source('src/app/(frontend)/portal/community/page.tsx')
  assert.match(src, /SpaceAdminPanel/, 'community page must use SpaceAdminPanel')
  assert.match(src, /AdminGate/, 'SpaceAdminPanel must be inside AdminGate')
}

// ---------------------------------------------------------------------------
// Test 6 — Reorder actions validate ownership
// ---------------------------------------------------------------------------
function testReorderValidatesOwnership() {
  const moduleCommands = source('src/lib/courseAdmin/moduleCommands.ts')
  const lessonCommands = source('src/lib/courseAdmin/lessonCommands.ts')
  const persistence = source('src/lib/courseAdmin/persistence.ts')

  // The module command must fetch modules for the course and compare the exact ID set.
  const reorderModules = moduleCommands.slice(moduleCommands.indexOf('reorderModulesCommand'))
  assert.match(
    reorderModules,
    /findModulesForCourse/,
    'reorderModulesCommand must fetch modules by course',
  )
  assert.match(reorderModules, /new Set/, 'reorderModulesCommand must build ID set for validation')

  // The lesson command must fetch lessons for the module and compare the exact ID set.
  const reorderLessons = lessonCommands.slice(lessonCommands.indexOf('reorderLessonsCommand'))
  assert.match(
    reorderLessons,
    /findLessonsForModule/,
    'reorderLessonsCommand must fetch lessons by module',
  )
  assert.match(reorderLessons, /new Set/, 'reorderLessonsCommand must build ID set for validation')
  assert.match(persistence, /course: \{ equals: courseId \}/, 'course persistence must scope modules to the course')
  assert.match(persistence, /module: \{ equals: moduleId \}/, 'course persistence must scope lessons to the module')
}

// ---------------------------------------------------------------------------
// Test 7 — Community actions have non-optional expectedSpaceId
// ---------------------------------------------------------------------------
function testSpaceVerificationParameter() {
  const src = source('src/lib/portalAdmin/communityAdminActions.ts')
  const postActions = [
    'adminPinPostAction',
    'adminUnpinPostAction',
    'adminLockPostAction',
    'adminUnlockPostAction',
    'adminHidePostAction',
    'adminUnhidePostAction',
    'adminDeletePostAction',
  ]
  for (const action of postActions) {
    const idx = src.indexOf(`function ${action}`)
    assert.ok(idx !== -1, `${action} must exist in communityAdminActions.ts`)
    const fnDef = src.slice(idx, idx + 200)
    assert.match(fnDef, /expectedSpaceId/, `${action} must accept expectedSpaceId parameter`)
    // Must be non-optional (colon, not question-mark-colon)
    assert.match(
      fnDef,
      /expectedSpaceId:\s*string/,
      `${action} must have expectedSpaceId: string (non-optional)`,
    )
    assert.doesNotMatch(
      fnDef,
      /expectedSpaceId\?:/,
      `${action} must not have expectedSpaceId?: (optional) — must be required`,
    )
  }

  // Comment actions must also have non-optional expectedPostId and expectedSpaceId
  const commentActions = [
    'adminEditCommentAction',
    'adminDeleteCommentAction',
    'adminHideCommentAction',
    'adminUnhideCommentAction',
  ]
  for (const action of commentActions) {
    const idx = src.indexOf(`function ${action}`)
    assert.ok(idx !== -1, `${action} must exist in communityAdminActions.ts`)
    const fnDef = src.slice(idx, idx + 300)
    assert.match(
      fnDef,
      /expectedPostId:\s*string/,
      `${action} must have expectedPostId: string (non-optional)`,
    )
    assert.doesNotMatch(
      fnDef,
      /expectedPostId\?:/,
      `${action} must not have expectedPostId?: (optional) — must be required`,
    )
    assert.match(
      fnDef,
      /expectedSpaceId:\s*string/,
      `${action} must have expectedSpaceId: string (non-optional)`,
    )
    assert.doesNotMatch(
      fnDef,
      /expectedSpaceId\?:/,
      `${action} must not have expectedSpaceId?: (optional) — must be required`,
    )
  }
}

// ---------------------------------------------------------------------------
// Test 8 — Space verification is centralized in the shared boundary
// ---------------------------------------------------------------------------
function testSpaceVerificationEnforced() {
  const src = source('src/lib/portalAdmin/communityAdminActions.ts')
  const domain = source('src/lib/community/persistence.ts')
  assert.match(
    domain,
    /Post does not belong to the specified space/,
    'shared community persistence must return a descriptive space error',
  )
  assert.match(src, /moderateCommunityPostCommand/)
  const matches = domain.match(/Post does not belong to the specified space/g)
  assert.ok(
    matches && matches.length === 1,
    `space check must have one shared implementation (found ${matches?.length ?? 0})`,
  )
}

// ---------------------------------------------------------------------------
// Test 9 — Admin actions don't create fake member data
// ---------------------------------------------------------------------------
function testNoSyntheticMemberCreation() {
  const courseActions = source('src/lib/portalAdmin/courseAdminActions.ts')
  const communityActions = source('src/lib/portalAdmin/communityAdminActions.ts')
  assert.doesNotMatch(
    courseActions,
    /create\(\{[^}]*collection:\s*['"]payload_members['"]/,
    'course actions must not create member records',
  )
  assert.doesNotMatch(
    communityActions,
    /create\(\{[^}]*collection:\s*['"]payload_members['"]/,
    'community actions must not create member records',
  )
}

// ---------------------------------------------------------------------------
// Test 10 — Admin bypass resolves real author names
// ---------------------------------------------------------------------------
function testNoPlaceholderAuthors() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.doesNotMatch(
    src,
    /authorName:\s*'Post author'/,
    'admin bypass must not use placeholder post author',
  )
  assert.doesNotMatch(
    src,
    /authorName:\s*'Member'/,
    'admin bypass must not use placeholder comment author',
  )
  assert.match(
    src,
    /payload_members/,
    'admin bypass must resolve authors from payload_members',
  )
}

// ---------------------------------------------------------------------------
// Test 11 — Admin bypass preserves attachments
// ---------------------------------------------------------------------------
function testAdminBypassPreservesAttachments() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.doesNotMatch(
    src,
    /attachments:\s*\[\]/,
    'admin bypass must not drop attachments to empty array',
  )
  assert.match(
    src,
    /payload_space_files/,
    'admin bypass must fetch space files for attachments',
  )
}

// ---------------------------------------------------------------------------
// Test 12 — Admin canComment is false (admins don't post as members)
// ---------------------------------------------------------------------------
function testAdminCannotComment() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  const adminStart = src.indexOf('} else if (isAdmin)')
  const elseNotFoundIdx = src.indexOf('} else {\n    notFound()')
  assert.ok(adminStart !== -1, 'admin branch "} else if (isAdmin)" must exist')
  assert.ok(elseNotFoundIdx !== -1, 'fallthrough "} else { notFound() }" branch must exist')
  const adminBranch = src.slice(adminStart, elseNotFoundIdx)
  assert.match(adminBranch, /canComment:\s*false/, 'admin view must set canComment to false')
}

// ---------------------------------------------------------------------------
// Test 13 — Delete actions are guarded by typed confirmation
// ---------------------------------------------------------------------------
function testDeleteConfirmationTyped() {
  const courseActions = source('src/lib/portalAdmin/courseAdminActions.ts')
  const communityActions = source('src/lib/portalAdmin/communityAdminActions.ts')

  for (const action of ['deleteCourseAction', 'deleteModuleAction', 'deleteLessonAction']) {
    const idx = courseActions.indexOf(`function ${action}`)
    assert.ok(idx !== -1, `${action} must exist in courseAdminActions.ts`)
    const chunk = courseActions.slice(idx, idx + 200)
    assert.match(chunk, /confirmed/, `${action} must check confirmed parameter`)
  }

  for (const action of ['adminDeletePostAction', 'adminDeleteCommentAction']) {
    const idx = communityActions.indexOf(`function ${action}`)
    assert.ok(idx !== -1, `${action} must exist in communityAdminActions.ts`)
    const chunk = communityActions.slice(idx, idx + 200)
    assert.match(chunk, /confirmed/, `${action} must check confirmed parameter`)
  }
}

// ---------------------------------------------------------------------------
// Test 14 — No /admin links in admin workflow pages
// ---------------------------------------------------------------------------
function testNoAdminLinksInWorkflow() {
  const adminPages = [
    'src/app/(frontend)/portal/courses/page.tsx',
    'src/app/(frontend)/portal/courses/[courseSlug]/page.tsx',
    'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx',
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
    'src/app/(frontend)/portal/community/moderation/page.tsx',
    'src/app/(frontend)/portal/resources/page.tsx',
    'src/app/(frontend)/portal/bookmarks/page.tsx',
    'src/app/(frontend)/portal/partners/page.tsx',
  ]
  for (const rel of adminPages) {
    const content = readFileSync(path.resolve(ROOT, rel), 'utf8')
    assert.doesNotMatch(
      content,
      /href=['"]\/admin['"]|href=['"]\/admin\//,
      `${rel} must not link to /admin`,
    )
  }
}

// ---------------------------------------------------------------------------
// Test 15 — UI components are client-only
// ---------------------------------------------------------------------------
function testUIComponentsClientOnly() {
  const components = [
    'src/components/portal/admin/CourseAdminPanel.tsx',
    'src/components/portal/admin/PostModerationPanel.tsx',
    'src/components/portal/admin/CommentModerationActions.tsx',
    'src/components/portal/admin/SpaceAdminPanel.tsx',
  ]
  for (const rel of components) {
    const content = readFileSync(path.resolve(ROOT, rel), 'utf8')
    assert.match(content, /^'use client'/, `${rel} must start with 'use client'`)
    assert.doesNotMatch(
      content,
      /import.*from 'payload'/,
      `${rel} must not import payload directly`,
    )
    assert.doesNotMatch(
      content,
      /import 'server-only'/,
      `${rel} must not import server-only`,
    )
    assert.doesNotMatch(
      content,
      /import.*requirePortalAccess/,
      `${rel} must not import requirePortalAccess`,
    )
  }
}

// ---------------------------------------------------------------------------
// Test 16 — Post prefill: PostModerationPanel receives currentTitle and currentBody
// ---------------------------------------------------------------------------
function testPostPrefill() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.match(
    src,
    /currentTitle=\{post\.title\}/,
    'PostModerationPanel must receive currentTitle={post.title}',
  )
  assert.match(
    src,
    /currentBody=\{post\.bodyPlainText\.trim\(\)\}/,
    'PostModerationPanel must receive currentBody={post.bodyPlainText.trim()}',
  )
}

// ---------------------------------------------------------------------------
// Test 17 — Comment mandatory postId/spaceId: CommentModerationActions wired
// ---------------------------------------------------------------------------
function testCommentMandatoryPostIdSpaceId() {
  const src = source(
    'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  )
  assert.match(
    src,
    /postId=\{post\.id\}/,
    'CommentModerationActions must receive postId={post.id}',
  )
  assert.match(
    src,
    /spaceId=\{post\.space\.id\}/,
    'CommentModerationActions must receive spaceId={post.space.id}',
  )

  // CommentModerationActions component must have postId and spaceId as required props
  const componentSrc = source('src/components/portal/admin/CommentModerationActions.tsx')
  assert.match(
    componentSrc,
    /postId:\s*string/,
    'CommentModerationActionsProps must have postId: string',
  )
  assert.match(
    componentSrc,
    /spaceId:\s*string/,
    'CommentModerationActionsProps must have spaceId: string',
  )
  assert.doesNotMatch(
    componentSrc,
    /postId\?:/,
    'CommentModerationActionsProps postId must not be optional',
  )
  assert.doesNotMatch(
    componentSrc,
    /spaceId\?:/,
    'CommentModerationActionsProps spaceId must not be optional',
  )
}

// ---------------------------------------------------------------------------
// Test 18 — Comment mismatch fail-closed in the shared boundary
// ---------------------------------------------------------------------------
function testCommentMismatchFailClosed() {
  const src = source('src/lib/portalAdmin/communityAdminActions.ts')
  const domain = source('src/lib/community/persistence.ts')

  const postMatches = domain.match(/'Comment does not belong to the specified post\.'/g)
  assert.ok(
    postMatches && postMatches.length === 1,
    `'Comment does not belong to the specified post.' must have one shared implementation (found ${postMatches?.length ?? 0})`,
  )

  // The transports call the shared command boundary rather than duplicating
  // relationship checks in each action.
  const postErrCount = (domain.match(/'Comment does not belong to the specified post\.'/g) ?? []).length
  const spaceErrCount = (domain.match(/'Post does not belong to the specified space\.'/g) ?? []).length
  assert.ok(
    postErrCount + spaceErrCount === 2 && /editCommunityCommentCommand/.test(src),
    'comment actions must route relationship checks through the shared command boundary',
  )
}

// ---------------------------------------------------------------------------
// Test 19 — Space edit prefill: SpaceAdminPanel uses editTarget values
// ---------------------------------------------------------------------------
function testSpaceEditPrefill() {
  const src = source('src/components/portal/admin/SpaceAdminPanel.tsx')
  assert.match(
    src,
    /editTarget\.description/,
    'SpaceAdminPanel edit form must use editTarget.description',
  )
  assert.match(
    src,
    /editTarget\.visibility/,
    'SpaceAdminPanel edit form must use editTarget.visibility',
  )
}

// ---------------------------------------------------------------------------
// Test 20 — Restore/delete dependency behavior
// ---------------------------------------------------------------------------
function testRestoreDeleteDependencyBehavior() {
  const src = source('src/lib/portalAdmin/communityAdminActions.ts')

  // deleteSpaceAction must check payload_space_posts and payload_space_memberships
  const deleteSpaceIdx = src.indexOf('function deleteSpaceAction')
  assert.ok(deleteSpaceIdx !== -1, 'deleteSpaceAction must exist')
  const deleteSpaceBody = src.slice(deleteSpaceIdx, deleteSpaceIdx + 1500)
  assert.match(
    deleteSpaceBody,
    /payload_space_posts/,
    'deleteSpaceAction must check payload_space_posts before deleting',
  )
  assert.match(
    deleteSpaceBody,
    /payload_space_memberships/,
    'deleteSpaceAction must check payload_space_memberships before deleting',
  )

  // restoreSpaceAction must set status to 'published' (not 'active')
  const restoreSpaceIdx = src.indexOf('function restoreSpaceAction')
  assert.ok(restoreSpaceIdx !== -1, 'restoreSpaceAction must exist')
  const restoreSpaceBody = src.slice(restoreSpaceIdx, restoreSpaceIdx + 200)
  assert.match(
    restoreSpaceBody,
    /'published'/,
    "restoreSpaceAction must set status to 'published'",
  )
  assert.doesNotMatch(
    restoreSpaceBody,
    /'active'/,
    "restoreSpaceAction must not set status to 'active'",
  )
}

// ---------------------------------------------------------------------------
// Test 21 — Fresh-checkout vs staging-gate: manifest entry has correct requirement
// ---------------------------------------------------------------------------
function testFreshCheckoutVsStagingGate() {
  const manifestSrc = source('scripts/release/releaseTestManifest.ts')
  const gateIdx = manifestSrc.indexOf("'portal-admin.mutation-smoke-gate'")
  assert.ok(gateIdx !== -1, 'portal-admin.mutation-smoke-gate must exist in manifest')
  const gateEntry = manifestSrc.slice(gateIdx, gateIdx + 700)
  assert.match(
    gateEntry,
    /requirement:\s*'conditional'/,
    "portal-admin.mutation-smoke-gate must have requirement: 'conditional'",
  )
  assert.match(
    gateEntry,
    /condition:\s*'STAGING_GATE'/,
    "portal-admin.mutation-smoke-gate must have condition: 'STAGING_GATE'",
  )
}

// ---------------------------------------------------------------------------
// Test 22 — Staging-gate command exists in package.json
// ---------------------------------------------------------------------------
function testStagingGateCommandExists() {
  const pkg = source('package.json')
  assert.match(
    pkg,
    /"test:release:staging-gate"/,
    'package.json must have test:release:staging-gate script',
  )
  assert.match(
    pkg,
    /--enable-condition STAGING_GATE/,
    'test:release:staging-gate must pass --enable-condition STAGING_GATE',
  )
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests: Array<[string, () => void]> = [
  ['01 — no inline server actions in post page', testNoInlineServerActions],
  ['02 — PostModerationPanel wired with spaceId', testPostModerationWired],
  ['03 — CommentModerationActions wired with commentId', testCommentModerationWired],
  ['04 — CourseAdminPanel wired with full course data', testCourseAdminPanelWired],
  ['05 — SpaceAdminPanel wired on community index', testSpaceAdminPanelWired],
  ['06 — reorder actions validate ownership', testReorderValidatesOwnership],
  ['07 — community actions have non-optional expectedSpaceId', testSpaceVerificationParameter],
  ['08 — space verification check enforced in all actions', testSpaceVerificationEnforced],
  ['09 — admin actions do not create synthetic member records', testNoSyntheticMemberCreation],
  ['10 — admin bypass resolves real author names', testNoPlaceholderAuthors],
  ['11 — admin bypass preserves attachments', testAdminBypassPreservesAttachments],
  ['12 — admin canComment is false', testAdminCannotComment],
  ['13 — delete actions require typed confirmation', testDeleteConfirmationTyped],
  ['14 — no /admin links in workflow pages', testNoAdminLinksInWorkflow],
  ['15 — admin UI components are client-only', testUIComponentsClientOnly],
  ['16 — post prefill passes currentTitle and currentBody', testPostPrefill],
  ['17 — comment mandatory postId/spaceId wired', testCommentMandatoryPostIdSpaceId],
  ['18 — comment mismatch fail-closed error strings', testCommentMismatchFailClosed],
  ['19 — space edit prefill uses editTarget values', testSpaceEditPrefill],
  ['20 — restore/delete dependency behavior', testRestoreDeleteDependencyBehavior],
  ['21 — fresh-checkout vs staging-gate manifest entry', testFreshCheckoutVsStagingGate],
  ['22 — staging-gate command exists in package.json', testStagingGateCommandExists],
]

function main() {
  let passed = 0
  let failed = 0

  for (const [name, fn] of tests) {
    try {
      fn()
      console.log(`  PASS  ${name}`)
      passed++
    } catch (err) {
      const msg = err instanceof assert.AssertionError ? err.message : String(err)
      console.log(`  FAIL  ${name}`)
      console.log(`        ${msg}`)
      failed++
      process.exitCode = 1
    }
  }

  console.log()
  console.log(`Results: ${passed} passed, ${failed} failed (${tests.length} total)`)
}

main()
