import Link from 'next/link'

import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
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
  return new Intl.DateTimeFormat('en', {
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
    <article className='rounded-jpv-card border border-[var(--jpv-brand-deep)]/10 bg-white p-6 shadow-jpv-card'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-xs font-bold uppercase tracking-[0.16em] text-[var(--jpv-sunshine-ink)]'>{kindLabel(item.kind)}</p>
        <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
      </div>

      <h2 className='mt-4 text-xl font-bold text-[var(--jpv-brand-deep)]'>{item.title}</h2>
      <p className='mt-2 text-sm text-[var(--jpv-muted)]'>
        {item.spaceName} · {formatDate(item.createdAt)}
      </p>

      {item.downloadUrl && (
        <Link
          className='mt-5 inline-flex rounded-full border border-[var(--jpv-brand-deep)]/20 px-5 py-2.5 text-sm font-bold text-[var(--jpv-brand-deep)] transition hover:border-[var(--jpv-sunshine-ink)]'
          href={item.downloadUrl}
        >
          Download published file
        </Link>
      )}
    </article>
  )
}

export default async function CommunitySubmissionsPage() {
  const { memberId, memberEmail, payload } = await requirePortalMember('/portal/community/submissions')
  const submissions = await getMemberCommunitySubmissions(payload, memberId)

  return (
    <div className='mx-auto max-w-6xl space-y-10'>
      <Link className='text-sm font-bold text-[var(--jpv-sunshine-ink)] hover:text-[var(--jpv-brand-deep)]' href='/portal/community'>
        Back to community
      </Link>

      <section className='rounded-jpv-panel bg-[var(--jpv-brand-deep)] p-8 text-white shadow-jpv-card sm:p-10 lg:p-14'>
        <StatusPill tone='neutral'>My submissions</StatusPill>
        <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
          Track your community submissions.
        </h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-[var(--jpv-inverse-muted)] sm:text-lg'>
          Review whether your posts, comments, and files are pending review, published, or no longer published.
        </p>
        <p className='mt-4 text-sm text-[var(--jpv-inverse-muted)]'>{memberEmail}</p>
      </section>

      {submissions.length > 0 ? (
        <section className='grid gap-6 lg:grid-cols-2'>
          {submissions.map((item, index) => (
            <SubmissionCard item={item} key={`${item.kind}:${item.title}:${item.createdAt ?? 'unknown'}:${index}`} />
          ))}
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-dashed border-[var(--jpv-brand-deep)]/20 bg-[var(--jpv-surface)] p-8 text-[var(--jpv-muted)]'>
          You have not submitted any community posts, comments, or files yet.
        </section>
      )}
    </div>
  )
}
