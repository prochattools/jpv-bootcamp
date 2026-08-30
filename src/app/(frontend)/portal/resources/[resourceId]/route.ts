import config from '@payload-config'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import {
  buildAttachmentContentDisposition,
  isSafeResourceId,
  resolveSafeStoredFilePath,
  safeMimeType,
} from '@/lib/payloadCourse/lessonResourceDelivery'
import { resolveMemberLessonResourceDownload } from '@/lib/payloadCourse/lessonResources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ResourceRouteContext = {
  params: Promise<{ resourceId: string }>
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

export async function GET(request: Request, context: ResourceRouteContext): Promise<Response> {
  const { resourceId } = await context.params
  if (!isSafeResourceId(resourceId)) return notFoundResponse()

  try {
    const session = await resolvePayloadRequestSession(request.headers)
    const decision = decideSharedLogin(session, '/portal')

    const administratorAccess = Boolean(session.administratorId && !session.unresolvedCollection)
    if (!administratorAccess && (!decision.allowed || decision.identity.kind !== 'member' || !session.member?.id)) {
      return notFoundResponse()
    }

    const payload = await getPayload({ config })
    const resolution = await resolveMemberLessonResourceDownload(
      payload as unknown as PayloadCourseAccessAPI,
      administratorAccess ? (session.member?.id ?? session.administratorId!) : session.member.id,
      resourceId,
      administratorAccess ? { allowAdministrator: true } : undefined,
    )

    if (!resolution.allowed) return notFoundResponse()

    const storageRoot =
      resolution.media.storage === 'private'
        ? path.resolve(process.cwd(), 'private/payload-course-media')
        : path.resolve(process.cwd(), 'public/media')
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
        'Content-Disposition': buildAttachmentContentDisposition(
          resolution.fileName ?? resolution.media.filename,
        ),
        'Content-Length': String(fileStat.size),
        'Content-Type': safeMimeType(resolution.media.mimeType),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFoundResponse()
  }
}
