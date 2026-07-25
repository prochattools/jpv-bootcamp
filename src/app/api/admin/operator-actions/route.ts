import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

const BILLING_ACTIONS = new Set(['sync_subscription', 'cancel_at_period_end', 'resume_subscription'])
const EMAIL_ACTIONS = new Set(['retry_delivery'])

const PROVIDER_ID_PATTERNS = [
  /^sub_/,
  /^cus_/,
  /^pi_/,
  /^pm_/,
  /^price_/,
  /^prod_/,
  /^evt_/,
  /^cs_/,
  /^in_/,
  /^si_/,
]

function isProviderExternalId(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return PROVIDER_ID_PATTERNS.some((pattern) => pattern.test(value))
}

function isValidPayloadId(value: unknown): value is string | number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return true
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    if (isProviderExternalId(trimmed)) return false
    return true
  }
  return false
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)
    if (!session.administratorId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }

    const body = await req.json() as Record<string, unknown>
    const collection = typeof body.collection === 'string' ? body.collection : ''
    const actionType = typeof body.actionType === 'string' ? body.actionType : ''

    if (collection === 'payload_billing_actions') {
      if (!BILLING_ACTIONS.has(actionType)) {
        return NextResponse.json(
          { error: 'unsupported_action', message: 'Invalid billing action type.' },
          { status: 400 },
        )
      }

      if (!isValidPayloadId(body.subscription)) {
        return NextResponse.json(
          { error: 'invalid_input', message: 'A valid Payload subscription record ID is required.' },
          { status: 400 },
        )
      }
      const subscriptionId = body.subscription

      const payload = await getPayload({ config })

      let subscriptionRecord
      try {
        subscriptionRecord = await payload.findByID({
          collection: 'payload_subscriptions',
          id: subscriptionId as string | number,
          depth: 0,
          overrideAccess: true,
        })
      } catch {
        return NextResponse.json(
          { error: 'record_not_found', message: 'Subscription record not found.' },
          { status: 404 },
        )
      }

      if (!subscriptionRecord || !subscriptionRecord.id) {
        return NextResponse.json(
          { error: 'record_not_found', message: 'Subscription record not found.' },
          { status: 404 },
        )
      }

      const doc = await payload.create({
        collection: 'payload_billing_actions',
        data: {
          displayName: `${actionType} subscription ${String(subscriptionRecord.id)}`,
          actionType,
          subscription: subscriptionRecord.id,
          requestedBy: session.administratorId,
          status: 'pending',
          note: typeof body.note === 'string' ? body.note : undefined,
        } as any,
        overrideAccess: true,
        user: { id: session.administratorId, collection: 'payload_users' },
      })

      return NextResponse.json(
        { id: doc.id, status: doc.status, actionType: doc.actionType },
        { status: 201 },
      )
    }

    if (collection === 'payload_email_actions') {
      if (!EMAIL_ACTIONS.has(actionType)) {
        return NextResponse.json(
          { error: 'unsupported_action', message: 'Invalid email action type.' },
          { status: 400 },
        )
      }

      if (!isValidPayloadId(body.emailEvent)) {
        return NextResponse.json(
          { error: 'invalid_input', message: 'A valid Payload email event record ID is required.' },
          { status: 400 },
        )
      }
      const emailEventId = body.emailEvent

      const payload = await getPayload({ config })

      let emailEventRecord
      try {
        emailEventRecord = await payload.findByID({
          collection: 'payload_email_events',
          id: emailEventId as string | number,
          depth: 0,
          overrideAccess: true,
        })
      } catch {
        return NextResponse.json(
          { error: 'record_not_found', message: 'Email event record not found.' },
          { status: 404 },
        )
      }

      if (!emailEventRecord || !emailEventRecord.id) {
        return NextResponse.json(
          { error: 'record_not_found', message: 'Email event record not found.' },
          { status: 404 },
        )
      }

      const doc = await payload.create({
        collection: 'payload_email_actions',
        data: {
          displayName: `Retry email event ${String(emailEventRecord.id)}`,
          actionType,
          emailEvent: emailEventRecord.id,
          requestedBy: session.administratorId,
          status: 'pending',
          note: typeof body.note === 'string' ? body.note : undefined,
        } as any,
        overrideAccess: true,
        user: { id: session.administratorId, collection: 'payload_users' },
      })

      return NextResponse.json(
        { id: doc.id, status: doc.status, actionType: doc.actionType },
        { status: 201 },
      )
    }

    return NextResponse.json(
      { error: 'unsupported_collection', message: 'Use payload_billing_actions or payload_email_actions.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('POST /api/admin/operator-actions error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'internal_error', message: 'The request could not be completed.' },
      { status: 500 },
    )
  }
}
