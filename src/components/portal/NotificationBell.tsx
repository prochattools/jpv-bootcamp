'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

type NotificationType = 'new_post' | 'new_comment' | 'mention' | 'system'

type Notification = {
  id: string
  type: NotificationType
  actorName?: string | null
  title?: string | null
  href?: string | null
  read: boolean
  createdAt: string
}

type NotificationsData = {
  notifications: Notification[]
  unreadCount: number
}

type Tab = 'recent' | 'unread' | 'mentions'

const TABS: Tab[] = ['recent', 'unread', 'mentions']

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return ''
  }
}

export function NotificationBell() {
  const [data, setData] = useState<NotificationsData | null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('recent')
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async (tab: Tab) => {
    try {
      const res = await fetch(`/api/portal/notifications?tab=${tab}`)
      if (res.ok) {
        const json = (await res.json()) as NotificationsData
        setData(json)
      }
    } catch {
      // silent — network errors should not break the UI
    }
  }, [])

  // Initial fetch + 30-second polling
  useEffect(() => {
    void fetchNotifications(activeTab)
    const interval = setInterval(() => {
      void fetchNotifications(activeTab)
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications, activeTab])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  async function markAllRead() {
    try {
      await fetch('/api/portal/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      await fetchNotifications(activeTab)
    } catch {
      // silent
    }
  }

  async function markOneRead(id: string) {
    try {
      await fetch('/api/portal/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', ids: [id] }),
      })
      // Optimistic local update — avoid a full refetch for single-item reads
      setData((prev) => {
        if (!prev) return prev
        const updated = prev.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        )
        const unreadCount = updated.filter((n) => !n.read).length
        return { notifications: updated, unreadCount }
      })
    } catch {
      // silent
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    void fetchNotifications(tab)
  }

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  return (
    <div className='relative'>
      <button
        ref={buttonRef}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className='relative flex min-h-11 min-w-11 items-center justify-center rounded-jpv-action text-jpv-muted transition hover:bg-jpv-surface hover:text-jpv-ink'
        onClick={() => setOpen((v) => !v)}
        type='button'
      >
        <Bell aria-hidden='true' className='h-5 w-5' />
        {unreadCount > 0 && (
          <span
            aria-hidden='true'
            className='absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white'
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className='absolute right-0 top-12 z-50 w-80 rounded-xl border border-jpv-border bg-jpv-canvas shadow-xl sm:w-96'
          role='dialog'
          aria-label='Notifications panel'
        >
          {/* Header */}
          <div className='flex items-center justify-between border-b border-jpv-border px-4 py-3'>
            <span className='text-sm font-semibold text-jpv-ink'>Notifications</span>
            <button
              className='text-xs text-jpv-muted transition hover:text-jpv-ink'
              onClick={() => void markAllRead()}
              type='button'
            >
              Mark all as read
            </button>
          </div>

          {/* Tabs */}
          <div className='flex border-b border-jpv-border'>
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`flex-1 py-2 text-xs font-medium capitalize transition ${
                  activeTab === tab
                    ? 'border-b-2 border-jpv-brand-deep text-jpv-ink'
                    : 'text-jpv-muted hover:text-jpv-ink'
                }`}
                onClick={() => handleTabChange(tab)}
                type='button'
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className='max-h-80 overflow-y-auto'>
            {notifications.length === 0 ? (
              <div className='px-4 py-8 text-center text-sm text-jpv-muted'>
                {activeTab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => {
                  const item = (
                    <div className='flex items-start gap-3 px-4 py-3'>
                      <div className='min-w-0 flex-1'>
                        <p className='line-clamp-2 text-sm text-jpv-ink'>
                          {notification.actorName && (
                            <span className='font-semibold'>{notification.actorName} </span>
                          )}
                          {notification.title}
                        </p>
                        <p className='mt-0.5 text-xs text-jpv-muted'>
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div
                          aria-label='Unread'
                          className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500'
                        />
                      )}
                    </div>
                  )

                  return (
                    <li
                      key={notification.id}
                      className={`border-b border-jpv-border last:border-b-0 ${
                        !notification.read ? 'bg-jpv-surface' : ''
                      }`}
                    >
                      {notification.href ? (
                        <a
                          className='block transition hover:bg-jpv-surface'
                          href={notification.href}
                          onClick={() => {
                            if (!notification.read) void markOneRead(notification.id)
                            setOpen(false)
                          }}
                        >
                          {item}
                        </a>
                      ) : (
                        <div
                          className='cursor-default'
                          onClick={() => {
                            if (!notification.read) void markOneRead(notification.id)
                          }}
                        >
                          {item}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className='border-t border-jpv-border px-4 py-3'>
            <Link
              className='block text-center text-sm text-jpv-brand-deep transition hover:text-jpv-ink'
              href='/portal/notifications'
              onClick={() => setOpen(false)}
            >
              View All
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
