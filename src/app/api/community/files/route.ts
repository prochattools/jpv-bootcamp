import config from '@payload-config'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'
import { attachOperationalBillingFallback } from '@/lib/payloadCourse/operationalBillingFallback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
])
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.mp4', '.webm',
])

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

function sanitizeFilename(original: string): string {
  const ext = path.extname(original).toLowerCase()
  const base = path.basename(original, path.extname(original))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80)
  const timestamp = Date.now()
  return `${base}_${timestamp}${ext}`
}

export async function POST(request: Request): Promise<Response> {
  const session = await resolvePayloadRequestSession(request.headers)
  const decision = decideSharedLogin(session, '/portal')

  if (!decision.allowed || decision.identity.kind !== 'member' || !session.member?.id) {
    return errorResponse('Unauthorized', 401)
  }

  const memberId = session.member.id
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Invalid form data', 400)
  }

  const spaceSlug = formData.get('spaceSlug')
  const file = formData.get('file')
  const title = formData.get('title')

  if (typeof spaceSlug !== 'string' || !spaceSlug.trim()) {
    return errorResponse('Missing spaceSlug', 400)
  }
  if (!(file instanceof File)) {
    return errorResponse('Missing file', 400)
  }
  if (typeof title !== 'string' || !title.trim()) {
    return errorResponse('Missing title', 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`, 413)
  }

  const mimeType = file.type.toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return errorResponse(`File type "${mimeType}" is not allowed.`, 415)
  }

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return errorResponse(`File extension "${ext}" is not allowed.`, 415)
  }

  const payload = attachOperationalBillingFallback(await getPayload({ config }))
  const accessPayload = payload as unknown as PayloadCourseAccessAPI

  const detail = await getMemberCommunitySpaceDetail(accessPayload, memberId, spaceSlug)
  if (!detail?.allowed || detail.membership?.status !== 'active') {
    return errorResponse('Access denied to this space', 403)
  }

  const safeFilename = sanitizeFilename(file.name)
  const storageDir = path.resolve(process.cwd(), 'private/payload-course-media')
  const filePath = path.join(storageDir, safeFilename)

  if (!filePath.startsWith(storageDir + path.sep)) {
    return errorResponse('Invalid filename', 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const mediaDoc = await payload.create({
    collection: 'payload_private_media',
    data: {
      alt: title.trim().slice(0, 250),
      filename: safeFilename,
      mimeType,
      filesize: file.size,
    },
    overrideAccess: true,
  })

  const attachmentType = mimeType.startsWith('image/') ? 'image' : 'document'

  const fileDoc = await payload.create({
    collection: 'payload_space_files',
    data: {
      title: title.trim().slice(0, 160),
      space: String(detail.id) as unknown as number,
      uploadedBy: String(memberId) as unknown as number,
      attachmentType,
      protectedFile: mediaDoc.id,
      moderationStatus: 'pending_review',
    },
    overrideAccess: true,
  })

  return Response.json(
    { id: fileDoc.id, filename: safeFilename, status: 'pending_review' },
    { status: 201 },
  )
}
