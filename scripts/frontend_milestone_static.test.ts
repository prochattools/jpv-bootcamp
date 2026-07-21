import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function main(): void {
  const frontendPagePath = 'src/app/(frontend)/page.tsx'
  const upgradePagePath = 'src/app/(frontend)/upgrade/page.tsx'
  const memberCheckoutButtonsPath = 'src/components/portal/MemberCheckoutButtons.tsx'
  const startMemberCheckoutPath = 'src/lib/actions/startMemberCheckout.ts'
  const stripeCheckoutRoutePath = 'src/app/api/stripe/checkout/route.ts'
  const sponsoredPagePath = 'src/app/(frontend)/sponsored/page.tsx'
  const roadmapPath = 'docs/client/ROADMAP_PROGRESS_STATUS.md'
  const goLiveSummaryPath = 'docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md'
  const docxPath = 'docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_4.docx'

  for (const path of [
    frontendPagePath,
    upgradePagePath,
    memberCheckoutButtonsPath,
    startMemberCheckoutPath,
    stripeCheckoutRoutePath,
    sponsoredPagePath,
    roadmapPath,
    goLiveSummaryPath,
    docxPath,
  ]) {
    assert.ok(existsSync(path), `${path} should exist`)
  }

  const frontendPage = readFileSync(frontendPagePath, 'utf8')
  const upgradePage = readFileSync(upgradePagePath, 'utf8')
  const memberCheckoutButtons = readFileSync(memberCheckoutButtonsPath, 'utf8')
  const startMemberCheckout = readFileSync(startMemberCheckoutPath, 'utf8')
  const stripeCheckoutRoute = readFileSync(stripeCheckoutRoutePath, 'utf8')
  const sponsoredPage = readFileSync(sponsoredPagePath, 'utf8')
  const roadmap = readFileSync(roadmapPath, 'utf8')
  const goLiveSummary = readFileSync(goLiveSummaryPath, 'utf8')

  assert.match(frontendPage, /JPV Bootcamp Membership — Monthly/)
  assert.match(frontendPage, /JPV Bootcamp Membership — Annual/)
  assert.match(frontendPage, /£80\/month/)
  assert.match(frontendPage, /£800\/year/)
  assert.match(frontendPage, /No minimum commitment/)
  assert.match(frontendPage, /Automatically renews annually unless cancelled/)
  assert.match(frontendPage, /ctaHref: "\/upgrade"/)
  assert.doesNotMatch(frontendPage, /name: "Free"|name: "Pro"|Initial 12-month commitment|£880/)

  assert.match(upgradePage, /plan=membership/)
  assert.match(upgradePage, /billing=monthly/)
  assert.match(upgradePage, /billing=annual/)
  assert.match(upgradePage, /recurring_payment_accepted=/)
  assert.match(upgradePage, /£80\/month/)
  assert.match(upgradePage, /£800\/year/)
  assert.match(upgradePage, /voucher or[\s\S]*pay-it-forward code/)

  assert.match(memberCheckoutButtons, /const PLAN = 'membership'/)
  assert.match(memberCheckoutButtons, /Recurring-payment acknowledgment/)
  assert.doesNotMatch(memberCheckoutButtons, /plan=vip|plan=exhibitor|Start Pro/)

  assert.match(startMemberCheckout, /if \(plan !== 'membership'\)/)
  assert.match(startMemberCheckout, /allow_promotion_codes: true/)
  assert.match(startMemberCheckout, /payment_method_collection: 'always'/)
  assert.match(startMemberCheckout, /phone_number_collection: \{ enabled: true \}/)
  assert.match(startMemberCheckout, /error: 'invalid_plan'/)

  assert.match(stripeCheckoutRoute, /parseCheckoutPlan/)
  assert.match(stripeCheckoutRoute, /recurring_payment_accepted/)
  assert.match(stripeCheckoutRoute, /Recurring-payment acknowledgment is required before checkout/)
  assert.match(stripeCheckoutRoute, /allow_promotion_codes: true/)
  assert.match(stripeCheckoutRoute, /payment_method_collection: 'always'/)
  assert.match(stripeCheckoutRoute, /phone_number_collection: \{ enabled: true \}/)
  assert.doesNotMatch(stripeCheckoutRoute, /plan.*vip|plan.*exhibitor/)

  assert.match(sponsoredPage, /[Ss]ponsored|[Ss]upport|pay-it-forward/i)
  assert.match(frontendPage, /\/sponsored/)
  assert.match(frontendPage, /[Ss]upport|pay-it-forward/i)

  for (const legacy of ['VIP', 'vip', 'exhibitor', 'WordPress', 'FluentCRM', 'old portal']) {
    assert.ok(!frontendPage.includes(legacy), `Landing page should not use ${legacy}`)
  }

  assert.match(roadmap, /15 July 2026/)
  assert.match(roadmap, /22 July 2026/)
  assert.match(roadmap, /23 July 2026/)
  assert.match(roadmap, /24 July 2026/)
  assert.match(roadmap, /does not authorize further staging writes or any production migration/i)
  assert.match(goLiveSummary, /22 July 2026/)
  assert.match(goLiveSummary, /15 July 2026/)

  for (const source of [frontendPage, upgradePage, memberCheckoutButtons]) {
    assert.ok(!source.includes('DATABASE_URL'))
    assert.ok(!source.includes('prisma migrate'))
  }

  console.log('frontend_milestone_static.test.ts passed')
}

main()
