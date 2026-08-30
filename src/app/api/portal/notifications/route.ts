import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NotificationTab = 'recent' | 'unread' | 'mentions'

function resolveTab(value: string | null): NotificationTab {
  if (value === 'unread' || value === 'mentions') return value
  return 'recent'
}

export async function GET(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)

  if (!session.member && !session.administratorId) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const tab = resolveTab(url.searchParams.get('tab'))

  try {
    const payload = (await getPayload({ config })) as unknown as PayloadCourseWriteAPI

    if (session.administratorId) {
      const whereClause = tab === 'unread'
        ? { status: { equals: 'unread' } }
        : {}
      const [adminResult, unreadResult] = await Promise.all([
        payload.find({
          collection: 'payload_admin_notifications',
          where: whereClause,
          limit: 50,
          sort: '-createdAt',
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'payload_admin_notifications',
          where: { status: { equals: 'unread' } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
      ])
      return NextResponse.json({
        notifications: adminResult.docs.map((notification) => ({
          ...notification,
          type: 'system',
          actorName: 'JPV Bootcamp',
          href: typeof notification.metadata === 'object' && notification.metadata !== null && typeof (notification.metadata as Record<string, unknown>).href === 'string'
            ? (notification.metadata as Record<string, unknown>).href
            : notification.relatedCollection === 'live_sessions' && notification.relatedDocumentId
              ? `/portal/rooms/${encodeURIComponent(String(notification.relatedDocumentId))}`
              : null,
          read: notification.status !== 'unread',
        })),
        unreadCount: unreadResult.totalDocs,
      })
    }

    const memberId = String(session.member!.id)
    const baseWhere = { member: { equals: memberId } }

    let whereClause: Record<string, unknown> = baseWhere

    if (tab === 'unread') {
      whereClause = {
        and: [baseWhere, { read: { equals: false } }],
      }
    } else if (tab === 'mentions') {
      whereClause = {
        and: [baseWhere, { type: { equals: 'mention' } }],
      }
    }

    const [notificationsResult, unreadResult] = await Promise.all([
      payload.find({
        collection: 'payload_member_notifications',
        where: whereClause,
        limit: 50,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'payload_member_notifications',
        where: {
          and: [baseWhere, { read: { equals: false } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    return NextResponse.json({
      notifications: notificationsResult.docs,
      unreadCount: unreadResult.totalDocs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notifications GET] error:', message)
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}

type MarkReadBody = { action: 'mark_read'; ids: string[] } | { action: 'mark_all_read' }

export async function POST(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)

  if (!session.member && !session.administratorId) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  try {
    const payload = (await getPayload({ config })) as unknown as PayloadCourseWriteAPI
    const body = (await req.json()) as MarkReadBody

    if (session.administratorId) {
      if (body.action === 'mark_read') {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return NextResponse.json({ ok: false, reason: 'missing_ids' }, { status: 400 })
        }
        let updated = 0
        for (const id of body.ids) {
          try {
            const notification = await payload.findByID({
              collection: 'payload_admin_notifications',
              id,
              depth: 0,
              overrideAccess: true,
            }).catch((): null => null) as Record<string, unknown> | null
            if (!notification) continue
            await payload.update({
              collection: 'payload_admin_notifications',
              id,
              data: { status: 'read' },
              overrideAccess: true,
            })
            updated++
          } catch {
            // skip individual failures
          }
        }
        return NextResponse.json({ ok: true, action: 'mark_read', updated })
      }
      if (body.action === 'mark_all_read') {
        const unread = await payload.find({
          collection: 'payload_admin_notifications',
          where: { status: { equals: 'unread' } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        let updated = 0
        for (const notification of unread.docs) {
          try {
            await payload.update({
              collection: 'payload_admin_notifications',
              id: String(notification.id),
              data: { status: 'read' },
              overrideAccess: true,
            })
            updated++
          } catch {
            // skip individual failures
          }
        }
        return NextResponse.json({ ok: true, action: 'mark_all_read', updated })
      }
      return NextResponse.json({ ok: false, reason: 'unknown_action' }, { status: 400 })
    }

    const memberId = String(session.member!.id)

    if (body.action === 'mark_read') {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return NextResponse.json({ ok: false, reason: 'missing_ids' }, { status: 400 })
      }

      let updated = 0
      for (const id of body.ids) {
        try {
          // Fetch first to verify this notification belongs to the current member
          const notification = (await payload.findByID({
            collection: 'payload_member_notifications',
            id,
            depth: 0,
            overrideAccess: true,
          }).catch((): null => null)) as Record<string, unknown> | null

          const notifMemberId =
            typeof notification?.member === 'object' && notification.member !== null
              ? String((notification.member as Record<string, unknown>).id)
              : String(notification?.member ?? '')

          if (!notification || notifMemberId !== memberId) continue

          await payload.update({
            collection: 'payload_member_notifications',
            id,
            data: { read: true },
            overrideAccess: true,
          })
          updated++
        } catch {
          // skip individual failures
        }
      }
      return NextResponse.json({ ok: true, action: 'mark_read', updated })
    }

    if (body.action === 'mark_all_read') {
      const unread = await payload.find({
        collection: 'payload_member_notifications',
        where: {
          and: [
            { member: { equals: memberId } },
            { read: { equals: false } },
          ],
        },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })

      let updated = 0
      for (const notification of unread.docs) {
        try {
          await payload.update({
            collection: 'payload_member_notifications',
            id: String(notification.id),
            data: { read: true },
            overrideAccess: true,
          })
          updated++
        } catch {
          // skip individual failures
        }
      }

      return NextResponse.json({ ok: true, action: 'mark_all_read', updated })
    }

    return NextResponse.json({ ok: false, reason: 'unknown_action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notifications POST] error:', message)
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}
