import Link from 'next/link'

import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import {
  getMemberCommunitySubmissions,
  type MemberCommunitySubmission,
  type MemberCommunitySubmissionStatus,
} from '@/lib/payloadCourse/communityModeration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function statusTone(status: MemberCommunitySubmissionStatus): 'good' | 'warn' | 'neutral' {
  if (status === 'Published') return 'good'
  if (status === 'Pending review') return 'warn'
  return 'neutral'
}

function kindLabel(kind: MemberCommunitySubmission['kind']): string {
  if (kind === 'post') return 'Post'
  if (kind === 'comment') return 'Comment'
  return 'File'
}

function SubmissionCard({ item }: { item: MemberCommunitySubmission }) {
  return (
    <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='jpv-eyebrow'>{kindLabel(item.kind)}</p>
        <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
      </div>

      <h2 className='mt-4 text-xl font-semibold text-jpv-ink'>{item.title}</h2>
      <p className='mt-2 text-sm text-jpv-muted'>
        {item.spaceName} · {formatDate(item.createdAt)}
      </p>

      {item.downloadUrl ? (
        <Link className='jpv-button-secondary mt-5 min-h-11' href={item.downloadUrl}>
          Download published file
        </Link>
      ) : null}
    </article>
  )
}

export default async function CommunitySubmissionsPage() {
  const { actor, payload } = await requirePortalAccess('/portal/community/submissions')

  if (actor.kind === 'admin') {
    return (
      <div className='space-y-6'>
        <Link className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-brand-deep hover:underline' href='/portal/community'>
          Back to community
        </Link>
        <header className='rounded-jpv-panel bg-jpv-brand-deep p-6 text-jpv-canvas shadow-jpv-card sm:p-8'>
          <StatusPill tone='neutral'>My submissions</StatusPill>
          <h1 className='mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl'>Track your community submissions.</h1>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-inverse-muted sm:text-base'>
            Review whether your posts, comments, and files are pending review, published, or no longer published.
          </p>
        </header>
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-surface p-6 text-sm text-jpv-muted'>
          Admin view — personal submissions are not available for administrator accounts.
        </section>
      </div>
    )
  }

  const memberId = actor.memberId
  const memberEmail = actor.email
  const submissions = await getMemberCommunitySubmissions(payload, memberId)

  return (
    <div className='space-y-6'>
      <Link className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-brand-deep hover:underline' href='/portal/community'>
        Back to community
      </Link>

      <header className='rounded-jpv-panel bg-jpv-brand-deep p-6 text-jpv-canvas shadow-jpv-card sm:p-8'>
        <StatusPill tone='neutral'>My submissions</StatusPill>
        <h1 className='mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl'>Track your community submissions.</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-inverse-muted sm:text-base'>
          Review whether your posts, comments, and files are pending review, published, or no longer published.
        </p>
        <p className='mt-3 break-all text-sm text-jpv-inverse-muted'>{memberEmail}</p>
      </header>

      {submissions.length > 0 ? (
        <section className='grid gap-5 lg:grid-cols-2'>
          {submissions.map((item, index) => (
            <SubmissionCard item={item} key={`${item.kind}:${item.title}:${item.createdAt ?? 'unknown'}:${index}`} />
          ))}
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-surface p-6 text-sm text-jpv-muted'>
          You have not submitted any community posts, comments, or files yet.
        </section>
      )}
    </div>
  )
}
