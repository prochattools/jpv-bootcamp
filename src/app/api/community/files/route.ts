import path from 'node:path'
import { resolvePortalRequestMember } from '@/lib/auth/resolvePortalRequestMember'
import { evaluatePayloadSpaceAccess, type PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'
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
  const requestMember = await resolvePortalRequestMember(request.headers)
  if (!requestMember) {
    return errorResponse('Unauthorized', 401)
  }

  const memberId = requestMember.memberId
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return errorResponse('Invalid form data', 400)
  }

  const spaceSlug = formData.get('spaceSlug')
  const postId = formData.get('postId')
  const file = formData.get('file')
  const title = formData.get('title')

  if (typeof spaceSlug !== 'string' || !spaceSlug.trim()) {
    return errorResponse('Missing spaceSlug', 400)
  }
  if (typeof postId !== 'string' || !postId.trim()) {
    return errorResponse('Missing postId', 400)
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
  if (file.size === 0) {
    return errorResponse('The selected file is empty.', 400)
  }

  const mimeType = file.type.toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return errorResponse(`File type "${mimeType}" is not allowed.`, 415)
  }

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return errorResponse(`File extension "${ext}" is not allowed.`, 415)
  }

  const payload = attachOperationalBillingFallback(requestMember.payload)
  const accessPayload = payload as unknown as PayloadCourseAccessAPI

  // Authorize against the exact post that will consume the file. Do not load
  // the full discussion page here: uploads only need the post, its space, and
  // the member entitlement, and the old full-detail call added a large query
  // waterfall before the upload could even begin.
  const [post, spaceResult] = await Promise.all([
    payload.findByID({ collection: 'payload_space_posts', id: postId, depth: 0, overrideAccess: true }).catch((): null => null),
    payload.find({
      collection: 'payload_spaces',
      where: {
        and: [
          { slug: { equals: spaceSlug } },
          { status: { equals: 'published' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const space = spaceResult.docs[0] ?? null
  if (!post || !space || post.moderationStatus !== 'visible' || post.locked === true || relationshipId(post.space) !== String(space.id)) {
    return errorResponse('Access denied to this space', 403)
  }
  const access = await evaluatePayloadSpaceAccess(accessPayload, { memberId, spaceId: space.id })
  if (!access.decision.allowed) {
    return errorResponse('Access denied to this space', 403)
  }

  const safeFilename = sanitizeFilename(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  let mediaDoc: { id: string | number }
  try {
    // Payload owns the upload lifecycle. Supplying the file here writes the
    // binary and generates the matching upload metadata in one operation.
    mediaDoc = await payload.create({
      collection: 'payload_private_media',
      data: {
        alt: title.trim().slice(0, 250),
      },
      file: {
        data: buffer,
        mimetype: mimeType,
        name: safeFilename,
        size: file.size,
      },
      overrideAccess: true,
    } as never)
  } catch (error) {
    console.error('[community files POST] media upload error:', error instanceof Error ? error.message : String(error))
    return errorResponse('Unable to upload this file. Please try again.', 500)
  }

  const attachmentType = mimeType.startsWith('image/') ? 'image' : 'document'

  let fileDoc: { id: string | number }
  try {
    fileDoc = await payload.create({
      collection: 'payload_space_files',
      data: {
        altText: title.trim().slice(0, 250),
        title: title.trim().slice(0, 160),
        space: String(space.id) as unknown as number,
        uploadedBy: String(memberId) as unknown as number,
        attachmentType,
        protectedFile: mediaDoc.id as number,
        moderationStatus: 'pending_review',
      },
      overrideAccess: true,
    })
  } catch (error) {
    console.error('[community files POST] attachment record error:', error instanceof Error ? error.message : String(error))
    try {
      await payload.delete({ collection: 'payload_private_media', id: mediaDoc.id, overrideAccess: true })
    } catch (cleanupError) {
      console.error('[community files POST] media cleanup error:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError))
    }
    return errorResponse('Unable to attach this file. Please try again.', 500)
  }

  return Response.json(
    { id: fileDoc.id, filename: safeFilename, status: 'pending_review' },
    { status: 201 },
  )
}
