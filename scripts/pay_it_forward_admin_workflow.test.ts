import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path: string): string {
  assert.ok(existsSync(path), `expected file to exist: ${path}`)
  return readFileSync(path, 'utf8')
}

const confirmation = read('src/app/(frontend)/thank-you/sponsor/page.tsx')
assert.match(confirmation, /PublicInformationShell/)
assert.match(confirmation, /ThankYouClient/)
assert.match(confirmation, /Payment received/)
assert.match(confirmation, /sponsored[\s\S]*membership/i)

const sponsoredPage = read('src/components/sponsored-pay-it-forward.tsx')
assert.match(sponsoredPage, /Available now/)
assert.match(sponsoredPage, /funded membership/)
assert.match(sponsoredPage, /text-5xl/)

const webhook = read('src/lib/stripe-webhook-handler.ts')
assert.match(webhook, /checkout\.session\.async_payment_succeeded/)
assert.match(webhook, /notifySponsoredSeatPurchase/)

const notifications = read('src/lib/sponsored-seat-notifications.ts')
assert.match(notifications, /stripePaymentIntentId/)
assert.match(notifications, /payload\.find/)
assert.match(notifications, /payload\.create/)
assert.match(notifications, /pay_it_forward_payload_record_create_failed[\s\S]*throw error/)

const queue = read('src/components/payload/PayItForwardAdminQueue.tsx')
assert.match(queue, /New member account/)
assert.match(queue, /Existing member account/)
assert.match(queue, /Send checkout link/)
assert.match(queue, /api\/admin\/pay-it-forward\/grant/)

const grant = read('src/lib/sponsored-admin-grant.ts')
assert.match(grant, /FOR UPDATE/)
assert.match(grant, /SKIP LOCKED/)
assert.match(grant, /reservedByApplicationId/)
assert.match(grant, /sponsored\.application\.checkout_sent/)
assert.match(grant, /createSponsoredRecipientCheckout/)
assert.match(grant, /SKIP LOCKED/)

const route = read('src/app/api/admin/pay-it-forward/grant/route.ts')
assert.match(route, /isPayloadAdminIdentity/)
assert.match(route, /grantSponsoredApplication/)

const collection = read('src/collections/membership-support/PayItForward.ts')
assert.match(collection, /afterList/)
assert.match(collection, /PayItForwardAdminQueue/)

const dashboard = read('src/components/payload/JPVAdminDashboard.tsx')
assert.match(dashboard, /Pay-it-forward seats funded/)
assert.match(dashboard, /Sponsored applications to review/)

console.log('pay_it_forward_admin_workflow.test.ts passed')
