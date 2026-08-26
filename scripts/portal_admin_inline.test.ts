/**
 * portal_admin_inline.test.ts
 *
 * Structural invariant tests for the inline admin portal implementation.
 * Uses source-code analysis (readFileSync + pattern matching) rather than
 * runtime testing. Invariants are matched by regex to remain robust when
 * surrounding implementation details change.
 *
 * Run: pnpm exec tsx scripts/portal_admin_inline.test.ts
 */

import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function source(relPath: string): string {
  const abs = resolve(ROOT, relPath)
  assert.ok(existsSync(abs), `Expected file to exist: ${relPath}`)
  return readFileSync(abs, 'utf8')
}

function fileExists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath))
}

// ---------------------------------------------------------------------------
// 1. Admin stays under /portal — no /admin nav links in admin workflow paths
// ---------------------------------------------------------------------------
function testAdminStaysUnderPortal() {
  const adminWorkflowPaths = [
    'src/app/(frontend)/portal/courses/page.tsx',
    'src/app/(frontend)/portal/courses/[courseSlug]/page.tsx',
    'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx',
    'src/app/(frontend)/portal/community/page.tsx',
    'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  ]

  // Matches href that point to the Payload /admin panel (not import paths)
  // Allow: import paths containing "adminPortal", "portalAdmin", "AdminGate", etc.
  // Disallow: href="/admin..." or href='/admin...'
  const adminHrefRe = /href\s*=\s*['"`]\/admin/

  for (const relPath of adminWorkflowPaths) {
    if (!fileExists(relPath)) continue
    const src = source(relPath)
    assert.ok(
      !adminHrefRe.test(src),
      `[test 1] Found /admin href navigation link in ${relPath} — admin UI must stay under /portal`,
    )
  }
}

// ---------------------------------------------------------------------------
// 2. Nested routes use requirePortalAccess
// ---------------------------------------------------------------------------
function testNestedRoutesUseRequirePortalAccess() {
  const nestedRoutes = [
    'src/app/(frontend)/portal/courses/[courseSlug]/page.tsx',
    'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx',
  ]

  for (const relPath of nestedRoutes) {
    const src = source(relPath)
    assert.match(
      src,
      /requirePortalAccess/,
      `[test 2] ${relPath} must import and call requirePortalAccess`,
    )
  }
}

// ---------------------------------------------------------------------------
// 3. Admin data loaders exist
// ---------------------------------------------------------------------------
function testAdminDataLoadersExist() {
  const adminPortalPath = 'src/lib/portalAdmin/adminPortal.ts'
  const src = source(adminPortalPath)

  const requiredExports = [
    'getAdminCourseOverview',
    'getAdminLessonDetail',
    'getAdminCourseDashboard',
  ]

  for (const name of requiredExports) {
    assert.match(
      src,
      new RegExp(`export\\s+(async\\s+)?function\\s+${name}`),
      `[test 3] adminPortal.ts must export ${name}`,
    )
  }
}

// ---------------------------------------------------------------------------
// 4. CourseAdminPanel wired with full course data — type and prop assertions
// ---------------------------------------------------------------------------
function testCourseAdminActionsExistAndServerOnly() {
  const actionsPath = 'src/lib/portalAdmin/courseAdminActions.ts'
  const src = source(actionsPath)

  assert.match(
    src,
    /^['"]use server['"]/,
    `[test 4] courseAdminActions.ts must start with 'use server'`,
  )

  const requiredExports = [
    'createCourseAction',
    'updateCourseAction',
    'archiveCourseAction',
    'deleteCourseAction',
    'createModuleAction',
    'updateModuleAction',
    'deleteModuleAction',
    'createLessonAction',
    'updateLessonAction',
    'deleteLessonAction',
  ]

  for (const name of requiredExports) {
    assert.match(
      src,
      new RegExp(`export\\s+(async\\s+)?function\\s+${name}`),
      `[test 4] courseAdminActions.ts must export ${name}`,
    )
  }

  // CourseAdminPanelProps must include descriptionPlainText and coverImageId
  const panelSrc = source('src/components/portal/admin/CourseAdminPanel.tsx')
  assert.match(
    panelSrc,
    /descriptionPlainText:\s*string\s*\|\s*null/,
    `[test 4] CourseAdminPanelProps must include descriptionPlainText: string | null`,
  )
  assert.match(
    panelSrc,
    /coverImageId:\s*string\s*\|\s*null/,
    `[test 4] CourseAdminPanelProps must include coverImageId: string | null`,
  )

  // Lesson type must include the 4 new fields
  assert.match(
    panelSrc,
    /bunnyVideoId:\s*string\s*\|\s*null/,
    `[test 4] Lesson type must include bunnyVideoId: string | null`,
  )
  assert.match(
    panelSrc,
    /downloadIds:\s*string\[\]/,
    `[test 4] Lesson type must include downloadIds: string[]`,
  )
  assert.match(
    panelSrc,
    /contentPlainText:\s*string\s*\|\s*null/,
    `[test 4] Lesson type must include contentPlainText: string | null`,
  )

  // Course page must map the new fields
  const pageSrc = source('src/app/(frontend)/portal/courses/[courseSlug]/page.tsx')
  assert.match(
    pageSrc,
    /descriptionPlainText=\{course\.descriptionPlainText\}/,
    `[test 4] course page must pass descriptionPlainText to CourseAdminPanel`,
  )
  assert.match(
    pageSrc,
    /coverImageId=\{course\.coverImageId\}/,
    `[test 4] course page must pass coverImageId to CourseAdminPanel`,
  )
  assert.match(
    pageSrc,
    /bunnyVideoId:\s*l\.bunnyVideoId/,
    `[test 4] course page must map bunnyVideoId for lessons`,
  )
  assert.match(
    pageSrc,
    /downloadIds:\s*l\.downloadIds/,
    `[test 4] course page must map downloadIds for lessons`,
  )
  assert.match(
    pageSrc,
    /contentPlainText:\s*l\.contentPlainText/,
    `[test 4] course page must map contentPlainText for lessons`,
  )
}

// ---------------------------------------------------------------------------
// 5. Community admin actions exist
// ---------------------------------------------------------------------------
function testCommunityAdminActionsExist() {
  const actionsPath = 'src/lib/portalAdmin/communityAdminActions.ts'
  const src = source(actionsPath)

  assert.match(
    src,
    /^['"]use server['"]/,
    `[test 5] communityAdminActions.ts must start with 'use server'`,
  )

  const requiredExports = [
    'createSpaceAction',
    'adminPinPostAction',
    'adminLockPostAction',
    'adminHidePostAction',
    'adminDeletePostAction',
    'adminEditCommentAction',
    'adminDeleteCommentAction',
  ]

  for (const name of requiredExports) {
    assert.match(
      src,
      new RegExp(`export\\s+(async\\s+)?function\\s+${name}`),
      `[test 5] communityAdminActions.ts must export ${name}`,
    )
  }
}

// ---------------------------------------------------------------------------
// 6. Every admin action re-resolves auth via requirePortalAccess
// ---------------------------------------------------------------------------
function testAdminActionsResolveAuth() {
  const actionFiles = [
    'src/lib/portalAdmin/courseAdminActions.ts',
    'src/lib/portalAdmin/communityAdminActions.ts',
  ]

  for (const relPath of actionFiles) {
    const src = source(relPath)
    assert.match(
      src,
      /requirePortalAccess/,
      `[test 6] ${relPath} must import and call requirePortalAccess — no reliance on client state`,
    )
  }
}

// ---------------------------------------------------------------------------
// 7. AdminGate is activated in course and lesson pages — wraps admin components
// ---------------------------------------------------------------------------
function testAdminGateActivated() {
  const pagesWithAdminGate = [
    'src/app/(frontend)/portal/courses/[courseSlug]/page.tsx',
    'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx',
  ]

  for (const relPath of pagesWithAdminGate) {
    const src = source(relPath)
    assert.match(
      src,
      /import\s+.*AdminGate.*from/,
      `[test 7] ${relPath} must import AdminGate`,
    )
    assert.match(
      src,
      /<AdminGate/,
      `[test 7] ${relPath} must use AdminGate component`,
    )
  }

  // Course page: AdminGate must wrap CourseAdminPanel
  const courseSrc = source('src/app/(frontend)/portal/courses/[courseSlug]/page.tsx')
  const adminGateIdx = courseSrc.indexOf('<AdminGate>')
  const courseAdminPanelIdx = courseSrc.indexOf('<CourseAdminPanel')
  assert.ok(
    adminGateIdx !== -1 && courseAdminPanelIdx !== -1 && courseAdminPanelIdx > adminGateIdx,
    `[test 7] course page AdminGate must appear before CourseAdminPanel (AdminGate wraps it)`,
  )
  const closeAdminGateIdx = courseSrc.indexOf('</AdminGate>', adminGateIdx)
  assert.ok(
    closeAdminGateIdx > courseAdminPanelIdx,
    `[test 7] CourseAdminPanel must be inside AdminGate (</AdminGate> must follow <CourseAdminPanel)`,
  )

  const lessonSrc = source(
    'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx',
  )
  assert.match(
    lessonSrc,
    /getAdminLessonDetail\(payload, courseSlug, lessonSlug\)/,
    `[test 7] lesson page must load the real admin lesson projection`,
  )
}

// ---------------------------------------------------------------------------
// 8. AdminGate remains presentation-only (no server imports)
// ---------------------------------------------------------------------------
function testAdminGatePresentationOnly() {
  const adminGatePath = 'src/components/portal/AdminGate.tsx'
  const src = source(adminGatePath)

  // Check actual import statements, not comment mentions
  assert.doesNotMatch(
    src,
    /^import\s+.*requirePortalAccess/m,
    `[test 8] AdminGate.tsx must NOT import requirePortalAccess — it is a presentation gate only`,
  )

  assert.doesNotMatch(
    src,
    /^import\s+['"]server-only['"]/m,
    `[test 8] AdminGate.tsx must NOT import server-only — it is a client component`,
  )

  assert.match(
    src,
    /['"]use client['"]/,
    `[test 8] AdminGate.tsx must be a client component`,
  )
}

// ---------------------------------------------------------------------------
// 9. Member server actions preserved — use requirePortalMember, not requirePortalAccess
// ---------------------------------------------------------------------------
function testMemberServerActionsPreserved() {
  const lessonPagePath =
    'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx'
  const src = source(lessonPagePath)

  // completeLesson must use requirePortalMember
  assert.match(
    src,
    /requirePortalMember/,
    `[test 9] Lesson page must import requirePortalMember for member server actions`,
  )

  // completeLesson remains a member-only server action. Discussion comments
  // use a member-only API route so submission can stay in place.
  const completeLessonFnIndex = src.indexOf('async function completeLesson')

  assert.ok(
    completeLessonFnIndex !== -1,
    `[test 9] completeLesson server action must be present in lesson page`,
  )

  // Extract the completeLesson function body and confirm it uses requirePortalMember
  const completeLessonBody = src.slice(completeLessonFnIndex, completeLessonFnIndex + 600)
  assert.match(
    completeLessonBody,
    /requirePortalMember/,
    `[test 9] completeLesson must call requirePortalMember, not requirePortalAccess`,
  )

  const commentRoute = source(
    'src/app/api/portal/courses/[courseSlug]/lessons/[lessonSlug]/comments/route.ts',
  )
  assert.match(
    commentRoute,
    /export async function POST/,
    `[test 9] lesson discussion route must expose POST`,
  )
  assert.match(
    commentRoute,
    /requirePortalMember/,
    `[test 9] lesson discussion route must call requirePortalMember`,
  )
  assert.match(
    source('src/components/community/LessonCommentComposer.tsx'),
    /router\.refresh\(\)/,
    `[test 9] lesson discussion composer must refresh without navigation`,
  )
}

// ---------------------------------------------------------------------------
// 10. Delete actions require confirmation
// ---------------------------------------------------------------------------
function testDeleteActionsRequireConfirmation() {
  const courseActionsSrc = source('src/lib/portalAdmin/courseAdminActions.ts')
  const communityActionsSrc = source('src/lib/portalAdmin/communityAdminActions.ts')

  const deleteActionPatterns: Array<[string, string]> = [
    ['deleteCourseAction', courseActionsSrc],
    ['deleteModuleAction', courseActionsSrc],
    ['deleteLessonAction', courseActionsSrc],
    ['adminDeletePostAction', communityActionsSrc],
    ['adminDeleteCommentAction', communityActionsSrc],
  ]

  for (const [name, src] of deleteActionPatterns) {
    // Find the function declaration
    const fnIndex = src.indexOf(`function ${name}`)
    assert.ok(fnIndex !== -1, `[test 10] ${name} must be defined`)

    // Extract a window around the function — enough to see the confirmation check
    const fnBody = src.slice(fnIndex, fnIndex + 400)
    assert.match(
      fnBody,
      /confirmed/,
      `[test 10] ${name} must check a 'confirmed' parameter before proceeding`,
    )
  }
}

// ---------------------------------------------------------------------------
// 11. Delete actions check dependencies
// ---------------------------------------------------------------------------
function testDeleteActionsCheckDependencies() {
  const courseActionsSrc = source('src/lib/portalAdmin/courseAdminActions.ts')
  const communityActionsSrc = source('src/lib/portalAdmin/communityAdminActions.ts')

  // deleteCourseAction checks for modules and enrollments
  const deleteCourseIdx = courseActionsSrc.indexOf('function deleteCourseAction')
  const deleteCourseBody = courseActionsSrc.slice(deleteCourseIdx, deleteCourseIdx + 1200)
  assert.match(
    deleteCourseBody,
    /module/i,
    `[test 11] deleteCourseAction must check for existing modules`,
  )
  assert.match(
    deleteCourseBody,
    /enrollment/i,
    `[test 11] deleteCourseAction must check for existing enrollments`,
  )

  // deleteModuleAction checks for lessons
  const deleteModuleIdx = courseActionsSrc.indexOf('function deleteModuleAction')
  const deleteModuleBody = courseActionsSrc.slice(deleteModuleIdx, deleteModuleIdx + 800)
  assert.match(
    deleteModuleBody,
    /lesson/i,
    `[test 11] deleteModuleAction must check for existing lessons`,
  )

  // deleteLessonAction checks for progress, comments, and resources
  const deleteLessonIdx = courseActionsSrc.indexOf('function deleteLessonAction')
  const deleteLessonBody = courseActionsSrc.slice(deleteLessonIdx, deleteLessonIdx + 1200)
  assert.match(
    deleteLessonBody,
    /progress/i,
    `[test 11] deleteLessonAction must check for lesson progress records`,
  )
  assert.match(
    deleteLessonBody,
    /comment/i,
    `[test 11] deleteLessonAction must check for lesson comments`,
  )
  assert.match(
    deleteLessonBody,
    /resource/i,
    `[test 11] deleteLessonAction must check for lesson resources`,
  )
}

// ---------------------------------------------------------------------------
// 12. Slug validation exists in action files
// ---------------------------------------------------------------------------
function testSlugValidationExists() {
  const actionFiles = [
    'src/lib/portalAdmin/courseAdminActions.ts',
    'src/lib/portalAdmin/communityAdminActions.ts',
  ]

  for (const relPath of actionFiles) {
    const src = source(relPath)
    // Should have a validateSlug function or inline slug normalization
    assert.match(
      src,
      /validateSlug|slug.*\.toLowerCase\(\)|slug.*replace/,
      `[test 12] ${relPath} must include slug normalization/validation logic`,
    )
  }
}

// ---------------------------------------------------------------------------
// 13. Audit events recorded — all action files import createAuditEvent
// ---------------------------------------------------------------------------
function testAuditEventsRecorded() {
  const actionFiles = [
    'src/lib/portalAdmin/courseAdminActions.ts',
    'src/lib/portalAdmin/communityAdminActions.ts',
  ]

  for (const relPath of actionFiles) {
    const src = source(relPath)
    assert.match(
      src,
      /createAuditEvent/,
      `[test 13] ${relPath} must import and call createAuditEvent`,
    )
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
function main() {
  const tests: Array<[string, () => void]> = [
    ['1. Admin stays under /portal', testAdminStaysUnderPortal],
    ['2. Nested routes use requirePortalAccess', testNestedRoutesUseRequirePortalAccess],
    ['3. Admin data loaders exist', testAdminDataLoadersExist],
    ['4. Course admin actions exist and are server-only', testCourseAdminActionsExistAndServerOnly],
    ['5. Community admin actions exist', testCommunityAdminActionsExist],
    ['6. Every admin action re-resolves auth', testAdminActionsResolveAuth],
    ['7. AdminGate is activated in course/lesson pages', testAdminGateActivated],
    ['8. AdminGate remains presentation-only', testAdminGatePresentationOnly],
    ['9. Member server actions preserved', testMemberServerActionsPreserved],
    ['10. Delete actions require confirmation', testDeleteActionsRequireConfirmation],
    ['11. Delete actions check dependencies', testDeleteActionsCheckDependencies],
    ['12. Slug validation exists', testSlugValidationExists],
    ['13. Audit events recorded', testAuditEventsRecorded],
  ]

  let passed = 0
  let failed = 0

  for (const [label, fn] of tests) {
    try {
      fn()
      console.log(`  PASS  ${label}`)
      passed++
    } catch (err) {
      console.error(`  FAIL  ${label}`)
      console.error(`        ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\nportal admin inline tests passed')
  }
}

main()
