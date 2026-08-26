import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  getAdminReviewSections,
  getAdminReviewSummary,
  getReviewSectionBySlug,
  getAdminReviewExportRows,
  type ReviewSectionStatus,
} from '../src/lib/admin/adminReviewModel'

const ADMIN_FILES = [
  'src/lib/admin/adminReviewModel.ts',
  'src/app/(frontend)/admin/review/page.tsx',
]

const EXPECTED_SECTION_SLUGS = [
  'partner-referrals',
  'support-pay-it-forward',
  'programme',
  'community',
  'membership-billing',
  'member-portal',
]

const VALID_STATUSES: ReviewSectionStatus[] = [
  'preview',
  'manual_review',
  'blocked',
  'ready_for_testing',
]

function testPortalPageExists(): void {
  assert.ok(existsSync('src/app/(frontend)/portal/page.tsx'), '/portal page.tsx must exist')
}

function testAdminReviewModelExists(): void {
  const sections = getAdminReviewSections()
  assert.ok(Array.isArray(sections), 'getAdminReviewSections must return an array')
}

function testAdminReviewRouteExists(): void {
  assert.ok(existsSync('src/app/(frontend)/admin/review/page.tsx'), 'admin review route must exist')
}

function testHasPartnerReferralSection(): void {
  const section = getReviewSectionBySlug('partner-referrals')
  assert.ok(section, 'review model must have partner-referrals section')
}

function testHasSupportSection(): void {
  const section = getReviewSectionBySlug('support-pay-it-forward')
  assert.ok(section, 'review model must have support-pay-it-forward section')
}

function testHasProgrammeSection(): void {
  const section = getReviewSectionBySlug('programme')
  assert.ok(section, 'review model must have programme section')
}

function testHasCommunitySection(): void {
  const section = getReviewSectionBySlug('community')
  assert.ok(section, 'review model must have community section')
}

function testHasMembershipBillingSection(): void {
  const section = getReviewSectionBySlug('membership-billing')
  assert.ok(section, 'review model must have membership-billing section')
}

function testHasMemberPortalSection(): void {
  const section = getReviewSectionBySlug('member-portal')
  assert.ok(section, 'review model must have member-portal section')
}

function testAllExpectedSectionsExist(): void {
  const sections = getAdminReviewSections()
  const slugs = sections.map((s) => s.slug)
  for (const expected of EXPECTED_SECTION_SLUGS) {
    assert.ok(slugs.includes(expected), `review model must have section: ${expected}`)
  }
}

function testEverySectionHasRequiredFields(): void {
  const sections = getAdminReviewSections()
  for (const section of sections) {
    assert.ok(typeof section.slug === 'string' && section.slug.length > 0, `section ${section.slug} missing slug`)
    assert.ok(typeof section.title === 'string' && section.title.length > 0, `section ${section.slug} missing title`)
    assert.ok(typeof section.summary === 'string' && section.summary.length > 0, `section ${section.slug} missing summary`)
    assert.ok(typeof section.description === 'string' && section.description.length > 0, `section ${section.slug} missing description`)
    assert.ok(VALID_STATUSES.includes(section.status), `section ${section.slug} invalid status: ${section.status}`)
    assert.ok(typeof section.href === 'string' && section.href.length > 0, `section ${section.slug} missing href`)
    assert.ok(typeof section.ownerLabel === 'string' && section.ownerLabel.length > 0, `section ${section.slug} missing ownerLabel`)
    assert.ok(typeof section.blockerCount === 'number' && section.blockerCount >= 0, `section ${section.slug} invalid blockerCount`)
    assert.ok(typeof section.actionCount === 'number' && section.actionCount >= 0, `section ${section.slug} invalid actionCount`)
  }
}

function testSummaryTotalsAreConsistent(): void {
  const sections = getAdminReviewSections()
  const summary = getAdminReviewSummary()

  assert.equal(summary.totalSections, sections.length)
  assert.equal(summary.blockedCount, sections.filter((s) => s.status === 'blocked').length)
  assert.equal(summary.manualReviewCount, sections.filter((s) => s.status === 'manual_review').length)
  assert.equal(summary.readyForTestingCount, sections.filter((s) => s.status === 'ready_for_testing').length)
  assert.equal(summary.previewCount, sections.filter((s) => s.status === 'preview').length)
  assert.equal(summary.totalBlockers, sections.reduce((sum, s) => sum + s.blockerCount, 0))
  assert.equal(summary.isPreview, true)
}

function testGetReviewSectionBySlug(): void {
  const sections = getAdminReviewSections()
  for (const section of sections) {
    const found = getReviewSectionBySlug(section.slug)
    assert.ok(found, `getReviewSectionBySlug('${section.slug}') must return section`)
    assert.equal(found?.slug, section.slug)
  }
  assert.equal(getReviewSectionBySlug('nonexistent'), undefined, 'unknown slug must return undefined')
}

function testExportRowsExist(): void {
  const rows = getAdminReviewExportRows()
  assert.ok(rows.length >= 5, `expected at least 5 export rows, got ${rows.length}`)
  assert.equal(rows.length, getAdminReviewSections().length, 'export rows must match sections count')
}

function testExportRowsHaveSafeData(): void {
  const rows = getAdminReviewExportRows()
  for (const row of rows) {
    assert.ok(typeof row.section === 'string', 'export row must have section name')
    assert.ok(typeof row.status === 'string', 'export row must have status')
    assert.ok(typeof row.owner === 'string', 'export row must have owner')
    assert.ok(typeof row.blockers === 'number', 'export row must have blockers count')
    assert.ok(typeof row.actions === 'number', 'export row must have actions count')
    assert.ok(typeof row.notes === 'string' && row.notes.length > 0, 'export row must have notes')
  }
}

function testAdminPageCopyIsReadOnly(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/page.tsx', 'utf8')
  assert.ok(
    content.toLowerCase().includes('preview') || content.toLowerCase().includes('read-only'),
    'admin page must include preview or read-only wording',
  )
}

function testAdminPageNoLiveDbQueueClaim(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/page.tsx', 'utf8')
  assert.ok(
    content.toLowerCase().includes('no live db queue') ||
    content.includes('no DB-backed'),
    'admin page must disclaim live DB queue',
  )
}

function testAdminPageNoMigrationClaim(): void {
  const content = readFileSync('src/app/(frontend)/admin/review/page.tsx', 'utf8')
  assert.ok(
    content.toLowerCase().includes('no migrations applied') ||
    content.toLowerCase().includes('migration'),
    'admin page must mention migration state',
  )
}

function testLegacyTermsNotPresent(): void {
  const legacyTerms = ['WordPress', 'Fluent', 'VIP', 'exhibitor', 'old portal', 'plan=vip']
  for (const file of ADMIN_FILES) {
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
  for (const file of ADMIN_FILES) {
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
  testPortalPageExists()
  testAdminReviewModelExists()
  testAdminReviewRouteExists()
  testHasPartnerReferralSection()
  testHasSupportSection()
  testHasProgrammeSection()
  testHasCommunitySection()
  testHasMembershipBillingSection()
  testHasMemberPortalSection()
  testAllExpectedSectionsExist()
  testEverySectionHasRequiredFields()
  testSummaryTotalsAreConsistent()
  testGetReviewSectionBySlug()
  testExportRowsExist()
  testExportRowsHaveSafeData()
  testAdminPageCopyIsReadOnly()
  testAdminPageNoLiveDbQueueClaim()
  testAdminPageNoMigrationClaim()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  console.log('admin_review_mvp.test.ts passed')
} catch (error) {
  console.error('admin_review_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
