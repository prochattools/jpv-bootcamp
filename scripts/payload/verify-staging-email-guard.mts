import { randomUUID } from 'node:crypto'

import { getPayload } from 'payload'
import config from '@payload-config'

import { processQueuedPayloadEmails } from '../../src/lib/payloadCourse/emailSender'
import {
  assertStagingEmailGuardVerificationBoundary,
  STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT,
} from './staging-email-guard-verification'

async function main(): Promise<void> {
  assertStagingEmailGuardVerificationBoundary(process.env)

  const payload = await getPayload({ config })
  const verificationId = randomUUID()
  let providerSendCount = 0

  const fixture = await payload.create({
    collection: 'payload_email_events',
    overrideAccess: true,
    data: {
      displayName: `Staging email guard verification ${verificationId}`,
      toEmail: STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT,
      templateKey: 'member-email-verification',
      deliveryStatus: 'queued',
      retryCount: 0,
      dedupeKey: `staging-email-guard-verification:${verificationId}`,
      metadata: {
        verificationFixture: true,
        verificationId,
        displayName: 'Staging verification',
        verificationUrl: 'https://example.test/verification-not-sent',
      },
    },
  })

  const resend = {
    emails: {
      async send() {
        providerSendCount += 1
        return { data: { id: 'unexpected-provider-call' } }
      },
    },
  }

  const workerArgs = {
    limit: 1,
    resend,
    emailConfig: {
      from: 'JPV Bootcamp <verification@example.invalid>',
      replyTo: null,
    },
    targetEventId: String(fixture.id),
  }

  const firstOutcome = await processQueuedPayloadEmails(payload, workerArgs)
  const afterFirst = await payload.findByID({
    collection: 'payload_email_events',
    id: fixture.id,
    overrideAccess: true,
    depth: 0,
  })

  const firstRetryCount = Number(afterFirst.retryCount ?? 0)
  if (firstOutcome.length !== 1 || firstOutcome[0]?.reason !== 'blocked_by_staging_guard') {
    throw new Error('Verification failed: first worker run did not report blocked_by_staging_guard')
  }
  if (afterFirst.deliveryStatus !== 'blocked_by_staging_guard') {
    throw new Error('Verification failed: fixture did not reach blocked_by_staging_guard')
  }
  if (providerSendCount !== 0) {
    throw new Error('Verification failed: provider send was invoked')
  }

  const secondOutcome = await processQueuedPayloadEmails(payload, workerArgs)
  const afterSecond = await payload.findByID({
    collection: 'payload_email_events',
    id: fixture.id,
    overrideAccess: true,
    depth: 0,
  })
  const secondRetryCount = Number(afterSecond.retryCount ?? 0)

  if (secondOutcome.length !== 0) {
    throw new Error('Verification failed: terminal fixture was processed a second time')
  }
  if (secondRetryCount !== firstRetryCount) {
    throw new Error('Verification failed: retry count changed after terminal skip')
  }
  if (providerSendCount !== 0) {
    throw new Error('Verification failed: provider send was invoked on second run')
  }

  console.log(JSON.stringify({
    ok: true,
    eventId: String(fixture.id),
    firstOutcome: 'blocked_by_staging_guard',
    deliveryStatus: afterSecond.deliveryStatus,
    firstRetryCount,
    secondOutcome: 'skipped_terminal_event',
    secondRetryCount,
    providerSendCount,
  }))
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[staging-email-guard-verification] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    process.exit(1)
  })
