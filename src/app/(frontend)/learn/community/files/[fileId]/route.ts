import config from '@payload-config'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
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
  context: CommunityFileRouteContext
): Promise<Response> {
  const { fileId } = await context.params
  if (!isSafeResourceId(fileId)) return notFoundResponse()

  try {
    const session = await resolvePayloadRequestSession(request.headers)
    const decision = decideSharedLogin(session, '/portal')

    if (!decision.allowed || decision.identity.kind !== 'member' || !session.member?.id) {
      return notFoundResponse()
    }

    const payload = await getPayload({ config })
    const accessPayload = payload as unknown as PayloadCourseAccessAPI
    const moderationPreview =
      new URL(request.url).searchParams.get('moderation') === 'preview'
    const resolution = moderationPreview
      ? await resolveModerationCommunityFileDownload(
          accessPayload,
          { type: 'member', id: session.member.id },
          fileId
        )
      : await resolveMemberCommunityFileDownload(
          accessPayload,
          session.member.id,
          fileId
        )

    if (!resolution.allowed) return notFoundResponse()

    const storageRoot = path.resolve(process.cwd(), 'private/payload-course-media')
    const filePath = resolveSafeStoredFilePath(storageRoot, resolution.media.filename)
    if (!filePath) return notFoundResponse()

    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) return notFoundResponse()

    const nodeStream = createReadStream(filePath)
    const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    return new Response(body, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': buildAttachmentContentDisposition(resolution.filename),
        'Content-Length': String(fileStat.size),
        'Content-Type': safeMimeType(resolution.mimeType),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFoundResponse()
  }
}
