import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import {
  getMemberAnnouncements,
  getMemberCommunityDashboard,
} from '@/lib/payloadCourse/communityPortal'

import { PortalShell, StatusPill } from '../PortalShell'

export const metadata = {
  title: 'Community | JPV Bootcamp',
  description: 'Your JPV Bootcamp community spaces and member access.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function visibilityLabel(value: string) {
  return value === 'members'
    ? 'Members'
    : value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: string | null) {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default async function LearnCommunityPage() {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn/community')
  }

  const [dashboard, announcements] = await Promise.all([
    getMemberCommunityDashboard(payload, member.id),
    getMemberAnnouncements(payload, member.id),
  ])
  const email = typeof member.email === 'string' ? member.email : null
  const unlockedCount = dashboard.spaces.filter((space) => space.allowed).length

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='rounded-[28px] bg-[#153f2e] p-8 text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)] sm:p-10 lg:p-14'>
          <span className='inline-flex rounded-full border border-[#e2d5aa]/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e6d9b1]'>
            Member community
          </span>
          <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
            Your JPV Bootcamp community spaces appear according to your member access.
          </h1>
          <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
            Public spaces can appear to active members, private spaces show a lock state, and secret spaces stay hidden unless your account has access.
          </p>
          <div className='mt-8 flex flex-wrap gap-3'>
            <StatusPill tone='neutral'>{unlockedCount} unlocked</StatusPill>
            <StatusPill tone='neutral'>{dashboard.spaces.length} visible spaces</StatusPill>
          </div>
        </section>

        <section className='mt-14'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
              Announcements
            </p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>Latest updates</h2>
            <p className='mt-2 max-w-2xl text-[#64736c]'>
              Only announcements from community spaces available to your member account appear here.
            </p>
          </div>

          <div className='mt-8 space-y-4'>
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <article
                  className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_14px_35px_rgba(31,52,43,0.07)]'
                  key={announcement.id}
                >
                  <div className='flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>
                    {announcement.pinned ? <span>Pinned</span> : null}
                    <span>{announcement.spaceName}</span>
                    <span>{formatDate(announcement.createdAt)}</span>
                  </div>
                  <h3 className='mt-3 text-xl font-bold text-[#153f2e]'>{announcement.title}</h3>
                  {announcement.spaceSlug ? (
                    <Link
                      className='mt-4 inline-flex text-sm font-bold text-[#6c5a36] hover:text-[#153f2e]'
                      href={`/learn/community/${announcement.spaceSlug}`}
                    >
                      Open announcement space
                    </Link>
                  ) : null}
                </article>
              ))
            ) : (
              <div className='rounded-[22px] border border-dashed border-[#153f2e]/20 bg-[#f4f1e9] p-7'>
                <h3 className='text-xl font-bold text-[#153f2e]'>No announcements available</h3>
                <p className='mt-3 text-sm leading-6 text-[#68766f]'>
                  New announcements from your authorized community spaces will appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className='mt-14'>
          <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
                Community spaces
              </p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>My spaces</h2>
              <p className='mt-2 max-w-2xl text-[#64736c]'>
                Locked private spaces do not load posts. Secret spaces are omitted until access is granted.
              </p>
            </div>
          </div>

          <div className='mt-8 grid gap-6 lg:grid-cols-3'>
            {dashboard.spaces.map((space) => (
              <article
                className={`overflow-hidden rounded-[24px] border bg-white shadow-[0_16px_45px_rgba(31,52,43,0.08)] ${
                  space.allowed ? 'border-[#b7a56f]' : 'border-[#153f2e]/10'
                }`}
                key={space.id}
              >
                <div className={`relative h-32 ${space.allowed ? 'bg-[#214e3a]' : 'bg-[#4d514d]'}`}>
                  <div className='absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%),radial-gradient(circle_at_80%_70%,white_0,transparent_28%)]' />
                  <div className='absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#153f2e]'>
                    {visibilityLabel(space.visibility)}
                  </div>
                  {!space.allowed && (
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <div className='rounded-full border border-white/30 bg-black/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur'>
                        Locked
                      </div>
                    </div>
                  )}
                </div>

                <div className='p-6'>
                  <h3 className='text-xl font-bold tracking-tight text-[#153f2e]'>{space.name}</h3>
                  <p className='mt-3 min-h-[72px] text-sm leading-6 text-[#68766f]'>
                    {space.description ?? 'Space description pending.'}
                  </p>

                  <div className='mt-5 flex items-center gap-4 text-xs font-semibold text-[#66766e]'>
                    <span>{space.spaceType ?? 'space'}</span>
                    <span className='h-1 w-1 rounded-full bg-[#9cab9f]' />
                    <span>
                      {space.allowed && space.postCount !== null
                        ? `${space.postCount} visible posts`
                        : 'Posts hidden'}
                    </span>
                  </div>

                  {space.allowed && space.slug ? (
                    <Link
                      className='mt-6 flex w-full justify-center rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white'
                      href={`/learn/community/${space.slug}`}
                    >
                      Open space
                    </Link>
                  ) : (
                    <div className='mt-6 rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4'>
                      <p className='text-sm font-semibold text-[#153f2e]'>Access blocked</p>
                      <p className='mt-2 text-sm leading-6 text-[#68766f]'>{space.lockReason}</p>
                      {space.canRequestAccess && (
                        <p className='mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7450]'>
                          Request flow pending admin approval
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
