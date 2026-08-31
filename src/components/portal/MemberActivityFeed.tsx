import Link from 'next/link'

import type { MemberActivityPage } from '@/lib/payloadCourse/memberActivity'

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function actionLabel(action: 'posted' | 'replied' | 'reacted'): string {
  if (action === 'posted') return 'posted a discussion'
  if (action === 'replied') return 'replied to a discussion'
  return 'reacted to a discussion'
}

export function MemberActivityFeed({ activity, nextHref }: { activity: MemberActivityPage; nextHref?: string }) {
  return (
    <section aria-labelledby='member-activity-heading' className='space-y-4'>
      <div>
        <p className='jpv-eyebrow'>Community pulse</p>
        <h2 className='mt-2 text-2xl font-semibold text-jpv-ink' id='member-activity-heading'>Recent member activity</h2>
        <p className='mt-1 text-sm text-jpv-muted'>Posts, replies, and reactions from spaces you can access.</p>
      </div>
      {activity.items.length === 0 ? (
        <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted'>No recent activity to display.</div>
      ) : (
        <ol className='space-y-3'>
          {activity.items.map((item) => (
            <li className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 shadow-jpv-card' key={item.id}>
              <div className='flex items-start gap-3'>
                {item.actor.avatarUrl ? (
                  <img alt='' className='h-10 w-10 shrink-0 rounded-full object-cover' src={item.actor.avatarUrl} />
                ) : (
                  <div aria-hidden='true' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jpv-surface text-sm font-semibold text-jpv-brand-deep'>
                    {item.actor.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className='min-w-0 flex-1'>
                  <p className='text-sm text-jpv-ink'>
                    {item.actor.memberId ? <Link className='font-semibold hover:text-jpv-brand-deep hover:underline' href={`/portal/members/${encodeURIComponent(item.actor.memberId)}`}>{item.actor.displayName}</Link> : <span className='font-semibold'>{item.actor.displayName}</span>}{' '}
                    {actionLabel(item.action)} <span className='text-jpv-muted'>{item.context}</span>
                  </p>
                  {item.excerpt ? <p className='mt-2 line-clamp-3 text-sm leading-6 text-jpv-muted'>{item.excerpt}</p> : null}
                  <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-jpv-muted'>
                    <time dateTime={item.createdAt ?? undefined}>{formatDate(item.createdAt)}</time>
                    <Link className='font-semibold text-jpv-brand-deep hover:underline' href={item.href}>Open discussion</Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {activity.hasMore && nextHref ? <Link className='jpv-button-secondary inline-flex min-h-10' href={nextHref}>Load more activity</Link> : null}
    </section>
  )
}
