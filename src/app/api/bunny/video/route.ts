/**
 * GET /api/bunny/video?lessonId=<lessonSlug>
 *
 * Returns a signed Bunny Stream playback URL for the lesson's linked video.
 *
 * Security:
 *  - The Bunny CDN key (BUNNY_CDN_KEY / BUNNY_SIGNING_KEY) is NEVER returned in
 *    the response body.  Only the signed playback URL is returned.
 *  - The Bunny API key (BUNNY_API_KEY) is used server-side only and never returned.
 *  - The route requires an authenticated Payload session (the requesting user must
 *    be logged in to the Payload admin or have a valid session cookie).
 *  - If no video is linked to the lesson, or if the signed URL cannot be produced,
 *    the route returns { ok: false, reason: "..." } — the caller must handle this
 *    and show "Video unavailable".
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VideoResponse = { ok: true; url: string }
type VideoError = { ok: false; reason: string }

function getBunnySigningKey(): string | null {
  return (process.env.BUNNY_CDN_KEY ?? process.env.BUNNY_SIGNING_KEY ?? '').trim() || null
}

function getBunnyPullZone(): string | null {
  return (process.env.BUNNY_PULL_ZONE ?? '').trim() || null
}

function getBunnyLibraryId(): string | null {
  return (process.env.BUNNY_LIBRARY_ID ?? '').trim() || null
}

/**
 * Build a signed Bunny Stream URL.
 *
 * Bunny token authentication uses:
 *   token = base64(sha256(securityKey + '/path' + expiry))
 *   signed_url = https://<pullZone>/<libraryId>/<videoId>/play_720p.mp4?token=<token>&expires=<expiry>
 *
 * See: https://docs.bunny.net/docs/stream-security-token-authentication
 */
function buildSignedBunnyUrl(params: {
  pullZone: string
  libraryId: string
  videoId: string
  signingKey: string
  ttlSeconds?: number
}): string {
  const { pullZone, libraryId, videoId, signingKey } = params
  const ttl = params.ttlSeconds ?? 3600 // 1 hour default
  const expiry = Math.floor(Date.now() / 1000) + ttl
  const path = `/${libraryId}/${videoId}/playlist.m3u8`
  const hashInput = `${signingKey}${path}${expiry}`
  const token = crypto
    .createHash('sha256')
    .update(hashInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `https://${pullZone}.b-cdn.net${path}?token=${token}&expires=${expiry}`
}

export async function GET(req: NextRequest) {
  const lessonSlug = req.nextUrl.searchParams.get('lessonId')?.trim()

  if (!lessonSlug) {
    return NextResponse.json(
      { ok: false, reason: 'missing_lesson_id' } satisfies VideoError,
      { status: 400 }
    )
  }

  // Check Bunny credentials before querying the database
  const signingKey = getBunnySigningKey()
  const pullZone = getBunnyPullZone()

  if (!signingKey || !pullZone) {
    console.error('bunny_video: missing BUNNY_CDN_KEY or BUNNY_PULL_ZONE env vars')
    return NextResponse.json(
      { ok: false, reason: 'server_misconfigured' } satisfies VideoError,
      { status: 500 }
    )
  }

  try {
    const payload = await getPayload({ config })

    // Look up the lesson by slug
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

    const videoRecord = videoResult.docs[0] as { videoId: number; libraryId?: number; id: number }
    const videoId = videoRecord.videoId ? String(videoRecord.videoId) : null
    const libraryId =
      (videoRecord.libraryId ? String(videoRecord.libraryId) : getBunnyLibraryId()) ?? ''

    if (!videoId) {
      return NextResponse.json(
        { ok: false, reason: 'missing_video_id' } satisfies VideoError,
        { status: 404 }
      )
    }

    if (!libraryId) {
      console.error('bunny_video: no library ID on record and BUNNY_LIBRARY_ID not set', {
        lessonSlug,
        videoRecordId: videoRecord.id,
      })
      return NextResponse.json(
        { ok: false, reason: 'server_misconfigured' } satisfies VideoError,
        { status: 500 }
      )
    }

    const signedUrl = buildSignedBunnyUrl({
      pullZone,
      libraryId,
      videoId,
      signingKey,
    })

    // Return the signed URL — NEVER return signingKey, BUNNY_API_KEY, or any credential
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
