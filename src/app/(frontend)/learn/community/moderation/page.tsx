import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  getPendingCommunityModerationItems,
  moderatePendingCommunityItem,
  type PendingCommunityModerationItem,
} from '@/lib/payloadCourse/communityModeration'

import { PortalShell, StatusPill } from '../../PortalShell'
import { CommunityRichText } from '../CommunityRichText'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    decision?: string
  }>
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function isModerationKind(
  value: string
): value is PendingCommunityModerationItem['kind'] {
  return value === 'post' || value === 'comment' || value === 'file'
}

function isModerationDecision(
  value: string
): value is 'approve' | 'reject' {
  return value === 'approve' || value === 'reject'
}

async function submitModerationDecision(formData: FormData): Promise<void> {
  'use server'

  const destination = '/learn/community/moderation'
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect(`/learn/login?next=${encodeURIComponent(destination)}`)
  }

  const kind = formText(formData, 'kind')
  const id = formText(formData, 'id')
  const decision = formText(formData, 'decision')
  const reason = formText(formData, 'reason')

  if (
    !isModerationKind(kind) ||
    !id ||
    id.length > 200 ||
    !isModerationDecision(decision) ||
    reason.length > 500 ||
    (decision === 'reject' && !reason)
  ) {
    redirect(`${destination}?decision=error`)
  }

  const result = await moderatePendingCommunityItem(
    payload as unknown as PayloadCourseWriteAPI,
    {
      actor: { type: 'member', id: member.id },
      kind,
      id,
      decision,
      reason: reason || null,
    }
  )

  if (!result.allowed) {
    redirect(`${destination}?decision=error`)
  }

  revalidatePath(destination)
  revalidatePath('/learn/community')
  redirect(`${destination}?decision=success`)
}

function formatDate(value: string | null): string {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatByteSize(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function groupItems(items: PendingCommunityModerationItem[]) {
  const groups = new Map<string, {
    name: string
    slug: string | null
    items: PendingCommunityModerationItem[]
  }>()

  for (const item of items) {
    const key = `${item.space.name}\u0000${item.space.slug ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(key, {
        name: item.space.name,
        slug: item.space.slug,
        items: [item],
      })
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function DecisionForms({ item }: { item: PendingCommunityModerationItem }) {
  return (
    <div className='mt-6 grid gap-4 border-t border-[#153f2e]/10 pt-5 lg:grid-cols-2'>
      <form action={submitModerationDecision}>
        <input name='kind' type='hidden' value={item.kind} />
        <input name='id' type='hidden' value={item.id} />
        <input name='decision' type='hidden' value='approve' />
        <button
          className='w-full rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f3023]'
          type='submit'
        >
          Approve
        </button>
      </form>

      <form action={submitModerationDecision} className='space-y-3'>
        <input name='kind' type='hidden' value={item.kind} />
        <input name='id' type='hidden' value={item.id} />
        <input name='decision' type='hidden' value='reject' />
        <label className='block'>
          <span className='text-xs font-bold uppercase tracking-[0.12em] text-[#8a7450]'>
            Rejection reason
          </span>
          <textarea
            className='mt-2 min-h-24 w-full rounded-[14px] border border-[#153f2e]/15 px-4 py-3 text-sm text-[#24372f] outline-none transition focus:border-[#8a7450]'
            maxLength={500}
            name='reason'
            required
          />
        </label>
        <button
          className='w-full rounded-full border border-[#9c5c4f]/30 bg-[#f8ece8] px-5 py-3 text-sm font-bold text-[#78463d] transition hover:border-[#9c5c4f]/60'
          type='submit'
        >
          Reject
        </button>
      </form>
    </div>
  )
}

function ModerationItemCard({ item }: { item: PendingCommunityModerationItem }) {
  if (item.kind === 'post') {
    return (
      <article className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_14px_35px_rgba(31,52,43,0.07)]'>
        <div className='flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8a7450]'>
          <span>Post</span>
          <span>{item.postType}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <h3 className='mt-3 text-xl font-bold text-[#153f2e]'>{item.title}</h3>
        <p className='mt-2 text-sm text-[#68766f]'>Submitted by {item.authorName}</p>
        <div className='mt-5 rounded-[16px] bg-[#f7f4ec] px-5 py-3'>
          <CommunityRichText value={item.preview} />
        </div>
        <DecisionForms item={item} />
      </article>
    )
  }

  if (item.kind === 'comment') {
    return (
      <article className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_14px_35px_rgba(31,52,43,0.07)]'>
        <div className='flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8a7450]'>
          <span>Comment</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <h3 className='mt-3 text-xl font-bold text-[#153f2e]'>Reply to {item.postTitle}</h3>
        <p className='mt-2 text-sm text-[#68766f]'>Submitted by {item.authorName}</p>
        <div className='mt-5 rounded-[16px] bg-[#f7f4ec] px-5 py-3'>
          <CommunityRichText value={item.preview} />
        </div>
        <DecisionForms item={item} />
      </article>
    )
  }

  return (
    <article className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_14px_35px_rgba(31,52,43,0.07)]'>
      <div className='flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8a7450]'>
        <span>File</span>
        <span>{item.mimeType}</span>
        <span>{formatByteSize(item.byteSize)}</span>
        <span>{formatDate(item.createdAt)}</span>
      </div>
      <h3 className='mt-3 text-xl font-bold text-[#153f2e]'>{item.title}</h3>
      <p className='mt-2 text-sm text-[#68766f]'>
        {item.filename} · Submitted by {item.uploaderName}
      </p>
      <Link
        className='mt-5 inline-flex rounded-full border border-[#153f2e]/20 px-5 py-2.5 text-sm font-bold text-[#153f2e] hover:border-[#8a7450]'
        href={`${item.downloadUrl}?moderation=preview`}
      >
        Review protected file
      </Link>
      <DecisionForms item={item} />
    </article>
  )
}

export default async function CommunityModerationPage({ searchParams }: PageProps) {
  const query = await searchParams
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    redirect('/learn/login?next=/learn/community/moderation')
  }

  const inbox = await getPendingCommunityModerationItems(payload, {
    type: 'member',
    id: member.id,
  })
  if (!inbox.actorRole) {
    notFound()
  }

  const groups = groupItems(inbox.items)
  const email = typeof member.email === 'string' ? member.email : null

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14'>
        <Link className='text-sm font-bold text-[#6c5a36] hover:text-[#153f2e]' href='/learn/community'>
          Back to community
        </Link>

        <section className='mt-6 rounded-[28px] bg-[#153f2e] p-8 text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)] sm:p-10 lg:p-14'>
          <StatusPill tone='neutral'>Moderation inbox</StatusPill>
          <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
            Review pending community submissions.
          </h1>
          <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
            Only submissions from spaces assigned to your moderator account appear here.
          </p>
        </section>

        {query.decision === 'success' && (
          <div className='mt-6 rounded-[18px] border border-[#2f7355]/20 bg-[#eaf4ee] px-5 py-4 text-sm font-semibold text-[#24543f]'>
            The moderation decision was recorded.
          </div>
        )}
        {query.decision === 'error' && (
          <div className='mt-6 rounded-[18px] border border-[#9c5c4f]/20 bg-[#f8ece8] px-5 py-4 text-sm font-semibold text-[#78463d]'>
            The moderation decision could not be completed.
          </div>
        )}

        {groups.length > 0 ? (
          <div className='mt-12 space-y-12'>
            {groups.map((group) => (
              <section key={`${group.name}:${group.slug ?? ''}`}>
                <div className='flex flex-wrap items-end justify-between gap-4'>
                  <div>
                    <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
                      Community space
                    </p>
                    <h2 className='mt-2 text-3xl font-bold text-[#153f2e]'>{group.name}</h2>
                  </div>
                  <StatusPill tone='neutral'>{group.items.length} pending</StatusPill>
                </div>
                <div className='mt-7 grid gap-6 lg:grid-cols-2'>
                  {group.items.map((item) => (
                    <ModerationItemCard item={item} key={`${item.kind}:${item.id}`} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className='mt-12 rounded-[24px] border border-dashed border-[#153f2e]/20 bg-[#f4f1e9] p-8 text-[#64736c]'>
            No pending submissions currently require review.
          </section>
        )}
      </main>
    </PortalShell>
  )
}
