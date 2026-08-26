import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import {
  getAllWeeks,
  getWeekBySlug,
  getProgrammeSummary,
} from '../src/lib/course/programmeCatalog'

function testExactlyEightWeeks(): void {
  const weeks = getAllWeeks()
  assert.equal(weeks.length, 8, 'programme must have exactly 8 weeks')
}

function testEveryWeekHasRequiredFields(): void {
  const weeks = getAllWeeks()
  for (const week of weeks) {
    assert.ok(typeof week.id === 'string' && week.id.length > 0, `week ${week.slug} must have id`)
    assert.ok(typeof week.slug === 'string' && week.slug.length > 0, `week ${week.id} must have slug`)
    assert.ok(typeof week.title === 'string' && week.title.length > 0, `week ${week.id} must have title`)
    assert.ok(typeof week.summary === 'string' && week.summary.length > 0, `week ${week.id} must have summary`)
    assert.ok(['free', 'pro', 'free_and_pro'].includes(week.access), `week ${week.id} must have valid access`)
    assert.ok(typeof week.hasMentorship === 'boolean', `week ${week.id} must have hasMentorship`)
    assert.ok(
      ['placeholder', 'draft', 'ready'].includes(week.status),
      `week ${week.id} must have valid status`,
    )
  }
}

function testGetWeekBySlug(): void {
  const week = getWeekBySlug('strategy-selection')
  assert.ok(week !== null, 'should find week by slug')
  assert.equal(week?.slug, 'strategy-selection')

  const notFound = getWeekBySlug('nonexistent-week')
  assert.equal(notFound, null)
}

function testProgrammeSummary(): void {
  const summary = getProgrammeSummary()
  assert.equal(summary.totalWeeks, 8)
  assert.equal(summary.publicLabel, 'JPV Bootcamp programme')
  assert.equal(summary.isPlaceholder, true)
  assert.ok(typeof summary.supportEmail === 'string' && summary.supportEmail.length > 0)
}

function testWeekIdsUnique(): void {
  const weeks = getAllWeeks()
  const ids = weeks.map((week) => week.id)
  const uniqueIds = new Set(ids)
  assert.equal(ids.length, uniqueIds.size, 'week ids must be unique')
}

function testWeekSlugsUnique(): void {
  const weeks = getAllWeeks()
  const slugs = weeks.map((week) => week.slug)
  const uniqueSlugs = new Set(slugs)
  assert.equal(slugs.length, uniqueSlugs.size, 'week slugs must be unique')
}

function testProgressionOrder(): void {
  const weeks = getAllWeeks()
  const firstThree = weeks.slice(0, 3)
  for (const week of firstThree) {
    assert.equal(
      week.access,
      'free_and_pro',
      `first 3 weeks should be free_and_pro but ${week.slug} is ${week.access}`,
    )
  }
  const lastFive = weeks.slice(3)
  for (const week of lastFive) {
    assert.equal(week.access, 'pro', `last 5 weeks should be pro, but ${week.slug} is ${week.access}`)
  }
}

function testMentorshipWeeks(): void {
  const weeks = getAllWeeks()
  const mentorship = weeks.filter((week) => week.hasMentorship)
  assert.ok(mentorship.length >= 3, 'at least 3 weeks should include mentorship')
}

function testPlaceholderStatus(): void {
  const weeks = getAllWeeks()
  for (const week of weeks) {
    assert.equal(week.status, 'placeholder', `week ${week.slug} should be placeholder`)
  }
}

function testProgrammeRedirectExists(): void {
  const path = 'src/app/(frontend)/programme/page.tsx'
  assert.ok(existsSync(path), `programme redirect should exist at ${path}`)
  const content = readFileSync(path, 'utf8')
  assert.ok(content.includes("redirect("), 'programme page must use redirect()')
}

function testPortalProgrammeRouteContainsProCta(): void {
  const content = readFileSync('src/app/(frontend)/portal/programme/page.tsx', 'utf8')
  assert.match(content, /href=['"]\/portal\/billing['"]/, 'portal programme page must link to /portal/billing')
  assert.match(content, /JPV Bootcamp Membership/i, 'portal programme page must mention JPV Bootcamp Membership')
  assert.doesNotMatch(content, /href="\/upgrade"/, 'portal programme page must not link members to /upgrade')
  const removedRoot = `/${'learn'}`
  assert.equal(content.includes(removedRoot), false, 'portal programme page must not mention the removed member namespace')
}

function testPortalProgrammeRoutePlaceholderNotice(): void {
  const content = readFileSync('src/app/(frontend)/portal/programme/page.tsx', 'utf8')
  assert.match(content, /placeholder|representative|subject to client approval/i)
}

function testLegacyTermsNotPresent(): void {
  const filesToCheck = [
    'src/lib/course/programmeCatalog.ts',
    'src/app/(frontend)/programme/page.tsx',
    'src/app/(frontend)/portal/programme/page.tsx',
  ]
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of filesToCheck) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const term of legacyTerms) {
      assert.doesNotMatch(
        content,
        new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        `${file} must not contain legacy term: ${term}`,
      )
    }
  }
}

function testNoDbNetworkOrMigrationCommands(): void {
  const filesToCheck = [
    'src/lib/course/programmeCatalog.ts',
    'src/app/(frontend)/programme/page.tsx',
    'src/app/(frontend)/portal/programme/page.tsx',
  ]
  const forbidden = ['prisma.', 'payload.', 'fetch(', 'axios', 'https.request', '.env', 'DATABASE_URL']
  for (const file of filesToCheck) {
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
  testExactlyEightWeeks()
  testEveryWeekHasRequiredFields()
  testGetWeekBySlug()
  testProgrammeSummary()
  testWeekIdsUnique()
  testWeekSlugsUnique()
  testProgressionOrder()
  testMentorshipWeeks()
  testPlaceholderStatus()
  testProgrammeRedirectExists()
  testPortalProgrammeRouteContainsProCta()
  testPortalProgrammeRoutePlaceholderNotice()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  console.log('course_programme_mvp.test.ts passed')
} catch (error) {
  console.error('course_programme_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
