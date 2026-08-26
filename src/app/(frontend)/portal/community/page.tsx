import Link from 'next/link'

import { AdminGate } from '@/components/portal/AdminGate'
import { SpaceAdminPanel } from '@/components/portal/admin/SpaceAdminPanel'
import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
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
  const { actor, payload } = await requirePortalAccess('/portal/community')
  const isAdmin = actor.kind === 'admin'
  const dedupPayload = withQueryDedup(payload)

  // For member path use their ID; for admin path use empty string which the
  // member projection handles by returning only public/members-visible spaces.
  // Admin sees the real space list via the direct Payload query below.
  const memberId = actor.kind === 'member' ? actor.memberId : ''

  const [dashboard, announcements, files, adminSpacesResult] = await Promise.all([
    getMemberCommunityDashboard(dedupPayload, memberId),
    getMemberAnnouncements(dedupPayload, memberId),
    getMemberCommunityFiles(dedupPayload, memberId),
    // Admin-only: fetch all spaces including hidden/archived for the admin panel
    isAdmin
      ? dedupPayload.find({
          collection: 'payload_spaces',
          sort: 'sortOrder',
          limit: 200,
          depth: 0,
          overrideAccess: true,
        })
      : Promise.resolve(null),
  ])

  const unlockedCount = dashboard.spaces.filter((space) => space.allowed).length
  const previewAnnouncements = announcements.slice(0, ANNOUNCEMENTS_PREVIEW)
  const hasMoreAnnouncements = announcements.length > ANNOUNCEMENTS_PREVIEW
  const previewFiles = files.slice(0, RESOURCES_PREVIEW)
  const hasMoreFiles = files.length > RESOURCES_PREVIEW

  // Admin panel receives the real all-spaces list (including archived)
  const adminPanelSpaces = adminSpacesResult
    ? adminSpacesResult.docs.map((s: Record<string, unknown>) => ({
        id: String(s['id']),
        name: String(s['name'] ?? ''),
        slug: String(s['slug'] ?? ''),
        description: String(s['description'] ?? ''),
        visibility: (['public', 'members', 'private', 'secret'].includes(String(s['visibility']))
          ? s['visibility']
          : 'members') as 'public' | 'members' | 'private' | 'secret',
        status: String(s['status'] ?? 'draft'),
      }))
    : []

  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>

      {/* 1. Page header — compact */}
      <header>
        <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Member community</p>
        <h1 className='mt-1 text-3xl font-bold tracking-tight text-jpv-brand-deep'>Community</h1>
        <div className='mt-3 flex flex-wrap items-center gap-3'>
          <StatusPill tone='neutral'>{unlockedCount} unlocked</StatusPill>
          <StatusPill tone='neutral'>{dashboard.spaces.length} visible spaces</StatusPill>
          <Link
            className='text-sm font-semibold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
            href='/portal/courses'
          >
            Browse courses
          </Link>
          <Link
            className='text-sm font-semibold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
            href='/portal'
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      {/* Admin space management — uses full admin space list, not member projection */}
      <AdminGate>
        <SpaceAdminPanel spaces={adminPanelSpaces} />
      </AdminGate>

      {/* 2. Spaces — primary navigation, shown first */}
      <section aria-labelledby='community-spaces-heading'>
        <div>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Community spaces</p>
          <h2 className='mt-1 text-xl font-bold tracking-tight text-jpv-brand-deep' id='community-spaces-heading'>
            My spaces
          </h2>
        </div>

        <div className='mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'>
          {dashboard.spaces.map((space) => (
            <article
              className={`overflow-hidden rounded-lg border bg-jpv-canvas shadow-sm transition-shadow hover:shadow-md ${
                space.allowed ? 'border-jpv-brand/30' : 'border-jpv-border'
              }`}
              key={space.id}
            >
              {/* Thin accent bar replaces the tall gradient header */}
              <div
                className={`h-2 ${space.allowed ? 'bg-jpv-brand-deep' : 'bg-jpv-surface-strong'}`}
              />

              <div className='p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <h3 className='text-sm font-bold tracking-tight text-jpv-brand-deep leading-snug'>{space.name}</h3>
                  <div className='flex shrink-0 items-center gap-1.5'>
                    <span className='rounded-full bg-jpv-surface px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-jpv-muted'>
                      {visibilityLabel(space.visibility)}
                    </span>
                    {!space.allowed && (
                      <span className='rounded-full border border-jpv-border bg-jpv-surface px-2 py-0.5 text-xs font-semibold text-jpv-muted'>
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                <p className='mt-1 line-clamp-1 text-xs leading-4 text-jpv-muted'>
                  {space.description ?? 'Space description pending.'}
                </p>

                <div className='mt-2 flex items-center justify-between gap-2'>
                  <span className='text-xs text-jpv-muted'>
                    {space.spaceType ?? 'space'}
                    {' · '}
                    {space.allowed && space.postCount !== null
                      ? `${space.postCount} posts`
                      : 'posts hidden'}
                  </span>

                  {(space.allowed || isAdmin) && space.slug ? (
                    <Link
                      className='shrink-0 text-xs font-bold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
                      href={`/portal/community/${space.slug}`}
                    >
                      Open space →
                    </Link>
                  ) : (
                    <span className='shrink-0 text-xs font-semibold text-jpv-muted'>
                      {space.canRequestAccess ? 'Request pending' : 'No access'}
                    </span>
                  )}
                </div>

                {!space.allowed && space.lockReason ? (
                  <p className='mt-1.5 text-xs leading-4 text-jpv-muted italic'>{space.lockReason}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. Announcements — compact list */}
      <section aria-labelledby='community-announcements-heading'>
        <div className='flex items-baseline justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Announcements</p>
            <h2 className='mt-1 text-xl font-bold tracking-tight text-jpv-brand-deep' id='community-announcements-heading'>
              Latest updates
            </h2>
          </div>
          {hasMoreAnnouncements && (
            <span className='shrink-0 text-xs font-semibold text-jpv-muted'>
              +{announcements.length - ANNOUNCEMENTS_PREVIEW} more
            </span>
          )}
        </div>

        <div className='mt-3'>
          {previewAnnouncements.length > 0 ? (
            <ul
              className='divide-y divide-jpv-border rounded-jpv-card border border-jpv-border bg-jpv-canvas'
              role='list'
            >
              {previewAnnouncements.map((announcement) => (
                <li className='flex items-center gap-3 px-4 py-2.5' key={announcement.id}>
                  <div className='min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                    {announcement.pinned ? (
                      <span className='rounded-full bg-jpv-sunshine/20 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
                        Pinned
                      </span>
                    ) : null}
                    <span className='text-xs font-bold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
                      {announcement.spaceName}
                    </span>
                    <span className='truncate text-sm font-semibold text-jpv-brand-deep'>
                      {announcement.title}
                    </span>
                    <span className='text-xs text-jpv-muted'>{formatDate(announcement.createdAt)}</span>
                  </div>
                  {announcement.spaceSlug ? (
                    <Link
                      className='shrink-0 text-xs font-bold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
                      href={`/portal/community/${announcement.spaceSlug}`}
                    >
                      Open announcement space →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div
              className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface px-4 py-3 text-sm text-jpv-muted'
              role='status'
            >
              No announcements yet — new updates from your community spaces will appear here.
            </div>
          )}
        </div>
      </section>

      {/* 4. Resources — compact list */}
      <section aria-labelledby='community-resources-heading'>
        <div className='flex items-baseline justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Shared files</p>
            <h2 className='mt-1 text-xl font-bold tracking-tight text-jpv-brand-deep' id='community-resources-heading'>
              Resources
            </h2>
          </div>
          {hasMoreFiles && (
            <span className='shrink-0 text-xs font-semibold text-jpv-muted'>
              +{files.length - RESOURCES_PREVIEW} more files
            </span>
          )}
        </div>

        <div className='mt-3'>
          {previewFiles.length > 0 ? (
            <ul
              className='divide-y divide-jpv-border rounded-jpv-card border border-jpv-border bg-jpv-canvas'
              role='list'
            >
              {previewFiles.map((file) => (
                <li className='flex items-center gap-3 px-4 py-2.5' key={file.id}>
                  <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded bg-jpv-surface text-xs font-bold text-jpv-muted'>
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
              className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface px-4 py-3 text-sm text-jpv-muted'
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
