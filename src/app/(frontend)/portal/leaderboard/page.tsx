import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getLeaderboard } from '@/lib/payloadCourse/leaderboard'

export const metadata = {
  title: 'Leaderboard | JPV Bootcamp',
  description: 'Top community members ranked by activity and engagement.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default async function LeaderboardPage() {
  await requirePortalMember('/portal/leaderboard')

  const entries = await getLeaderboard(20)

  return (
    <div className='space-y-10'>
      <section className='rounded-jpv-panel bg-jpv-brand-deep p-8 text-jpv-canvas shadow-jpv-card sm:p-10 lg:p-12'>
        <span className='inline-flex rounded-jpv-pill border border-jpv-sunshine/30 bg-jpv-canvas/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine'>
          Community leaderboard
        </span>
        <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
          Top community members
        </h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
          Members ranked by community engagement — posts, comments, and likes received.
        </p>
      </section>

      <section>
        {entries.length === 0 ? (
          <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-8 text-center text-jpv-muted'>
            No community activity recorded yet.
          </div>
        ) : (
          <div className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-canvas shadow-jpv-card'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-jpv-border bg-jpv-surface text-left'>
                  <th className='px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted'>#</th>
                  <th className='px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted'>Member</th>
                  <th className='hidden px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted sm:table-cell'>Posts</th>
                  <th className='hidden px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted sm:table-cell'>Comments</th>
                  <th className='hidden px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted md:table-cell'>Likes</th>
                  <th className='px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted'>Score</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-jpv-border'>
                {entries.map((entry) => (
                  <tr className='transition hover:bg-jpv-surface' key={entry.memberId}>
                    <td className='px-6 py-4 text-sm font-semibold text-jpv-muted'>
                      {MEDAL[entry.rank] ?? entry.rank}
                    </td>
                    <td className='px-6 py-4'>
                      <Link
                        className='flex items-center gap-3 hover:text-jpv-brand-deep'
                        href={`/portal/members/${entry.memberId}`}
                      >
                        {entry.avatarUrl ? (
                          <img
                            alt={entry.displayName}
                            className='h-9 w-9 shrink-0 rounded-full object-cover'
                            src={entry.avatarUrl}
                          />
                        ) : (
                          <div
                            aria-hidden='true'
                            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jpv-surface text-sm font-semibold text-jpv-brand-deep'
                          >
                            {entry.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className='text-sm font-semibold text-jpv-ink'>{entry.displayName}</span>
                      </Link>
                    </td>
                    <td className='hidden px-6 py-4 text-right text-sm text-jpv-muted sm:table-cell'>{entry.postCount}</td>
                    <td className='hidden px-6 py-4 text-right text-sm text-jpv-muted sm:table-cell'>{entry.commentCount}</td>
                    <td className='hidden px-6 py-4 text-right text-sm text-jpv-muted md:table-cell'>{entry.likesReceived}</td>
                    <td className='px-6 py-4 text-right text-sm font-bold text-jpv-brand-deep'>{entry.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className='mt-4 text-xs text-jpv-muted'>
          Score = (posts × 5) + (comments × 2) + (likes received × 3)
        </p>
      </section>
    </div>
  )
}
