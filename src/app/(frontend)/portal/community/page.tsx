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

const ANNOUNCEMENTS_PREVIEW = 3
const RESOURCES_PREVIEW = 5

export default async function PortalCommunityPage() {
  const { memberId, payload } = await requirePortalMember('/portal/community')
  const dedupPayload = withQueryDedup(payload)

  const [dashboard, announcements, files] = await Promise.all([
    getMemberCommunityDashboard(dedupPayload, memberId),
    getMemberAnnouncements(dedupPayload, memberId),
    getMemberCommunityFiles(dedupPayload, memberId),
  ])
  const unlockedCount = dashboard.spaces.filter((space) => space.allowed).length
  const previewAnnouncements = announcements.slice(0, ANNOUNCEMENTS_PREVIEW)
  const hasMoreAnnouncements = announcements.length > ANNOUNCEMENTS_PREVIEW
  const previewFiles = files.slice(0, RESOURCES_PREVIEW)
  const hasMoreFiles = files.length > RESOURCES_PREVIEW

  return (
    <div className='mx-auto w-full max-w-5xl space-y-10'>

      {/* 1. Page header */}
      <header>
        <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Member community</p>
        <h1 className='mt-2 text-4xl font-bold tracking-tight text-jpv-brand-deep'>Community</h1>
        <p className='mt-2 text-base text-jpv-muted'>Connect with fellow bootcamp members</p>
        <div className='mt-5 flex flex-wrap items-center gap-3'>
          <StatusPill tone='neutral'>{unlockedCount} unlocked</StatusPill>
          <StatusPill tone='neutral'>{dashboard.spaces.length} visible spaces</StatusPill>
        </div>
        <nav aria-label='Community navigation' className='mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold'>
          <Link
            className='min-h-11 inline-flex items-center text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
            href='/portal/courses'
          >
            Browse courses
          </Link>
          <Link
            className='min-h-11 inline-flex items-center text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
            href='/portal'
          >
            Back to dashboard
          </Link>
        </nav>
      </header>

      {/* 2. Announcements — prominent, highlighted card at top */}
      <section aria-labelledby='community-announcements-heading'>
        <div className='flex items-baseline justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Announcements</p>
            <h2 className='mt-1 text-2xl font-bold tracking-tight text-jpv-brand-deep' id='community-announcements-heading'>
              Latest updates
            </h2>
          </div>
          {hasMoreAnnouncements && (
            <span className='shrink-0 text-sm font-semibold text-jpv-muted'>
              +{announcements.length - ANNOUNCEMENTS_PREVIEW} more
            </span>
          )}
        </div>

        <div className='mt-4 space-y-3'>
          {previewAnnouncements.length > 0 ? (
            previewAnnouncements.map((announcement) => (
              <article
                className='rounded-jpv-card border border-orange-200 bg-orange-50 p-5'
                key={announcement.id}
              >
                <div className='flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>
                  {announcement.pinned ? (
                    <span className='rounded-full bg-jpv-sunshine/20 px-2 py-0.5'>Pinned</span>
                  ) : null}
                  <span>{announcement.spaceName}</span>
                  <span className='text-jpv-muted font-normal normal-case tracking-normal'>·</span>
                  <span>{formatDate(announcement.createdAt)}</span>
                </div>
                <h3 className='mt-2 text-lg font-bold text-jpv-brand-deep'>{announcement.title}</h3>
                {announcement.spaceSlug ? (
                  <Link
                    className='mt-3 inline-flex text-sm font-bold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
                    href={`/portal/community/${announcement.spaceSlug}`}
                  >
                    Open announcement space →
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div
              className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-5'
              role='status'
            >
              <p className='font-semibold text-jpv-brand-deep'>No announcements yet</p>
              <p className='mt-1 text-sm leading-6 text-jpv-muted'>
                New announcements from your authorized community spaces will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Spaces grid — responsive card grid */}
      <section aria-labelledby='community-spaces-heading'>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Community spaces</p>
          <h2 className='mt-1 text-2xl font-bold tracking-tight text-jpv-brand-deep' id='community-spaces-heading'>
            My spaces
          </h2>
          <p className='mt-1 max-w-2xl text-sm text-jpv-muted'>
            Locked private spaces do not load posts. Secret spaces are omitted until access is granted.
          </p>
        </div>

        <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {dashboard.spaces.map((space) => (
            <article
              className={`overflow-hidden rounded-xl border bg-jpv-canvas shadow-sm transition-shadow hover:shadow-md ${
                space.allowed ? 'border-jpv-brand/30' : 'border-jpv-border'
              }`}
              key={space.id}
            >
              {/* Card header strip */}
              <div
                className={`relative flex h-24 items-end px-4 pb-3 ${
                  space.allowed ? 'bg-jpv-brand-deep' : 'bg-jpv-surface-strong'
                }`}
              >
                <div className='absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%)]' />
                <div className='relative flex w-full items-center justify-between gap-2'>
                  <span className='rounded-full bg-jpv-canvas/90 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-[0.14em] text-jpv-brand-deep'>
                    {visibilityLabel(space.visibility)}
                  </span>
                  {!space.allowed && (
                    <span className='rounded-full border border-white/30 bg-black/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm'>
                      Locked
                    </span>
                  )}
                </div>
              </div>

              <div className='p-4'>
                <h3 className='text-base font-bold tracking-tight text-jpv-brand-deep'>{space.name}</h3>
                <p className='mt-1.5 line-clamp-2 text-sm leading-5 text-jpv-muted'>
                  {space.description ?? 'Space description pending.'}
                </p>

                <div className='mt-3 flex items-center gap-3 text-xs font-semibold text-jpv-muted'>
                  <span>{space.spaceType ?? 'space'}</span>
                  <span className='h-1 w-1 rounded-full bg-jpv-border' />
                  <span>
                    {space.allowed && space.postCount !== null
                      ? `${space.postCount} posts`
                      : 'Posts hidden'}
                  </span>
                </div>

                {space.allowed && space.slug ? (
                  <Link
                    className='jpv-button-primary mt-4 w-full justify-center'
                    href={`/portal/community/${space.slug}`}
                  >
                    Open space
                  </Link>
                ) : (
                  <div className='mt-4 rounded-lg border border-jpv-border bg-jpv-surface p-3'>
                    <p className='text-xs font-semibold text-jpv-brand-deep'>Access blocked</p>
                    <p className='mt-1 text-xs leading-5 text-jpv-muted'>{space.lockReason}</p>
                    {space.canRequestAccess && (
                      <p className='mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
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

      {/* 4. Resources — secondary section, compact list */}
      <section aria-labelledby='community-resources-heading'>
        <div className='flex items-baseline justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Shared files</p>
            <h2 className='mt-1 text-2xl font-bold tracking-tight text-jpv-brand-deep' id='community-resources-heading'>
              Resources
            </h2>
          </div>
          {hasMoreFiles && (
            <span className='shrink-0 text-sm font-semibold text-jpv-muted'>
              +{files.length - RESOURCES_PREVIEW} more files
            </span>
          )}
        </div>

        <div className='mt-4'>
          {previewFiles.length > 0 ? (
            <ul
              className='divide-y divide-jpv-border rounded-jpv-card border border-jpv-border bg-jpv-canvas'
              role='list'
            >
              {previewFiles.map((file) => (
                <li className='flex items-center gap-3 px-4 py-3' key={file.id}>
                  <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-jpv-surface text-xs font-bold text-jpv-muted'>
                    {'mimeType' in file && file.mimeType
                      ? (file.mimeType.split('/')[1]?.slice(0, 3).toUpperCase() ?? '—')
                      : '—'}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold text-jpv-brand-deep'>{file.title}</p>
                    <p className='text-xs text-jpv-muted'>
                      {file.spaceName}
                      {'byteSize' in file && typeof file.byteSize === 'number'
                        ? ` · ${formatByteSize(file.byteSize)}`
                        : null}
                    </p>
                  </div>
                  {'downloadUrl' in file && file.downloadUrl ? (
                    <Link
                      className='shrink-0 text-xs font-bold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
                      href={file.downloadUrl}
                    >
                      Download
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div
              className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface px-4 py-5 text-sm text-jpv-muted'
              role='status'
            >
              No shared community files are currently available to your account.
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
