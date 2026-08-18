import crypto from 'crypto'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VideoResponse = { ok: true; url: string }
type VideoError = { ok: false; reason: string }
type VideoTarget =
  | { kind: 'lesson'; slug: string }
  | { kind: 'page'; slug: string }
  | { kind: 'post'; slug: string }

type PayloadRelationship = string | number | { id?: string | number } | null | undefined

type VideoDocument = {
  id: string | number
  videoId?: number | null
  videoGuid?: string | null
  status?: string | null
}

function getBunnySigningKey(): string | null {
  return (
    (
      process.env.BUNNY_STREAM_TOKEN_AUTH_KEY ??
      process.env.BUNNY_STREAM_SIGNING_KEY ??
      process.env.BUNNY_CDN_KEY ??
      process.env.BUNNY_SIGNING_KEY ??
      ''
    ).trim() || null
  )
}

function getBunnyCdnHostname(): string | null {
  const explicit = (
    process.env.BUNNY_STREAM_CDN_HOSTNAME ??
    process.env.BUNNY_STREAM_HOSTNAME ??
    ''
  ).trim()
  if (explicit) return explicit.replace(/^https?:\/\//, '').replace(/\/+$/, '')

  const pullZone = (process.env.BUNNY_PULL_ZONE ?? '').trim()
  if (!pullZone) return null
  return pullZone.includes('.') ? pullZone : `${pullZone}.b-cdn.net`
}

function buildSignedBunnyUrl(params: {
  cdnHostname: string
  videoGuid: string
  signingKey: string
  ttlSeconds?: number
}): string {
  const expiry = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 3600)
  const path = `/${params.videoGuid}/playlist.m3u8`
  const playbackSignature = crypto
    .createHash('sha256')
    .update(`${params.signingKey}${path}${expiry}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const playbackUrl = new URL(`https://${params.cdnHostname}${path}`)
  playbackUrl.searchParams.set('token', playbackSignature)
  playbackUrl.searchParams.set('expires', String(expiry))

  return playbackUrl.toString()
}

function relationshipId(value: PayloadRelationship): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return value.id
  return null
}

function parseTarget(request: NextRequest): VideoTarget | null {
  const candidates: VideoTarget[] = []
  const lessonSlug = request.nextUrl.searchParams.get('lessonId')?.trim()
  const pageSlug = request.nextUrl.searchParams.get('pageSlug')?.trim()
  const postSlug = request.nextUrl.searchParams.get('postSlug')?.trim()

  if (lessonSlug) candidates.push({ kind: 'lesson', slug: lessonSlug })
  if (pageSlug) candidates.push({ kind: 'page', slug: pageSlug })
  if (postSlug) candidates.push({ kind: 'post', slug: postSlug })
  return candidates.length === 1 ? candidates[0] : null
}

async function findVideoById(payload: Awaited<ReturnType<typeof getPayload>>, id: string | number) {
  try {
    return (await payload.findByID({
      collection: 'bunny_videos',
      id,
      depth: 0,
      overrideAccess: true,
    })) as VideoDocument
  } catch {
    return null
  }
}

function lexicalContainsBunnyGuid(value: unknown, requestedGuid: string): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((entry) => lexicalContainsBunnyGuid(entry, requestedGuid))

  const record = value as Record<string, unknown>
  const fields = record.fields
  if (record.type === 'block' && fields && typeof fields === 'object') {
    const blockFields = fields as Record<string, unknown>
    if (blockFields.blockType === 'bunnyVideo' && blockFields.videoGuid === requestedGuid) return true
  }

  return Object.values(record).some((entry) => lexicalContainsBunnyGuid(entry, requestedGuid))
}

async function findVideoByGuid(payload: Awaited<ReturnType<typeof getPayload>>, videoGuid: string): Promise<VideoDocument | null> {
  const result = await payload.find({
    collection: 'bunny_videos',
    where: { videoGuid: { equals: videoGuid } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as VideoDocument | undefined) ?? null
}

async function resolveLessonVideo(
  payload: Awaited<ReturnType<typeof getPayload>>,
  lessonSlug: string,
  user: { id: string | number; collection?: string },
  requestedGuid?: string | null,
): Promise<{ video: VideoDocument | null; error?: NextResponse }> {
  const lessonResult = await payload.find({
    collection: 'payload_lessons',
    where: { slug: { equals: lessonSlug } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const lesson = lessonResult.docs[0] as {
    id: string | number
    bunnyVideo?: PayloadRelationship
    content?: unknown
    module?: { course?: PayloadRelationship } | null
  } | undefined

  if (!lesson) {
    return {
      video: null,
      error: NextResponse.json(
        { ok: false, reason: 'lesson_not_found' } satisfies VideoError,
        { status: 404 },
      ),
    }
  }

  if (user.collection === 'payload_members') {
    const courseId = relationshipId(lesson.module?.course)
    if (courseId === null) {
      return {
        video: null,
        error: NextResponse.json(
          { ok: false, reason: 'not_entitled' } satisfies VideoError,
          { status: 403 },
        ),
      }
    }

    const enrollment = await payload.find({
      collection: 'payload_course_enrollments',
      where: {
        and: [
          { member: { equals: String(user.id) } },
          { course: { equals: String(courseId) } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!enrollment.docs.length) {
      return {
        video: null,
        error: NextResponse.json(
          { ok: false, reason: 'not_entitled' } satisfies VideoError,
          { status: 403 },
        ),
      }
    }
  }

  if (requestedGuid) {
    const normalizedGuid = requestedGuid.trim().toLowerCase()
    if (!lexicalContainsBunnyGuid(lesson.content, normalizedGuid)) {
      return {
        video: null,
        error: NextResponse.json(
          { ok: false, reason: 'no_video_linked' } satisfies VideoError,
          { status: 404 },
        ),
      }
    }
    return { video: await findVideoByGuid(payload, normalizedGuid) }
  }

  const linkedVideoId = relationshipId(lesson.bunnyVideo)
  if (linkedVideoId !== null) {
    return { video: await findVideoById(payload, linkedVideoId) }
  }

  const legacyVideo = await payload.find({
    collection: 'bunny_videos',
    where: { lesson: { equals: String(lesson.id) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return { video: (legacyVideo.docs[0] as VideoDocument | undefined) ?? null }
}

async function resolvePublishedContentVideo(
  payload: Awaited<ReturnType<typeof getPayload>>,
  target: Extract<VideoTarget, { kind: 'page' | 'post' }>,
): Promise<{ video: VideoDocument | null; error?: NextResponse }> {
  const collection = target.kind === 'page' ? 'payload_pages' : 'payload_posts'
  const result = await payload.find({
    collection,
    where: {
      and: [
        { slug: { equals: target.slug } },
        { status: { equals: 'published' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const content = result.docs[0] as { featuredVideo?: PayloadRelationship } | undefined

  if (!content) {
    return {
      video: null,
      error: NextResponse.json(
        { ok: false, reason: 'content_not_found' } satisfies VideoError,
        { status: 404 },
      ),
    }
  }

  const videoId = relationshipId(content.featuredVideo)
  return { video: videoId === null ? null : await findVideoById(payload, videoId) }
}

export async function GET(request: NextRequest) {
  const target = parseTarget(request)
  const requestedGuid = request.nextUrl.searchParams.get('videoGuid')?.trim().toLowerCase() || null
  if (!target) {
    return NextResponse.json(
      { ok: false, reason: 'missing_lesson_id' } satisfies VideoError,
      { status: 400 },
    )
  }

  if (requestedGuid && target.kind !== 'lesson') {
    return NextResponse.json(
      { ok: false, reason: 'invalid_video_target' } satisfies VideoError,
      { status: 400 },
    )
  }

  try {
    const payload = await getPayload({ config })
    const auth = await payload.auth({ headers: await headers() })
    const user = auth.user as { id?: string | number; collection?: string } | null

    if (!user?.id || (user.collection !== 'payload_users' && user.collection !== 'payload_members')) {
      return NextResponse.json(
        { ok: false, reason: 'unauthorized' } satisfies VideoError,
        { status: 401 },
      )
    }

    const resolution = target.kind === 'lesson'
      ? await resolveLessonVideo(payload, target.slug, { id: user.id, collection: user.collection }, requestedGuid)
      : await resolvePublishedContentVideo(payload, target)

    if (resolution.error) return resolution.error
    if (!resolution.video) {
      return NextResponse.json(
        { ok: false, reason: 'no_video_linked' } satisfies VideoError,
        { status: 404 },
      )
    }

    if (resolution.video.status && resolution.video.status !== 'ready') {
      return NextResponse.json(
        { ok: false, reason: 'video_not_ready' } satisfies VideoError,
        { status: 404 },
      )
    }

    const videoGuid = resolution.video.videoGuid?.trim() || null
    if (!videoGuid) {
      return NextResponse.json(
        { ok: false, reason: 'video_not_ready' } satisfies VideoError,
        { status: 404 },
      )
    }

    const signingKey = getBunnySigningKey()
    const cdnHostname = getBunnyCdnHostname()
    if (!signingKey || !cdnHostname) {
      console.error('bunny_video: signing configuration is incomplete')
      return NextResponse.json(
        { ok: false, reason: 'server_misconfigured' } satisfies VideoError,
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        url: buildSignedBunnyUrl({ cdnHostname, videoGuid, signingKey }),
      } satisfies VideoResponse,
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=3000' },
      },
    )
  } catch (error) {
    console.error('bunny_video: unexpected error', {
      target: target.kind,
      slug: target.slug,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { ok: false, reason: 'server_error' } satisfies VideoError,
      { status: 500 },
    )
  }
}
