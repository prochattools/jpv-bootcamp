import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function main(): void {
  // Front-end entry points
  const frontendPagePath = 'src/app/(frontend)/page.tsx'
  const memberCheckoutButtonsPath = 'src/components/portal/MemberCheckoutButtons.tsx'
  const startMemberCheckoutPath = 'src/lib/actions/startMemberCheckout.ts'
  const stripeCheckoutRoutePath = 'src/app/api/stripe/checkout/route.ts'
  const sponsoredPagePath = 'src/app/(frontend)/sponsored/page.tsx'

  // Documentation
  const roadmapPath = 'docs/client/ROADMAP_PROGRESS_STATUS.md'
  const goLiveSummaryPath = 'docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md'
  const docxPath = 'docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_4.docx'

  // Verify front-end files exist
  assert.ok(existsSync(frontendPagePath), `${frontendPagePath} should exist`)
  assert.ok(existsSync(memberCheckoutButtonsPath), `${memberCheckoutButtonsPath} should exist`)
  assert.ok(existsSync(startMemberCheckoutPath), `${startMemberCheckoutPath} should exist`)
  assert.ok(existsSync(stripeCheckoutRoutePath), `${stripeCheckoutRoutePath} should exist`)
  assert.ok(existsSync(sponsoredPagePath), `${sponsoredPagePath} should exist`)
  assert.ok(existsSync(docxPath), `${docxPath} should exist`)

  // Read front-end source
  const frontendPage = readFileSync(frontendPagePath, 'utf8')
  const memberCheckoutButtons = readFileSync(memberCheckoutButtonsPath, 'utf8')
  const startMemberCheckout = readFileSync(startMemberCheckoutPath, 'utf8')
  const stripeCheckoutRoute = readFileSync(stripeCheckoutRoutePath, 'utf8')
  const sponsoredPage = readFileSync(sponsoredPagePath, 'utf8')

  // Read docs
  const roadmap = readFileSync(roadmapPath, 'utf8')
  const goLiveSummary = readFileSync(goLiveSummaryPath, 'utf8')

  // Verify Pro membership is presented
  assert.match(frontendPage, /Pro.*membership|membership.*Pro/i, 'Landing page should mention Pro membership')

  // Verify the public CTA enters authenticated portal billing with approved Pro terms
  assert.match(frontendPage, /ctaHref: "\/portal\/billing"/, 'Landing page should route Pro checkout through authenticated portal billing')
  assert.match(frontendPage, /£80\/month/, 'Landing page should show the approved monthly price')
  assert.match(frontendPage, /Initial 12-month commitment/, 'Landing page should state the initial commitment')
  assert.match(frontendPage, /£880 annual option paid upfront/, 'Landing page should show the approved annual option')
  assert.ok(!frontendPage.includes('plan=vip'), 'Landing page should not use plan=vip')
  assert.ok(!frontendPage.includes('plan=exhibitor'), 'Landing page should not use plan=exhibitor')

  // Verify member checkout uses pro
  assert.match(memberCheckoutButtons, /const PLAN = 'pro'/, 'MemberCheckoutButtons should use PLAN=pro')
  assert.ok(!memberCheckoutButtons.includes('plan=vip'), 'MemberCheckoutButtons should not use vip')

  // Verify server action accepts plan=pro only
  assert.match(startMemberCheckout, /if \(plan !== 'pro'\)/, 'startMemberCheckout should reject non-pro plans')
  assert.match(startMemberCheckout, /error: 'invalid_plan'/, 'startMemberCheckout should return invalid_plan error')

  // Verify stripe checkout route validates plan=pro
  assert.match(stripeCheckoutRoute, /parseCheckoutPlan/, 'Stripe checkout route should parse plan')
  assert.match(stripeCheckoutRoute, /plan.*pro/, 'Stripe checkout route should handle pro plan')

  // Verify sponsored path exists and mentions support/pay-it-forward
  assert.match(sponsoredPage, /[Ss]ponsored|[Ss]upport|pay-it-forward/i, 'Sponsored page should mention support or pay-it-forward')

  // Verify support/pay-it-forward link visible on landing page
  assert.match(frontendPage, /\/sponsored/, 'Landing page should link to /sponsored path')
  assert.match(frontendPage, /[Ss]upport|pay-it-forward|Apply for support/i, 'Landing page should mention support or pay-it-forward')

  // Verify no legacy language
  assert.ok(!frontendPage.includes('VIP'), 'Landing page should not use VIP')
  assert.ok(!frontendPage.includes('vip'), 'Landing page should not use vip')
  assert.ok(!frontendPage.includes('exhibitor'), 'Landing page should not use exhibitor')
  assert.ok(!frontendPage.includes('WordPress'), 'Landing page should not mention WordPress')
  assert.ok(!frontendPage.includes('FluentCRM'), 'Landing page should not mention FluentCRM')
  assert.ok(!frontendPage.includes('old portal'), 'Landing page should not mention old portal')

  // Verify roadmap mentions dates and content dependency
  assert.match(roadmap, /15 July 2026/, 'Roadmap should mention 15 July content deadline')
  assert.match(roadmap, /22 July 2026/, 'Roadmap should mention 22 July front-end milestone')
  assert.match(roadmap, /23 July 2026/, 'Roadmap should mention 23 July handover buffer')
  assert.match(roadmap, /24 July 2026/, 'Roadmap should mention 24 July finished-by date')
  assert.match(roadmap, /No migrations have been applied|No migrations applied/i, 'Roadmap should state no migrations applied')

  // Verify go-live summary has same dates
  assert.match(goLiveSummary, /22 July 2026/, 'Go-live summary should mention 22 July front-end milestone')
  assert.match(goLiveSummary, /15 July 2026/, 'Go-live summary should mention 15 July content deadline')

  // Verify front-end checkout sources are clean (no DB secrets or migrations in client-side code)
  assert.ok(!frontendPage.includes('DATABASE_URL'), 'Front-end page should not contain DATABASE_URL')
  assert.ok(!frontendPage.includes('prisma migrate'), 'Front-end page should not reference migrations')
  assert.ok(!memberCheckoutButtons.includes('DATABASE_URL'), 'Checkout buttons should not contain DATABASE_URL')

  console.log('frontend_milestone_static.test.ts passed')
}

main()
