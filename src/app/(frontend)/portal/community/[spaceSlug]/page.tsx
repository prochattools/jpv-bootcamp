import 'server-only'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSpaceBySlug, type CommunityAccessLabel, type CommunityStatus } from '@/lib/community/communityPreviewModel'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'

type PortalCommunitySpacePageProps = {
  params: Promise<{ spaceSlug: string }>
}

function accessBadge(accessLabel: CommunityAccessLabel): { label: string; className: string } {
  switch (accessLabel) {
    case 'pro':
      return { label: 'Pro', className: 'bg-amber-50 text-amber-700' }
    case 'free_and_pro':
      return { label: 'Free + Pro', className: 'bg-blue-50 text-blue-700' }
    case 'admin_preview':
      return { label: 'Admin preview', className: 'bg-purple-50 text-purple-700' }
  }
}

function statusBadge(status: CommunityStatus): { label: string; className: string } {
  switch (status) {
    case 'preview':
      return { label: 'Preview', className: 'bg-emerald-50 text-emerald-700' }
    case 'placeholder':
      return { label: 'Coming soon', className: 'bg-neutral-100 text-neutral-600' }
    case 'locked':
      return { label: 'Locked', className: 'bg-red-50 text-red-700' }
  }
}

export default async function PortalCommunitySpacePage({ params }: PortalCommunitySpacePageProps) {
  await requirePortalMember(`/portal/community/${(await params).spaceSlug}`)

  const { spaceSlug } = await params
  const space = getSpaceBySlug(spaceSlug)

  if (!space) notFound()

  const access = accessBadge(space.accessLabel)
  const status = statusBadge(space.status)

  return (
    <div className="space-y-8">
      <Link
        className="inline-flex text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline"
        href="/portal/community"
      >
        ← Back to community
      </Link>

      <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Community space
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{space.title}</h1>
            <p className="mt-4 text-sm leading-6 text-neutral-600">{space.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1 ${access.className}`}>{access.label}</span>
            <span className={`rounded-full px-3 py-1 ${status.className}`}>{status.label}</span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
          Preview only — no live community posting, messaging, or notifications are active.
        </div>
      </section>

      {space.previewThreads.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Threads</h2>
            <p className="mt-2 text-sm text-neutral-600">Preview placeholder threads shown for testing.</p>
          </div>
          <div className="space-y-4">
            {space.previewThreads.map((thread) => (
              <article key={thread.id} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="mt-3 text-lg font-semibold text-neutral-950">{thread.title}</h3>
                    <p className="mt-1 text-sm text-neutral-500">{thread.authorLabel}</p>
                  </div>
                  <div className="text-sm text-neutral-500 sm:text-right">
                    <p>{thread.replyCount} reply{thread.replyCount === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8">
          <p className="text-sm text-neutral-600">
            {space.lockReason ?? 'No threads are currently available in this space.'}
          </p>
          {space.status === 'locked' ? (
            <Link
              href="/upgrade"
              className="mt-4 inline-flex rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              View Pro membership
            </Link>
          ) : null}
        </section>
      )}
    </div>
  )
}
