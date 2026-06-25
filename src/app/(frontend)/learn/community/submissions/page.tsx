import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import {
  getMemberCommunitySubmissions,
  type MemberCommunitySubmission,
  type MemberCommunitySubmissionStatus,
} from '@/lib/payloadCourse/communityModeration'

import { PortalShell, StatusPill } from '../../PortalShell'

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

function statusTone(
  status: MemberCommunitySubmissionStatus
): 'good' | 'warn' | 'neutral' {
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
    <article className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_14px_35px_rgba(31,52,43,0.07)]'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-xs font-bold uppercase tracking-[0.16em] text-[#8a7450]'>
          {kindLabel(item.kind)}
        </p>
        <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
      </div>

      <h2 className='mt-4 text-xl font-bold text-[#153f2e]'>{item.title}</h2>
      <p className='mt-2 text-sm text-[#68766f]'>
        {item.spaceName} · {formatDate(item.createdAt)}
      </p>

      {item.downloadUrl && (
        <Link
          className='mt-5 inline-flex rounded-full border border-[#153f2e]/20 px-5 py-2.5 text-sm font-bold text-[#153f2e] transition hover:border-[#8a7450]'
          href={item.downloadUrl}
        >
          Download published file
        </Link>
      )}
    </article>
  )
}

export default async function CommunitySubmissionsPage() {
  const destination = '/learn/community/submissions'
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    redirect(`/learn/login?next=${encodeURIComponent(destination)}`)
  }

  const submissions = await getMemberCommunitySubmissions(payload, member.id)
  const email = typeof member.email === 'string' ? member.email : null

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14'>
        <Link
          className='text-sm font-bold text-[#6c5a36] hover:text-[#153f2e]'
          href='/learn/community'
        >
          Back to community
        </Link>

        <section className='mt-6 rounded-[28px] bg-[#153f2e] p-8 text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)] sm:p-10 lg:p-14'>
          <StatusPill tone='neutral'>My submissions</StatusPill>
          <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
            Track your community submissions.
          </h1>
          <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
            Review whether your posts, comments, and files are pending review,
            published, or no longer published.
          </p>
        </section>

        {submissions.length > 0 ? (
          <section className='mt-12 grid gap-6 lg:grid-cols-2'>
            {submissions.map((item, index) => (
              <SubmissionCard
                item={item}
                key={`${item.kind}:${item.title}:${item.createdAt ?? 'unknown'}:${index}`}
              />
            ))}
          </section>
        ) : (
          <section className='mt-12 rounded-[24px] border border-dashed border-[#153f2e]/20 bg-[#f4f1e9] p-8 text-[#64736c]'>
            You have not submitted any community posts, comments, or files yet.
          </section>
        )}
      </main>
    </PortalShell>
  )
}
