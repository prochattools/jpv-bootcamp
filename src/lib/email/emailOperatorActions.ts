import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

export const EMAIL_OPERATOR_ACTIONS = ['retry_delivery'] as const
export type EmailOperatorAction = (typeof EMAIL_OPERATOR_ACTIONS)[number]

export class EmailOperatorActionError extends Error {
  constructor(
    readonly code:
      | 'email_event_missing'
      | 'email_event_not_retryable'
      | 'email_event_already_requeued'
      | 'invalid_operator_action',
    message: string,
  ) {
    super(message)
    this.name = 'EmailOperatorActionError'
  }
}

function relationshipId(value: unknown): PayloadId | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function isEmailOperatorAction(value: unknown): value is EmailOperatorAction {
  return value === 'retry_delivery'
}

async function findEmailEvent(
  payload: PayloadCourseWriteAPI,
  eventId: PayloadId,
): Promise<PayloadDocument> {
  try {
    return await payload.findByID({
      collection: 'payload_email_events',
      id: eventId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    throw new EmailOperatorActionError(
      'email_event_missing',
      'The selected email event was not found.',
    )
  }
}

export async function executeEmailOperatorAction(params: {
  payload: PayloadCourseWriteAPI
  actionRecordId: PayloadId
  emailEventId: PayloadId
  action: EmailOperatorAction
  administratorId: PayloadId
  note?: string | null
  now?: Date
}): Promise<{
  action: EmailOperatorAction
  actionRecordId: string
  emailEventId: string
  status: 'completed' | 'skipped'
  retryCount: number
  queuedAt: string
}> {
  if (!isEmailOperatorAction(params.action)) {
    throw new EmailOperatorActionError(
      'invalid_operator_action',
      'Unsupported email operator action.',
    )
  }

  const event = await findEmailEvent(params.payload, params.emailEventId)
  const deliveryStatus = text(event.deliveryStatus)
  const metadata = metadataRecord(event.metadata)
  const lastActionRecordId = text(metadata.lastRetryActionRecordId)
  const actionRecordId = String(params.actionRecordId)

  if (lastActionRecordId === actionRecordId && deliveryStatus === 'queued') {
    return {
      action: params.action,
      actionRecordId,
      emailEventId: String(event.id),
      status: 'skipped',
      retryCount: Number(event.retryCount ?? metadata.retryCount ?? 0),
      queuedAt: text(event.lastRetryRequestedAt) ?? text(metadata.lastRetryRequestedAt) ?? new Date(0).toISOString(),
    }
  }

  if (deliveryStatus !== 'failed') {
    throw new EmailOperatorActionError(
      deliveryStatus === 'queued'
        ? 'email_event_already_requeued'
        : 'email_event_not_retryable',
      deliveryStatus === 'queued'
        ? 'This email event is already queued.'
        : `Only failed email events can be retried. Current status: ${deliveryStatus ?? 'unknown'}.`,
    )
  }

  const now = params.now ?? new Date()
  const queuedAt = now.toISOString()
  const retryCount = Math.max(0, Number(event.retryCount ?? metadata.retryCount ?? 0)) + 1
  const note = text(params.note)

  await params.payload.update({
    collection: 'payload_email_events',
    id: event.id,
    data: {
      deliveryStatus: 'queued',
      resendEmailId: null,
      sentAt: null,
      deliveredAt: null,
      failureReason: null,
      retryCount,
      lastRetryRequestedAt: queuedAt,
      lastRetryRequestedBy: params.administratorId,
      metadata: {
        ...metadata,
        retryCount,
        lastRetryActionRecordId: actionRecordId,
        lastRetryRequestedAt: queuedAt,
        lastRetryRequestedBy: String(params.administratorId),
        ...(note ? { lastRetryNote: note } : {}),
      },
    },
    overrideAccess: true,
    overrideLock: true,
  })

  return {
    action: params.action,
    actionRecordId,
    emailEventId: String(event.id),
    status: 'completed',
    retryCount,
    queuedAt,
  }
}

function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof EmailOperatorActionError) {
    return { code: error.code, message: error.message }
  }
  return {
    code: 'email_operator_action_failed',
    message: 'Email retry failed. Review the event and queue configuration.',
  }
}

export async function processPayloadEmailAction(params: {
  doc: PayloadDocument
  operation: 'create' | 'update'
  req: {
    payload: PayloadCourseWriteAPI
    user?: { id?: PayloadId; collection?: string } | null
  }
}): Promise<PayloadDocument> {
  if (params.operation !== 'create' || !isEmailOperatorAction(params.doc.actionType)) {
    return params.doc
  }

  const administrator = params.req.user
  const emailEventId = relationshipId(params.doc.emailEvent)
  if (!administrator?.id || administrator.collection !== 'payload_users' || emailEventId === null) {
    return params.doc
  }

  try {
    const result = await executeEmailOperatorAction({
      payload: params.req.payload,
      actionRecordId: params.doc.id,
      emailEventId,
      action: params.doc.actionType,
      administratorId: administrator.id,
      note: text(params.doc.note),
    })

    // Use db.updateOne to bypass relationship filterOptions re-validation on update.
    // The emailEvent relationship is already set on the record; we only need to
    // write status/result fields. payload.update() re-validates all fields including
    // the filterOptions constraint, which fails once the event moves to 'queued'.
    const payloadDb = (params.req.payload as unknown as { db: { updateOne(args: { collection: string; id: unknown; data: unknown }): Promise<void> } }).db
    await payloadDb.updateOne({
      collection: 'payload_email_actions',
      id: params.doc.id,
      data: {
        displayName: `Retry email event ${result.emailEventId}`,
        requestedBy: administrator.id,
        status: result.status,
        completedAt: result.queuedAt,
        result,
      },
    })
    return { ...params.doc, status: result.status, completedAt: result.queuedAt, result }
  } catch (error) {
    const failure = safeFailure(error)
    console.error('email_operator_action_failed', {
      actionRecordId: String(params.doc.id),
      code: failure.code,
    })

    const payloadDb = (params.req.payload as unknown as { db: { updateOne(args: { collection: string; id: unknown; data: unknown }): Promise<void> } }).db
    await payloadDb.updateOne({
      collection: 'payload_email_actions',
      id: params.doc.id,
      data: {
        requestedBy: administrator.id,
        status: 'failed',
        completedAt: new Date().toISOString(),
        result: failure,
      },
    })
    return { ...params.doc, status: 'failed', result: failure }
  }
}
