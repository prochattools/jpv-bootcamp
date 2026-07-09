import Link from 'next/link'
import { getAllSpaces, getPublicSafeSummary } from '@/lib/community/communityPreviewModel'

export const dynamic = 'force-dynamic'

function accessBadge(accessLabel: string): { label: string; className: string } {
  switch (accessLabel) {
    case 'pro':
      return { label: 'Pro', className: 'bg-amber-50 text-amber-700' }
    case 'free_and_pro':
      return { label: 'Free + Pro', className: 'bg-blue-50 text-blue-700' }
    case 'admin_preview':
      return { label: 'Admin preview', className: 'bg-purple-50 text-purple-700' }
    default:
      return { label: accessLabel, className: 'bg-neutral-100 text-neutral-700' }
  }
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'preview':
      return { label: 'Preview', className: 'bg-emerald-50 text-emerald-700' }
    case 'placeholder':
      return { label: 'Coming soon', className: 'bg-neutral-100 text-neutral-600' }
    case 'locked':
      return { label: 'Locked', className: 'bg-red-50 text-red-700' }
    default:
      return { label: status, className: 'bg-neutral-100 text-neutral-700' }
  }
}

export default function CommunityPreviewPage() {
  const spaces = getAllSpaces()
  const summary = getPublicSafeSummary()

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            JPV Bootcamp
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
            Community preview
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-neutral-600">
            Preview of upcoming community spaces, forums, and rooms. Content is representative
            and does not reflect final live community state. Full community features will be
            available after migration and live cutover.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Preview only — no live community features, messaging, or notifications are active.
            {summary.proSpaceCount} of {summary.spaceCount} spaces require Pro membership.
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-neutral-950">Community spaces</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {spaces.map((space) => {
              const access = accessBadge(space.accessLabel)
              const status = statusBadge(space.status)

              return (
                <article
                  key={space.slug}
                  className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-neutral-950">{space.title}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{space.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${access.className}`}>
                      {access.label}
                    </span>
                    {space.previewThreads.length > 0 ? (
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                        {space.previewThreads.length} thread{space.previewThreads.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={space.status === 'locked' ? '/upgrade' : `/community/${space.slug}`}
                    className="mt-5 inline-flex text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
                  >
                    {space.status === 'locked' ? 'View Pro membership' : 'View space'}
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-950">About community access</h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-neutral-600">
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3">
              <span className="font-semibold text-amber-800">Pro:</span>{' '}
              Full access to all community spaces, forums, private rooms, and direct mentorship.
              Pro is the single paid JPV Bootcamp membership at £80/month or £880/year.
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
              <span className="font-semibold text-blue-800">Free:</span>{' '}
              Controlled non-paid access to public spaces only (announcements and resource library).
              Approved applicants receive Free access after manual review.
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/upgrade"
              className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              View Pro membership
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Preview dashboard
            </Link>
            <Link
              href="/portal"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Member portal
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
