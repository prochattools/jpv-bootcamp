/**
 * GET /api/bunny/video?lessonId=<lessonSlug>
 *
 * Returns a signed Bunny Stream playback URL for the lesson's linked video.
 *
 * Security:
 *  - Requires an authenticated Payload session (payload_users or payload_members).
 *    Unauthenticated requests are rejected with 401.
 *  - Members must have an active enrollment in the course that contains the
 *    requested lesson.  Admin users (payload_users) bypass the enrollment check.
 *  - The Bunny CDN key (BUNNY_STREAM_TOKEN_AUTH_KEY / BUNNY_STREAM_SIGNING_KEY /
 *    BUNNY_CDN_KEY / BUNNY_SIGNING_KEY) is NEVER returned in the response body.
 *    Only the signed playback URL is returned.
 *  - The Bunny API key (BUNNY_STREAM_API_KEY / BUNNY_API_KEY) is used server-side
 *    only and never returned.
 *  - If no video is linked to the lesson, or if the signed URL cannot be produced,
 *    the route returns { ok: false, reason: "..." } — the caller must handle this
 *    and show "Video unavailable".
 *
 * Env var canonical precedence (most-specific first):
 *   Signing key : BUNNY_STREAM_TOKEN_AUTH_KEY > BUNNY_STREAM_SIGNING_KEY > BUNNY_CDN_KEY > BUNNY_SIGNING_KEY
 *   CDN hostname: BUNNY_STREAM_CDN_HOSTNAME > BUNNY_STREAM_HOSTNAME > (derived from BUNNY_PULL_ZONE)
 *   Library ID  : BUNNY_STREAM_LIBRARY_ID > BUNNY_LIBRARY_ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VideoResponse = { ok: true; url: string }
type VideoError = { ok: false; reason: string }

/**
 * Signing key — canonical Bunny Stream token auth key.
 * Priority: BUNNY_STREAM_TOKEN_AUTH_KEY > BUNNY_STREAM_SIGNING_KEY > BUNNY_CDN_KEY > BUNNY_SIGNING_KEY
 */
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

/**
 * CDN delivery hostname (the *.b-cdn.net pull zone host).
 * Priority: BUNNY_STREAM_CDN_HOSTNAME > BUNNY_STREAM_HOSTNAME > BUNNY_PULL_ZONE (appended with .b-cdn.net)
 */
function getBunnyCdnHostname(): string | null {
  const explicit = (
    process.env.BUNNY_STREAM_CDN_HOSTNAME ??
    process.env.BUNNY_STREAM_HOSTNAME ??
    ''
  ).trim()
  if (explicit) return explicit

  // Legacy: BUNNY_PULL_ZONE is just the subdomain, not the full hostname
  const pullZone = (process.env.BUNNY_PULL_ZONE ?? '').trim()
  if (pullZone) {
    return pullZone.includes('.') ? pullZone : `${pullZone}.b-cdn.net`
  }

  return null
}

function getBunnyLibraryId(): string | null {
  return (
    (process.env.BUNNY_STREAM_LIBRARY_ID ?? process.env.BUNNY_LIBRARY_ID ?? '').trim() || null
  )
}

/**
 * Build a signed Bunny Stream HLS playlist URL.
 *
 * Official Bunny Stream token authentication spec:
 *   token    = base64url( sha256( signingKey + path + expiryTimestamp ) )
 *   path     = /{videoGuid}/playlist.m3u8
 *   url      = https://<cdnHostname>{path}?token={token}&expires={expiryTimestamp}
 *
 * Note: Bunny Stream CDN paths use the VIDEO GUID (UUID), NOT the numeric videoId
 * or libraryId. The numeric ids are management-API identifiers only.
 *
 * See: https://docs.bunny.net/docs/stream-security-token-authentication
 */
function buildSignedBunnyUrl(params: {
  cdnHostname: string
  videoGuid: string
  signingKey: string
  ttlSeconds?: number
}): string {
  const { cdnHostname, videoGuid, signingKey } = params
  const ttl = params.ttlSeconds ?? 3600 // 1 hour default
  const expiry = Math.floor(Date.now() / 1000) + ttl
  const path = `/${videoGuid}/playlist.m3u8`
  const hashInput = `${signingKey}${path}${expiry}`
  const token = crypto
    .createHash('sha256')
    .update(hashInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `https://${cdnHostname}${path}?token=${token}&expires=${expiry}`
}

export async function GET(req: NextRequest) {
  const lessonSlug = req.nextUrl.searchParams.get('lessonId')?.trim()

  if (!lessonSlug) {
    return NextResponse.json(
      { ok: false, reason: 'missing_lesson_id' } satisfies VideoError,
      { status: 400 }
    )
  }

  try {
    const payload = await getPayload({ config })

    // ── Authentication ─────────────────────────────────────────────────────────
    // Auth check BEFORE credential check — don't reveal server config state to
    // Check Payload session — works for both payload_users (admins) and
    // payload_members (course members).
    const reqHeaders = await headers()
    const auth = await payload.auth({ headers: reqHeaders })
    const user = auth.user as { id?: string | number; collection?: string } | null

    if (!user || !user.id) {
      return NextResponse.json(
        { ok: false, reason: 'unauthorized' } satisfies VideoError,
        { status: 401 }
      )
    }

    const isAdmin = user.collection === 'payload_users'
    const isMember = user.collection === 'payload_members'

    if (!isAdmin && !isMember) {
      return NextResponse.json(
        { ok: false, reason: 'unauthorized' } satisfies VideoError,
        { status: 401 }
      )
    }

    // ── Entitlement check for members ────────────────────────────────────────
    // Admins bypass this check entirely. Members must have an active enrollment
    // in the course that contains the requested lesson.
    if (isMember) {
      // Resolve module → course chain at depth 1 so we can read module.course
      const lessonWithModule = await payload.find({
        collection: 'payload_lessons',
        where: { slug: { equals: lessonSlug } },
        limit: 1,
        depth: 1,
        overrideAccess: true, // auth already verified above
      })

      if (!lessonWithModule.docs.length) {
        return NextResponse.json(
          { ok: false, reason: 'lesson_not_found' } satisfies VideoError,
          { status: 404 }
        )
      }

      const lessonDoc = lessonWithModule.docs[0] as {
        module?: { course?: string | { id: string } | null } | null
      }
      const rawCourse = lessonDoc.module?.course ?? null
      const courseId: string | null = rawCourse
        ? typeof rawCourse === 'string'
          ? rawCourse
          : rawCourse.id
        : null

      if (courseId) {
        const enrollment = await payload.find({
          collection: 'payload_course_enrollments',
          where: {
            and: [
              { member: { equals: String(user.id) } },
              { course: { equals: courseId } },
              { status: { equals: 'active' } },
            ],
          },
          limit: 1,
          overrideAccess: true,
        })

        if (!enrollment.docs.length) {
          return NextResponse.json(
            { ok: false, reason: 'not_entitled' } satisfies VideoError,
            { status: 403 }
          )
        }
      }
      // courseId === null means the lesson is not linked to a course module —
      // treat as free/preview content and fall through to video lookup.
    }

    // ── Bunny credentials (checked after auth so anon gets 401, not 500) ──────
    const signingKey = getBunnySigningKey()
    const cdnHostname = getBunnyCdnHostname()

    if (!signingKey || !cdnHostname) {
      console.error(
        'bunny_video: missing signing key or CDN hostname. ' +
          'Set BUNNY_STREAM_TOKEN_AUTH_KEY and BUNNY_STREAM_CDN_HOSTNAME env vars.'
      )
      return NextResponse.json(
        { ok: false, reason: 'server_misconfigured' } satisfies VideoError,
        { status: 500 }
      )
    }

    // ── Lesson lookup (for admins, or after entitlement passed for members) ──
    const lessonsResult = await payload.find({
      collection: 'payload_lessons',
      where: { slug: { equals: lessonSlug } },
      limit: 1,
      depth: 0,
    })

    if (!lessonsResult.docs.length) {
      return NextResponse.json(
        { ok: false, reason: 'lesson_not_found' } satisfies VideoError,
        { status: 404 }
      )
    }

    const lesson = lessonsResult.docs[0]

    // Find the linked Bunny video record for this lesson
    const videoResult = await payload.find({
      collection: 'bunny_videos',
      where: { lessonId: { equals: lesson.id } },
      limit: 1,
      depth: 0,
    })

    if (!videoResult.docs.length) {
      return NextResponse.json(
        { ok: false, reason: 'no_video_linked' } satisfies VideoError,
        { status: 404 }
      )
    }

    const videoRecord = videoResult.docs[0] as {
      videoId?: number | null
      videoGuid?: string | null
      libraryId?: number | null
      id: number
    }

    // Bunny Stream CDN delivery requires the GUID (UUID), not the numeric videoId.
    // videoGuid is populated by the Bunny webhook handler from the VideoGuid field.
    const videoGuid = videoRecord.videoGuid?.trim() || null

    if (!videoGuid) {
      console.error('bunny_video: video record has no videoGuid (UUID)', {
        lessonSlug,
        videoRecordId: videoRecord.id,
        videoId: videoRecord.videoId,
      })
      return NextResponse.json(
        { ok: false, reason: 'video_not_ready' } satisfies VideoError,
        { status: 404 }
      )
    }

    const signedUrl = buildSignedBunnyUrl({
      cdnHostname,
      videoGuid,
      signingKey,
    })

    // Return the signed URL — NEVER return signingKey, BUNNY_STREAM_API_KEY, or any credential
    return NextResponse.json(
      { ok: true, url: signedUrl } satisfies VideoResponse,
      {
        status: 200,
        headers: {
          // Cache on the client for 50 min; the token expires in 60 min
          'Cache-Control': 'private, max-age=3000',
        },
      }
    )
  } catch (error) {
    console.error('bunny_video: unexpected error', {
      lessonSlug,
      message: (error as Error).message ?? 'unknown',
    })
    return NextResponse.json(
      { ok: false, reason: 'server_error' } satisfies VideoError,
      { status: 500 }
    )
  }
}
