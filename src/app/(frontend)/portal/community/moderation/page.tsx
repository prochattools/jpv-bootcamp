import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import { CommunityRichText } from '@/components/community/CommunityRichText'
import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  getPendingCommunityModerationItems,
  moderatePendingCommunityItem,
  type PendingCommunityModerationItem,
} from '@/lib/payloadCourse/communityModeration'

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

function isModerationKind(value: string): value is PendingCommunityModerationItem['kind'] {
  return value === 'post' || value === 'comment' || value === 'file'
}

function isModerationDecision(value: string): value is 'approve' | 'reject' {
  return value === 'approve' || value === 'reject'
}

async function submitModerationDecision(formData: FormData): Promise<void> {
  'use server'

  const destination = '/portal/community/moderation'
  const { memberId, payload } = await requirePortalMember(destination)

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

  const result = await moderatePendingCommunityItem(payload as unknown as PayloadCourseWriteAPI, {
    actor: { type: 'member', id: memberId },
    kind,
    id,
    decision,
    reason: reason || null,
  })

  if (!result.allowed) {
    redirect(`${destination}?decision=error`)
  }

  revalidatePath(destination)
  revalidatePath('/portal/community')
  redirect(`${destination}?decision=success`)
}

function formatDate(value: string | null): string {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  return new Intl.DateTimeFormat('en-US', {
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
  const groups = new Map<string, { name: string; slug: string | null; items: PendingCommunityModerationItem[] }>()

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
    <div className='mt-6 grid gap-4 border-t border-jpv-border pt-5 lg:grid-cols-2'>
      <form action={submitModerationDecision}>
        <input name='kind' type='hidden' value={item.kind} />
        <input name='id' type='hidden' value={item.id} />
        <input name='decision' type='hidden' value='approve' />
        <button
          className='jpv-button-primary min-h-11 w-full justify-center'
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
          <span className='text-xs font-bold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
            Rejection reason
          </span>
          <textarea
            className='mt-2 min-h-24 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-brand-deep focus:ring-2 focus:ring-jpv-brand/25'
            maxLength={500}
            name='reason'
            required
          />
        </label>
        <button
          className='min-h-11 w-full rounded-jpv-action border border-jpv-danger bg-jpv-danger-surface px-5 py-3 text-sm font-bold text-jpv-danger-ink transition hover:opacity-90'
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
      <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'>
        <div className='flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
          <span>Post</span>
          <span>{item.postType}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <h3 className='mt-3 text-xl font-bold text-jpv-brand-deep'>{item.title}</h3>
        <p className='mt-2 text-sm text-jpv-muted'>Submitted by {item.authorName}</p>
        <div className='mt-5 rounded-jpv-card bg-jpv-surface px-5 py-3'>
          <CommunityRichText value={item.preview} />
        </div>
        <DecisionForms item={item} />
      </article>
    )
  }

  if (item.kind === 'comment') {
    return (
      <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'>
        <div className='flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
          <span>Comment</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <h3 className='mt-3 text-xl font-bold text-jpv-brand-deep'>Reply to {item.postTitle}</h3>
        <p className='mt-2 text-sm text-jpv-muted'>Submitted by {item.authorName}</p>
        <div className='mt-5 rounded-jpv-card bg-jpv-surface px-5 py-3'>
          <CommunityRichText value={item.preview} />
        </div>
        <DecisionForms item={item} />
      </article>
    )
  }

  return (
    <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'>
      <div className='flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
        <span>File</span>
        <span>{item.mimeType}</span>
        <span>{formatByteSize(item.byteSize)}</span>
        <span>{formatDate(item.createdAt)}</span>
      </div>
      <h3 className='mt-3 text-xl font-bold text-jpv-brand-deep'>{item.title}</h3>
      <p className='mt-2 text-sm text-jpv-muted'>
        {item.filename} · Submitted by {item.uploaderName}
      </p>
      <Link
        className='jpv-button-secondary mt-5 min-h-11'
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
  const { memberId, memberEmail, payload } = await requirePortalMember('/portal/community/moderation')

  const inbox = await getPendingCommunityModerationItems(payload, {
    type: 'member',
    id: memberId,
  })
  if (!inbox.actorRole) notFound()

  const groups = groupItems(inbox.items)

  return (
    <div className='mx-auto max-w-6xl space-y-10'>
      <Link className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep' href='/portal/community'>
        Back to community
      </Link>

      <section className='rounded-jpv-panel bg-jpv-brand-deep p-8 text-jpv-canvas shadow-jpv-card sm:p-10 lg:p-14'>
        <StatusPill tone='neutral'>Moderation inbox</StatusPill>
        <h1 className='mt-7 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
          Review pending community submissions.
        </h1>
        <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
          This view is available only to approved community moderators and space administrators.
        </p>
        <p className='mt-4 text-sm text-jpv-inverse-muted'>{memberEmail}</p>
      </section>

      {query.decision === 'success' ? (
        <div className='jpv-notice'>
          Moderation decision recorded.
        </div>
      ) : null}
      {query.decision === 'error' ? (
        <div className='jpv-notice jpv-notice-danger'>
          The moderation decision could not be recorded.
        </div>
      ) : null}

      {groups.length > 0 ? (
        groups.map((group) => (
          <section key={group.name} className='space-y-5'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight text-jpv-brand-deep'>{group.name}</h2>
              {group.slug ? (
                <Link className='mt-2 inline-flex text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep' href={`/portal/community/${group.slug}`}>
                  Open space
                </Link>
              ) : null}
            </div>
            <div className='grid gap-5 lg:grid-cols-2'>
              {group.items.map((item) => (
                <ModerationItemCard item={item} key={`${item.kind}:${item.id}`} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-surface p-8 text-jpv-muted'>
          No pending community moderation items are waiting for review.
        </section>
      )}
    </div>
  )
}
