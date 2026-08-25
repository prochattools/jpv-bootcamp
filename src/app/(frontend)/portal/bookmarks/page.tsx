import Link from 'next/link'

import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getMemberBookmarks } from '@/lib/payloadCourse/leaderboard'

export const metadata = {
  title: 'Bookmarks | JPV Bootcamp',
  description: 'Your bookmarked community posts.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default async function BookmarksPage() {
  const { actor } = await requirePortalAccess('/portal/bookmarks')

  if (actor.kind === 'admin') {
    return (
      <div className='space-y-6'>
        <section>
          <p className='jpv-eyebrow'>Administration</p>
          <h1 className='mt-3 text-2xl font-semibold tracking-tight text-jpv-ink'>Bookmarks</h1>
          <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
            Bookmarks are personal to each member. Navigate to community spaces to view and moderate content.
          </p>
        </section>
        <div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-8 text-center text-sm text-jpv-muted'>
          <Link className='font-semibold text-jpv-brand-deep underline-offset-4 hover:underline' href='/portal/community'>
            Go to Community
          </Link>
        </div>
      </div>
    )
  }

  const memberId = actor.memberId

  const bookmarks = await getMemberBookmarks(memberId)

  return (
    <div className='space-y-10'>
      <section className='rounded-jpv-panel bg-jpv-brand-deep p-8 text-jpv-canvas shadow-jpv-card sm:p-10 lg:p-12'>
        <span className='inline-flex rounded-jpv-pill border border-jpv-sunshine/30 bg-jpv-canvas/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine'>
          Bookmarks
        </span>
        <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
          Your saved posts
        </h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
          Community posts you have bookmarked for quick access.
        </p>
      </section>

      <section>
        {bookmarks.length === 0 ? (
          <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-8'>
            <h3 className='text-xl font-bold text-jpv-brand-deep'>No bookmarks yet</h3>
            <p className='mt-3 text-sm leading-6 text-jpv-muted'>
              Bookmark posts in a community space to find them quickly here.
            </p>
            <Link className='jpv-button-primary mt-5 inline-flex' href='/portal/community'>
              Browse community
            </Link>
          </div>
        ) : (
          <div className='space-y-4'>
            {bookmarks.map((bookmark) => (
              <article
                className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'
                key={bookmark.reactionId}
              >
                <div className='flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
                  <span>{bookmark.spaceName}</span>
                  {bookmark.createdAt && <span>{formatDate(bookmark.createdAt)}</span>}
                </div>
                <h3 className='mt-3 text-xl font-bold text-jpv-brand-deep'>{bookmark.postTitle}</h3>
                <Link
                  className='mt-4 inline-flex text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep'
                  href={`/portal/community/${bookmark.spaceSlug}`}
                >
                  Open space →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
