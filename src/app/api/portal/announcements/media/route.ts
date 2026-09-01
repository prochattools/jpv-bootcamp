import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'image/gif', 'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
])

function safeFilename(name: string, mimeType: string): string {
  const extension = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '')
  const base = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'announcement-media'
  const fallback = mimeType === 'video/quicktime' ? '.mov' : mimeType.split('/')[1] ? `.${mimeType.split('/')[1]}` : ''
  return `${base}-${Date.now()}${extension || fallback}`
}

export async function POST(request: NextRequest) {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.administratorId) return NextResponse.json({ ok: false, message: 'Administrator access is required.' }, { status: 403 })

  try {
    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: 'Choose an image, video, or document first.' }, { status: 400 })
    const mimeType = file.type.toLowerCase()
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return NextResponse.json({ ok: false, message: 'Only common image, video, and document formats are supported.' }, { status: 415 })
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ ok: false, message: 'Media must be smaller than 50 MB.' }, { status: 413 })

    const payload = await getPayload({ config }) as unknown as PayloadCourseWriteAPI
    const media = await payload.create({
      collection: 'payload_media',
      data: { alt: file.name.replace(/\.[^.]+$/, '').slice(0, 250) || 'Announcement media' },
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: mimeType,
        name: safeFilename(file.name, mimeType),
        size: file.size,
      },
      overrideAccess: true,
      user: { id: session.administratorId, collection: 'payload_users' },
    } as never)

    return NextResponse.json({ ok: true, media: { id: String(media.id), url: String(media.url ?? ''), filename: String(media.filename ?? file.name), mimeType } }, { status: 201 })
  } catch (error) {
    console.error('[portal announcements media POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: 'Unable to upload this media.' }, { status: 400 })
  }
}
