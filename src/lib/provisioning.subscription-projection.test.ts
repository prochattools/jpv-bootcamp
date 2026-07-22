import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const [provisioning, webhook] = await Promise.all([
    readFile('src/lib/provisioning.ts', 'utf8'),
    readFile('src/lib/stripe-webhook-handler.ts', 'utf8'),
  ])

  for (const eventType of [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]) {
    assert.match(webhook, new RegExp(eventType.replaceAll('.', '\\.')))
  }

  for (const field of [
    'stripePriceId',
    'subscriptionStatus',
    'subscriptionCurrentPeriodEnd',
    'subscriptionCancelAtPeriodEnd',
    'subscriptionUpdatedAt',
  ]) {
    assert.match(provisioning, new RegExp(field))
  }

  assert.match(provisioning, /stripeSubscriptionId: subscription\.id/)
  assert.match(provisioning, /status: nextStatus/)
  assert.match(provisioning, /lastEventId: eventId \?\? null/)
  assert.match(webhook, /constructEvent/)
  assert.match(webhook, /atomicCheckAndMarkProcessed/)
  assert.match(webhook, /markProcessed/)
  assert.doesNotMatch(webhook, /sendWelcomeEmail/)

  console.log('subscription projection tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
