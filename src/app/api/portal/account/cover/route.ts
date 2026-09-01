import { resolvePortalRequestMember } from '@/lib/auth/resolvePortalRequestMember'
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
  const requestMember = await resolvePortalRequestMember(request.headers)
  if (!requestMember) return errorResponse('unauthorized', 401)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse('invalid_form_data', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return errorResponse('missing_file', 400)

  const result = await uploadMemberCoverImage(requestMember.payload as never, requestMember.memberId, file)
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
  const requestMember = await resolvePortalRequestMember(request.headers)
  if (!requestMember) return errorResponse('unauthorized', 401)

  const result = await removeMemberCoverImage(requestMember.payload as never, requestMember.memberId)
  if (result.ok === false) {
    return errorResponse(result.error, result.error === 'account_ineligible' ? 403 : 400)
  }

  return Response.json({
    ok: true,
    mediaId: null,
    previousMediaId: result.previousMediaId,
  })
}
