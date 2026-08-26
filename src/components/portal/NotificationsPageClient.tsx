'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Notification = {
  id: string
  type: 'new_post' | 'new_comment' | 'mention' | 'system' | 'announcement' | 'live_session'
  actorName?: string | null
  title?: string | null
  href?: string | null
  read: boolean
  createdAt: string
}

type NotificationsPageClientProps = {
  initialNotifications: Notification[]
  initialUnreadCount: number
}

type Filter = 'all' | 'unread' | 'mentions'

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [filter, setFilter] = useState<Filter>('all')
  const [status, setStatus] = useState<string | null>(null)

  const visibleNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.read)
    if (filter === 'mentions') return notifications.filter((notification) => notification.type === 'mention')
    return notifications
  }, [filter, notifications])

  const unreadCount = notifications.filter((notification) => !notification.read).length

  async function markRead(id: string): Promise<void> {
    const response = await fetch('/api/portal/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', ids: [id] }),
    })
    if (!response.ok) throw new Error('Unable to update notification.')
    setNotifications((current) => current.map((notification) => (
      notification.id === id ? { ...notification, read: true } : notification
    )))
  }

  async function markAllRead(): Promise<void> {
    setStatus(null)
    try {
      const response = await fetch('/api/portal/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      if (!response.ok) throw new Error('Unable to update notifications.')
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
      setStatus('All notifications marked as read.')
    } catch {
      setStatus('Notifications could not be updated. Please try again.')
    }
  }

  return (
    <div className='mx-auto max-w-3xl space-y-6'>
      <section>
        <p className='jpv-eyebrow'>Updates</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Notifications</h1>
        <p className='mt-2 text-sm leading-6 text-jpv-muted'>Replies, mentions, reactions, and community announcements for your account.</p>
      </section>

      <div className='flex flex-wrap items-center gap-2 border-b border-jpv-border pb-3'>
        {(['all', 'unread', 'mentions'] as const).map((item) => (
          <button
            className={`min-h-11 rounded-jpv-action border px-4 text-sm font-semibold transition ${
              filter === item
                ? 'border-jpv-brand-deep bg-jpv-surface text-jpv-ink'
                : 'border-jpv-border bg-jpv-canvas text-jpv-muted hover:bg-jpv-surface hover:text-jpv-ink'
            }`}
            key={item}
            onClick={() => setFilter(item)}
            type='button'
          >
            {item === 'all' ? 'All' : item === 'unread' ? `Unread (${unreadCount})` : 'Mentions'}
          </button>
        ))}
        <button className='ml-auto min-h-11 px-2 text-sm font-semibold text-jpv-brand-deep hover:text-jpv-ink disabled:cursor-not-allowed disabled:opacity-50' disabled={unreadCount === 0} onClick={() => void markAllRead()} type='button'>
          Mark all as read
        </button>
      </div>

      {status ? <p aria-live='polite' className='jpv-notice'>{status}</p> : null}

      <section aria-label='Notification list' className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-canvas'>
        {visibleNotifications.length === 0 ? (
          <p className='p-8 text-center text-sm text-jpv-muted'>No notifications in this view.</p>
        ) : (
          <ul>
            {visibleNotifications.map((notification) => {
              const content = (
                <div className='flex items-start gap-3 px-5 py-4'>
                  <span aria-hidden='true' className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.read ? 'bg-jpv-border' : 'bg-jpv-brand'}`} />
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm leading-6 text-jpv-ink'>
                      {notification.actorName ? <span className='font-semibold'>{notification.actorName} </span> : null}
                      {notification.title ?? 'You have a new notification.'}
                    </p>
                    <p className='mt-1 text-xs text-jpv-muted'>{formatDate(notification.createdAt)}</p>
                  </div>
                </div>
              )

              return (
                <li className={`border-b border-jpv-border last:border-b-0 ${notification.read ? '' : 'bg-jpv-surface'}`} key={notification.id}>
                  {notification.href ? (
                    <Link className='block hover:bg-jpv-surface' href={notification.href} onClick={() => void markRead(notification.id)}>
                      {content}
                    </Link>
                  ) : (
                    <button className='block w-full text-left hover:bg-jpv-surface' onClick={() => void markRead(notification.id)} type='button'>
                      {content}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className='text-xs text-jpv-muted'>Showing the latest {Math.max(initialNotifications.length, 0)} notifications. Unread at page load: {initialUnreadCount}.</p>
    </div>
  )
}
