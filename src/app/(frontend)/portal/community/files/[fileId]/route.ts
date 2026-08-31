import config from '@payload-config'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import { resolveMemberCommunityAttachment } from '@/lib/payloadCourse/communityFiles'
import { resolveMemberCommunityFileDownload } from '@/lib/payloadCourse/communityFileDelivery'
import { resolveModerationCommunityFileDownload } from '@/lib/payloadCourse/communityFiles'
import {
  buildAttachmentContentDisposition,
  isSafeResourceId,
  resolveSafeStoredFilePath,
  safeMimeType,
} from '@/lib/payloadCourse/lessonResourceDelivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CommunityFileRouteContext = {
  params: Promise<{ fileId: string }>
}

function notFoundResponse(): Response {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(
  request: Request,
  context: CommunityFileRouteContext,
): Promise<Response> {
  const { fileId } = await context.params
  if (!isSafeResourceId(fileId)) return notFoundResponse()

  try {
    const session = await resolvePayloadRequestSession(request.headers)
    const decision = decideSharedLogin(session, '/portal')

    const administratorAccess = Boolean(session.administratorId && !session.unresolvedCollection)
    const memberAccess = Boolean(decision.allowed && decision.identity.kind === 'member' && session.member?.id)
    if (!administratorAccess && !memberAccess) {
      return notFoundResponse()
    }

    const payload = await getPayload({ config })
    const accessPayload = payload as unknown as PayloadCourseAccessAPI
    const requestUrl = new URL(request.url)
    const moderationPreview = requestUrl.searchParams.get('moderation') === 'preview'
    const inlineImage = requestUrl.searchParams.get('inline') === '1'
    const resolution = moderationPreview
      ? await resolveModerationCommunityFileDownload(
          accessPayload,
          administratorAccess
            ? { type: 'admin', id: session.administratorId }
            : { type: 'member', id: session.member!.id },
          fileId,
        )
      : administratorAccess
        ? await resolveMemberCommunityAttachment(
            accessPayload,
            session.administratorId!,
            fileId,
            { allowAdministrator: true },
          )
        : await resolveMemberCommunityFileDownload(accessPayload, session.member!.id, fileId)

    if (!resolution.allowed || !('media' in resolution)) return notFoundResponse()

    const storageRoot = path.resolve(process.cwd(), 'private/payload-course-media')
    const filePath = resolveSafeStoredFilePath(storageRoot, resolution.media.filename)
    if (!filePath) return notFoundResponse()

    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) return notFoundResponse()

    const nodeStream = createReadStream(filePath)
    const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
    const contentDisposition = inlineImage && resolution.media.mimeType.startsWith('image/')
      ? buildAttachmentContentDisposition(resolution.filename).replace(/^attachment;/, 'inline;')
      : buildAttachmentContentDisposition(resolution.filename)

    return new Response(body, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': contentDisposition,
        'Content-Length': String(fileStat.size),
        'Content-Type': safeMimeType(resolution.mimeType),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFoundResponse()
  }
}
