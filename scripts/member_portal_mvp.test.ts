import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { getDashboardCards, getDashboardModel } from '../src/lib/portal/memberDashboardModel'

function testDashboardRouteExists(): void {
  const path = 'src/app/(frontend)/dashboard/page.tsx'
  assert.ok(existsSync(path), `dashboard route should exist at ${path}`)
}

function testDashboardHasStaticUpgradeLink(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.match(content, /href="\/upgrade"/, 'dashboard must link to /upgrade')
}

function testDashboardHasStaticPortalLink(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.match(content, /href="\/portal"/, 'dashboard must link to member portal')
}

function testDashboardRendersCardsFromModel(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.match(content, /getDashboardModel|model\.cards/, 'dashboard must render cards from model')
}

function testDashboardMentionsPro(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.match(content, /Pro/i, 'dashboard must mention Pro membership')
}

function testDashboardMentionsFreeAccess(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.match(content, /Free/i, 'dashboard must mention Free access')
}

function testDashboardHasPlaceholderWording(): void {
  const content = readFileSync('src/app/(frontend)/dashboard/page.tsx', 'utf8')
  assert.match(content, /preview|representative|not final/i, 'dashboard must have placeholder wording')
}

function testModelReturnsExpectedCardCount(): void {
  const cards = getDashboardCards()
  assert.equal(cards.length, 5, 'model must have exactly 5 cards (pro-membership, programme, community, support, partner-referral)')
}

function testAllCardsHaveRequiredFields(): void {
  const cards = getDashboardCards()
  for (const card of cards) {
    assert.ok(typeof card.id === 'string' && card.id.length > 0, `card ${card.id} must have id`)
    assert.ok(typeof card.title === 'string' && card.title.length > 0, `card ${card.id} must have title`)
    assert.ok(typeof card.summary === 'string' && card.summary.length > 0, `card ${card.id} must have summary`)
    assert.ok(typeof card.href === 'string' && card.href.length > 0, `card ${card.id} must have href`)
    assert.ok(typeof card.ctaLabel === 'string' && card.ctaLabel.length > 0, `card ${card.id} must have ctaLabel`)
    assert.ok(
      card.badge === undefined || ['pro', 'free', 'support', 'info'].includes(card.badge),
      `card ${card.id} must have valid badge`,
    )
  }
}

function testModelHasProMembershipCard(): void {
  const cards = getDashboardCards()
  const proCard = cards.find((card) => card.id === 'pro-membership')
  assert.ok(proCard, 'model must have pro-membership card')
  assert.equal(proCard?.href, '/upgrade')
  assert.equal(proCard?.badge, 'pro')
}

function testModelHasProgrammeCard(): void {
  const cards = getDashboardCards()
  const programmeCard = cards.find((card) => card.id === 'programme')
  assert.ok(programmeCard, 'model must have programme card')
  assert.equal(programmeCard?.href, '/programme')
}

function testModelHasSupportCard(): void {
  const cards = getDashboardCards()
  const supportCard = cards.find((card) => card.id === 'support')
  assert.ok(supportCard, 'model must have support card')
  assert.equal(supportCard?.href, '/support')
}

function testModelHasPartnerReferralCard(): void {
  const cards = getDashboardCards()
  const partnerCard = cards.find((card) => card.id === 'partner-referral')
  assert.ok(partnerCard, 'model must have partner-referral card')
  assert.equal(partnerCard?.href, '/partner-referral')
}

function testAccessSummaryHasCorrectLabels(): void {
  const model = getDashboardModel()
  assert.match(model.accessSummary.proDescription, /single paid.*JPV Bootcamp membership|Pro.*full course access/i)
  assert.equal(model.accessSummary.isPlaceholder, true)
}

function testAccessSummaryFreeDescriptionIsCorrect(): void {
  const model = getDashboardModel()
  assert.match(model.accessSummary.freeDescription, /controlled non-paid access/i)
}

function testAllCardIdsAreUnique(): void {
  const cards = getDashboardCards()
  const ids = cards.map((card) => card.id)
  const uniqueIds = new Set(ids)
  assert.equal(ids.length, uniqueIds.size, 'card ids must be unique')
}

function testLegacyTermsNotPresent(): void {
  const filesToCheck = [
    'src/lib/portal/memberDashboardModel.ts',
    'src/app/(frontend)/dashboard/page.tsx',
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
    'src/lib/portal/memberDashboardModel.ts',
    'src/app/(frontend)/dashboard/page.tsx',
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
  testDashboardRouteExists()
  testDashboardHasStaticUpgradeLink()
  testDashboardHasStaticPortalLink()
  testDashboardRendersCardsFromModel()
  testDashboardMentionsPro()
  testDashboardMentionsFreeAccess()
  testDashboardHasPlaceholderWording()
  testModelReturnsExpectedCardCount()
  testAllCardsHaveRequiredFields()
  testModelHasProMembershipCard()
  testModelHasProgrammeCard()
  testModelHasSupportCard()
  testModelHasPartnerReferralCard()
  testAccessSummaryHasCorrectLabels()
  testAccessSummaryFreeDescriptionIsCorrect()
  testAllCardIdsAreUnique()
  testLegacyTermsNotPresent()
  testNoDbNetworkOrMigrationCommands()
  console.log('member_portal_mvp.test.ts passed')
} catch (error) {
  console.error('member_portal_mvp.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}