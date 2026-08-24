import Link from 'next/link'

import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunityFiles } from '@/lib/payloadCourse/communityFileDelivery'
import {
  getMemberAnnouncements,
  getMemberCommunityDashboard,
  withQueryDedup,
} from '@/lib/payloadCourse/communityPortal'

export const metadata = {
  title: 'Community | JPV Bootcamp',
  description: 'Your JPV Bootcamp community spaces and member access.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function visibilityLabel(value: string) {
  return value === 'members' ? 'Members' : value.charAt(0).toUpperCase() + value.slice(1)
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

function formatByteSize(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default async function PortalCommunityPage() {
  const { memberId, payload } = await requirePortalMember('/portal/community')
  const dedupPayload = withQueryDedup(payload)

  const [dashboard, announcements, files] = await Promise.all([
    getMemberCommunityDashboard(dedupPayload, memberId),
    getMemberAnnouncements(dedupPayload, memberId),
    getMemberCommunityFiles(dedupPayload, memberId),
  ])
  const unlockedCount = dashboard.spaces.filter((space) => space.allowed).length

  return (
    <div className='mx-auto w-full max-w-6xl space-y-10'>
      <section aria-labelledby='community-overview-heading' className='rounded-jpv-panel bg-jpv-brand-deep p-6 text-jpv-canvas shadow-jpv-card sm:p-10 lg:p-12'>
        <span className='inline-flex rounded-jpv-pill border border-jpv-sunshine/30 bg-jpv-canvas/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine'>
          Member community
        </span>
        <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl' id='community-overview-heading'>
          Your JPV Bootcamp community spaces appear according to your member access.
        </h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
          Public spaces can appear to active members, private spaces show a lock state, and secret spaces stay hidden unless your account has access.
        </p>
        <div className='mt-8 flex flex-wrap gap-3'>
          <StatusPill tone='neutral'>{unlockedCount} unlocked</StatusPill>
          <StatusPill tone='neutral'>{dashboard.spaces.length} visible spaces</StatusPill>
        </div>
        <nav aria-label='Community navigation' className='mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-jpv-sunshine'>
          <Link className='min-h-11 inline-flex items-center underline-offset-4 hover:text-jpv-canvas hover:underline' href='/portal/courses'>
            Browse courses
          </Link>
          <Link className='min-h-11 inline-flex items-center underline-offset-4 hover:text-jpv-canvas hover:underline' href='/portal'>
            Back to dashboard
          </Link>
        </nav>
      </section>

      <section aria-labelledby='community-resources-heading'>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Shared files</p>
          <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep' id='community-resources-heading'>Community resources</h2>
          <p className='mt-2 max-w-2xl text-jpv-muted'>
            Only visible files from community spaces available to your member account appear here.
          </p>
        </div>

        <div className='mt-8 grid gap-5 md:grid-cols-2'>
          {files.length > 0 ? (
            files.map((file) => (
              <article
                className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'
                key={file.id}
              >
                <div className='flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
                  <span>{file.spaceName}</span>
                  {'byteSize' in file && typeof file.byteSize === 'number' ? <span>{formatByteSize(file.byteSize)}</span> : null}
                  {'mimeType' in file && file.mimeType ? <span>{file.mimeType}</span> : null}
                </div>
                <h3 className='mt-3 text-xl font-bold text-jpv-brand-deep'>{file.title}</h3>
                {'filename' in file && file.filename ? (
                  <p className='mt-2 break-all text-sm text-jpv-muted'>{file.filename}</p>
                ) : null}
                {'downloadUrl' in file && file.downloadUrl ? (
                  <Link
                    className='jpv-button-primary mt-5 min-h-11'
                    href={file.downloadUrl}
                  >
                    Download file
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-6 text-sm leading-6 text-jpv-muted md:col-span-2' role='status'>
              No shared community files are currently available to your account.
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby='community-announcements-heading'>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Announcements</p>
          <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep' id='community-announcements-heading'>Latest updates</h2>
          <p className='mt-2 max-w-2xl text-jpv-muted'>
            Only announcements from community spaces available to your member account appear here.
          </p>
        </div>

        <div className='mt-8 space-y-4'>
          {announcements.length > 0 ? (
            announcements.map((announcement) => (
              <article
                className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'
                key={announcement.id}
              >
                <div className='flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
                  {announcement.pinned ? <span>Pinned</span> : null}
                  <span>{announcement.spaceName}</span>
                  <span>{formatDate(announcement.createdAt)}</span>
                </div>
                <h3 className='mt-3 text-xl font-bold text-jpv-brand-deep'>{announcement.title}</h3>
                {announcement.spaceSlug ? (
                  <Link
                    className='mt-4 inline-flex text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep'
                    href={`/portal/community/${announcement.spaceSlug}`}
                  >
                    Open announcement space
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-7' role='status'>
              <h3 className='text-xl font-bold text-jpv-brand-deep'>No announcements available</h3>
              <p className='mt-3 text-sm leading-6 text-jpv-muted'>
                New announcements from your authorized community spaces will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby='community-spaces-heading'>
        <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Community spaces</p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep' id='community-spaces-heading'>My spaces</h2>
            <p className='mt-2 max-w-2xl text-jpv-muted'>
              Locked private spaces do not load posts. Secret spaces are omitted until access is granted.
            </p>
          </div>
        </div>

        <div className='mt-8 grid gap-6 lg:grid-cols-3'>
          {dashboard.spaces.map((space) => (
            <article
              className={`overflow-hidden rounded-jpv-panel border bg-jpv-canvas shadow-jpv-card ${
                space.allowed ? 'border-jpv-sunshine' : 'border-jpv-border'
              }`}
              key={space.id}
            >
              <div className={`relative h-32 ${space.allowed ? 'bg-jpv-brand-hover' : 'bg-jpv-muted'}`}>
                <div className='absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%),radial-gradient(circle_at_80%_70%,white_0,transparent_28%)]' />
                <div className='absolute left-5 top-5 rounded-full bg-jpv-canvas/90 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-jpv-brand-deep'>
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
                <h3 className='text-xl font-bold tracking-tight text-jpv-brand-deep'>{space.name}</h3>
                <p className='mt-3 min-h-[72px] text-sm leading-6 text-jpv-muted'>
                  {space.description ?? 'Space description pending.'}
                </p>

                <div className='mt-5 flex items-center gap-4 text-xs font-semibold text-jpv-muted'>
                  <span>{space.spaceType ?? 'space'}</span>
                  <span className='h-1 w-1 rounded-full bg-jpv-border' />
                  <span>{space.allowed && space.postCount !== null ? `${space.postCount} visible posts` : 'Posts hidden'}</span>
                </div>

                {space.allowed && space.slug ? (
                  <Link
                    className='jpv-button-primary mt-6 min-h-11 w-full justify-center'
                    href={`/portal/community/${space.slug}`}
                  >
                    Open space
                  </Link>
                ) : (
                  <div className='mt-6 rounded-2xl border border-jpv-border bg-jpv-surface p-4'>
                    <p className='text-sm font-semibold text-jpv-brand-deep'>Access blocked</p>
                    <p className='mt-2 text-sm leading-6 text-jpv-muted'>{space.lockReason}</p>
                    {space.canRequestAccess && (
                      <p className='mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
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
    </div>
  )
}
