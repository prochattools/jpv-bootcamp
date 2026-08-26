import { getPayload } from 'payload'
import { Resend } from 'resend'

import config from '@payload-config'
import {
  processQueuedPayloadEmails,
  type PayloadEmailSenderConfig,
} from '../../src/lib/payloadCourse/emailSender'

const apply = process.argv.includes('--apply')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : 25
const eventIdArg = process.argv.find((arg) => arg.startsWith('--event-id='))
const targetEventId = eventIdArg ? eventIdArg.split('=')[1]?.trim() : null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value.trim()
}

function getEnv(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

function emailConfig(requireSender: boolean): PayloadEmailSenderConfig {
  const from = getEnv('RESEND_FROM') ?? getEnv('EMAIL_FROM')
  if (!from && requireSender) {
    throw new Error('Missing required env var: RESEND_FROM or EMAIL_FROM')
  }

  return {
    from: from ?? 'JPV Bootcamp <dry-run@example.invalid>',
    replyTo: getEnv('EMAIL_REPLY_TO'),
  }
}

async function main() {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('--limit must be a positive number.')
  }

  if (!targetEventId && apply) {
    throw new Error(
      'Refusing bulk apply without explicit targeting. Use --apply --event-id=<id> to target exactly one event.'
    )
  }

  console.log(
    apply
      ? `[payload-email] Sending queued Payload email events${targetEventId ? ` (event: [redacted])` : ''}`
      : `[payload-email:dry-run] Previewing up to ${limit} queued Payload email events${targetEventId ? ` (event: [redacted])` : ''}`
  )

  const payload = await getPayload({ config })
  const resend = apply ? new Resend(requireEnv('RESEND_API_KEY')) : undefined
  const outcomes = await processQueuedPayloadEmails(payload, {
    limit,
    dryRun: !apply,
    resend,
    emailConfig: emailConfig(apply),
    targetEventId,
  })

  const summary = outcomes.reduce<Record<string, number>>((acc, outcome) => {
    acc[outcome.status] = (acc[outcome.status] ?? 0) + 1
    return acc
  }, {})

  console.log(`[payload-email${apply ? '' : ':dry-run'}] Summary`, {
    total: outcomes.length,
    ...summary,
  })

  for (const outcome of outcomes) {
    console.log(
      JSON.stringify({
        eventId: '[redacted]',
        templateKey: outcome.templateKey,
        toEmail: outcome.toEmail ? '[redacted]' : null,
        status: outcome.status,
        reason: outcome.reason ?? null,
        resendEmailId: outcome.resendEmailId ? '[redacted]' : null,
      })
    )
  }

  if (!apply) {
    console.log('[payload-email:dry-run] No emails were sent. Re-run with --apply to send.')
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[payload-email] failed', {
      message: (error as Error).message,
    })
    process.exit(1)
  })
