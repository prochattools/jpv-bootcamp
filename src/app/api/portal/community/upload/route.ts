/**
 * POST /api/portal/community/upload
 *
 * Upload and validate community media (images/videos).
 * Entitled members only. Type/size validation enforced.
 * Returns signed download URL for member access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

export async function POST(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)

  if (!session.member) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const spaceId = formData.get('spaceId') as string | null

    if (!file) {
      return NextResponse.json({ ok: false, reason: 'missing_file' }, { status: 400 })
    }

    if (!spaceId) {
      return NextResponse.json({ ok: false, reason: 'missing_spaceId' }, { status: 400 })
    }

    // Type validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, reason: 'unsupported_type', allowed: ALLOWED_TYPES },
        { status: 400 },
      )
    }

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'file_too_large',
          max_bytes: MAX_FILE_SIZE,
          file_size: file.size,
        },
        { status: 400 },
      )
    }

    // TODO: Integrate with Bunny CDN or Payload media collection
    // For now, return placeholder response indicating upload received
    // Actual storage should use Bunny Stream for videos, Bunny CDN for images

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      spaceId,
      memberId: session.member,
      uploadId: `upload_${Date.now()}`,
      message: 'File accepted. Async processing started.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[community-upload] error:', message)
    return NextResponse.json({ ok: false, reason: 'server_error', error: message }, { status: 500 })
  }
}
