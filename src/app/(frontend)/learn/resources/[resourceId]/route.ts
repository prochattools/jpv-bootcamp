import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { resolveMemberLessonResourceDownload } from '@/lib/payloadCourse/lessonResources'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const privateMediaRoot = path.join(process.cwd(), 'private', 'payload-course-media')
const publicMediaRoot = path.join(process.cwd(), 'public', 'media')

function plain(status: number, message: string): NextResponse {
  return new NextResponse(message, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  })
}

function safeContentDispositionFileName(value: string): string {
  const cleaned = value.replace(/["\r\n\\]/g, '_').trim()
  return cleaned || 'lesson-resource'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    return plain(401, 'Sign in to download this resource.')
  }

  const result = await resolveMemberLessonResourceDownload(payload, member.id, resourceId)
  if (result.allowed === false) {
    const status = result.reason === 'access_denied' ? 403 : 404
    return plain(status, 'Resource is not available.')
  }

  const mediaRoot = result.media.storage === 'private' ? privateMediaRoot : publicMediaRoot
  const filePath = path.resolve(mediaRoot, result.media.filename)
  if (!filePath.startsWith(`${mediaRoot}${path.sep}`)) {
    return plain(404, 'Resource is not available.')
  }

  let body: Buffer
  try {
    body = await readFile(filePath)
  } catch {
    return plain(404, 'Resource file is not available.')
  }

  const downloadName = safeContentDispositionFileName(result.fileName ?? result.media.filename)
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      'cache-control': 'private, no-store',
      'content-disposition': `attachment; filename="${downloadName}"`,
      'content-length': String(body.byteLength),
      'content-type': result.media.mimeType ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    },
  })
}
