import config from '@payload-config'
import { getPayload } from 'payload'

import { NotificationsPageClient } from '@/components/portal/NotificationsPageClient'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'

export const dynamic = 'force-dynamic'

type Notification = {
  id: string
  type: 'new_post' | 'new_comment' | 'mention' | 'system' | 'announcement' | 'live_session'
  actorName?: string | null
  title?: string | null
  href?: string | null
  read: boolean
  createdAt: string
}

export default async function NotificationsPage() {
  const { memberId } = await requirePortalMember('/portal/notifications')
  const payload = await getPayload({ config })
  const where = { member: { equals: memberId } }
  const [recent, unread] = await Promise.all([
    payload.find({ collection: 'payload_member_notifications', where, limit: 100, sort: '-createdAt', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'payload_member_notifications', where: { and: [where, { read: { equals: false } }] }, limit: 1, depth: 0, overrideAccess: true }),
  ])

  const notifications = recent.docs.map((notification) => ({
    id: String(notification.id),
    type: notification.type,
    actorName: notification.actorName ?? null,
    title: notification.title ?? null,
    href: notification.href ?? null,
    read: Boolean(notification.read),
    createdAt: new Date(notification.createdAt).toISOString(),
  })) as Notification[]

  return (
    <NotificationsPageClient
      initialNotifications={notifications}
      initialUnreadCount={unread.totalDocs}
    />
  )
}
