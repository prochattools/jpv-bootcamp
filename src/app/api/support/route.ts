import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import payloadConfig from '@/payload.config'
import { getServerConfig } from '@/lib/config'
import { isValidInternationalPhone, normalizePhone } from '@/lib/normalize-phone'
import { guardPublicRequest } from '@/lib/publicRequestGuard'
import {
  getPublicRequestApplicationOrigin,
  logPublicRequestGuard,
  publicRequestFailureResponse,
  publicRequestRateLimiter,
  trustPublicRequestProxyHeaders,
} from '@/lib/publicRequestRoute'
import { queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import {
  SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY,
  SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY,
} from '@/lib/payloadCourse/systemEmailTemplates'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  createSupportIntakeService,
  type SupportRequestCreateData,
  type SupportRequestUpdateData,
} from '@/lib/support/supportIntake'
import prisma from '@/libs/prisma'

const SUPPORT_MAX_BYTES = 8 * 1024

const supportFields = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 120 },
  email: { type: 'email', required: true, maxLength: 320 },
  phone: { type: 'string', required: true, minLength: 7, maxLength: 40 },
  question: { type: 'string', required: true, minLength: 10, maxLength: 2_000 },
  source: { type: 'string', maxLength: 80 },
  page: { type: 'string', maxLength: 200 },
} as const

function safeSupportLog(event: {
  event: 'support_intake'
  decision: 'accepted' | 'duplicate' | 'persistence_failed' | 'queue_failed'
  reason: string
}): void {
  console.info(event.event, {
    decision: event.decision,
    reason: event.reason,
  })
}

export async function POST(req: NextRequest) {
  const guarded = await guardPublicRequest(req, {
    namespace: 'public-support',
    methods: ['POST'],
    bodyType: 'json',
    fields: supportFields,
    applicationOrigin: getPublicRequestApplicationOrigin(),
    missingOrigin: 'reject',
    maxBytes: SUPPORT_MAX_BYTES,
    allowUnknownFields: false,
    trustProxyHeaders: trustPublicRequestProxyHeaders(),
    rateLimit: {
      limiter: publicRequestRateLimiter,
      limit: 3,
      windowMs: 60_000,
      identityField: 'email',
      backendFailure: 'deny',
    },
    logger: logPublicRequestGuard,
  })

  if (guarded.ok === false) {
    return publicRequestFailureResponse(guarded)
  }

  const phone = normalizePhone(guarded.data.phone)
  if (!phone || !isValidInternationalPhone(phone)) {
    return NextResponse.json({ ok: false, reason: 'invalid_phone' }, { status: 400 })
  }

  const service = createSupportIntakeService({
    async createRequest(data: SupportRequestCreateData) {
      return prisma.supportRequest.create({ data })
    },
    async updateRequest(id: string, data: SupportRequestUpdateData) {
      await prisma.supportRequest.update({ where: { id }, data })
    },
    async queueNotification(input) {
      const payload = await getPayload({ config: payloadConfig })
      const payloadApi = payload as unknown as PayloadCourseWriteAPI
      const { supportTo } = getServerConfig().email

      await queueAndAttemptEmailEvent(payloadApi, {
        toEmail: supportTo,
        templateKey: SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY,
        dedupeKey: input.dedupeKey,
        displayName: 'Support request pending review',
        metadata: {
          purpose: 'support_request_pending_review',
          supportRequestId: input.requestId,
          reviewStatus: input.reviewStatus,
          requesterEmail: input.requesterEmail,
          requesterName: input.requesterName,
          requesterPhone: input.requesterPhone,
        },
      })

      await queueAndAttemptEmailEvent(payloadApi, {
        toEmail: input.requesterEmail,
        templateKey: SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY,
        dedupeKey: `support-request-acknowledgement:${input.requestId}`,
        displayName: 'Support request received',
        metadata: {
          purpose: 'support_request_received',
          supportRequestId: input.requestId,
          displayName: input.requesterName,
        },
      })
    },
    now: () => new Date(),
    log: safeSupportLog,
  })

  const result = await service({
    normalizedEmail: guarded.data.email,
    name: guarded.data.name,
    phone,
    question: guarded.data.question,
    source: guarded.data.source,
    page: guarded.data.page,
  })

  if (result.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: result.code,
        retryable: true,
      },
      { status: 503 },
    )
  }

  return NextResponse.json({
    ok: true,
    accepted: true,
    duplicate: result.duplicate,
  })
}
