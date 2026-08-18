import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import {
  removeMemberCoverImage,
  uploadMemberCoverImage,
} from '@/lib/members/memberCoverImage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(reason: string, status: number): Response {
  return Response.json({ ok: false, reason }, { status })
}

export async function POST(request: Request): Promise<Response> {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.member?.id) return errorResponse('unauthorized', 401)
  if (session.member.accountStatus !== 'active') return errorResponse('account_ineligible', 403)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('invalid_form_data', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return errorResponse('missing_file', 400)

  const payload = await getPayload({ config })
  const result = await uploadMemberCoverImage(payload, session.member.id, file)
  if (result.ok === false) {
    const status = result.error === 'account_ineligible'
      ? 403
      : result.error === 'file_too_large'
        ? 413
        : result.error === 'unsupported_type'
          ? 415
          : 400
    return errorResponse(result.error, status)
  }

  return Response.json({
    ok: true,
    mediaId: result.mediaId,
    previousMediaId: result.previousMediaId,
  })
}

export async function DELETE(request: Request): Promise<Response> {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.member?.id) return errorResponse('unauthorized', 401)
  if (session.member.accountStatus !== 'active') return errorResponse('account_ineligible', 403)

  const payload = await getPayload({ config })
  const result = await removeMemberCoverImage(payload, session.member.id)
  if (result.ok === false) {
    return errorResponse(result.error, result.error === 'account_ineligible' ? 403 : 400)
  }

  return Response.json({
    ok: true,
    mediaId: null,
    previousMediaId: result.previousMediaId,
  })
}
