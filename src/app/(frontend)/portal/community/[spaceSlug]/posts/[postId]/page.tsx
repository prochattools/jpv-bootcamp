import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CommunityRichText } from '@/components/community/CommunityRichText'
import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import type { MemberCommunityAttachmentResolution } from '@/lib/payloadCourse/communityFiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    spaceSlug: string
    postId: string
  }>
  searchParams: Promise<{
    submission?: string
  }>
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

function AttachmentCard({ attachment }: { attachment: MemberCommunityAttachmentResolution }) {
  if (!('downloadUrl' in attachment) || !attachment.downloadUrl) return null

  return (
    <article className='rounded-jpv-card border border-[var(--jpv-brand-deep)]/10 bg-white p-6 shadow-jpv-card'>
      <p className='text-xs font-bold uppercase tracking-[0.14em] text-[var(--jpv-sunshine-ink)]'>{attachment.spaceName}</p>
      <h3 className='mt-2 text-lg font-bold text-[var(--jpv-brand-deep)]'>{attachment.title}</h3>
      {'filename' in attachment && attachment.filename ? (
        <p className='mt-2 text-sm text-[var(--jpv-muted)]'>{attachment.filename}</p>
      ) : null}
      {'mimeType' in attachment && 'byteSize' in attachment ? (
        <p className='mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--jpv-sunshine-ink)]'>
          {attachment.mimeType} · {attachment.byteSize} bytes
        </p>
      ) : null}
      <a
        className='mt-4 inline-flex rounded-full bg-[var(--jpv-brand-deep)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--jpv-brand-hover)]'
        href={attachment.downloadUrl}
      >
        Download
      </a>
    </article>
  )
}

export default async function PortalCommunityPostPage({ params, searchParams }: PageProps) {
  const [{ spaceSlug, postId }, query] = await Promise.all([params, searchParams])
  const { memberId, memberEmail, payload } = await requirePortalMember(
    `/portal/community/${encodeURIComponent(spaceSlug)}/posts/${encodeURIComponent(postId)}`,
  )

  const result = await getMemberCommunityPostDetail(payload, memberId, spaceSlug, postId)
  if (!result.allowed) notFound()

  const post = result.post

  return (
    <div className='mx-auto max-w-4xl space-y-10'>
      <Link
        className='text-sm font-bold text-[var(--jpv-sunshine-ink)] hover:text-[var(--jpv-brand-deep)]'
        href={`/portal/community/${encodeURIComponent(post.space.slug)}`}
      >
        Back to {post.space.name}
      </Link>

      <article className='overflow-hidden rounded-jpv-panel border border-[var(--jpv-brand-deep)]/10 bg-white shadow-jpv-card'>
        <header className='bg-[var(--jpv-brand-deep)] p-8 text-white sm:p-10'>
          <div className='flex flex-wrap gap-3'>
            <StatusPill tone='neutral'>{post.postType}</StatusPill>
            {post.pinned && <StatusPill tone='neutral'>Pinned</StatusPill>}
            {post.locked && <StatusPill tone='warn'>Comments locked</StatusPill>}
          </div>
          <h1 className='mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>{post.title}</h1>
          <p className='mt-4 text-sm text-[var(--jpv-inverse-muted)]'>
            Posted by {post.authorName} · {formatDate(post.createdAt)}
          </p>
          <p className='mt-2 text-xs text-[var(--jpv-inverse-muted)]'>{memberEmail}</p>
        </header>

        <div className='p-8 sm:p-10'>
          <CommunityRichText value={post.body} />
        </div>
      </article>

      {post.attachments.length > 0 && (
        <section>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[var(--jpv-sunshine-ink)]'>Attachments</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-[var(--jpv-brand-deep)]'>Visible attachments</h2>
            </div>
          </div>

          <div className='mt-6 grid gap-4 md:grid-cols-2'>
            {post.attachments.map((attachment, index) => (
              <AttachmentCard
                attachment={attachment}
                key={`${attachment.attachmentType}:${attachment.id}:${index}`}
              />
            ))}
          </div>
        </section>
      )}

      {query.submission === 'pending' && (
        <div className='rounded-jpv-card border border-[var(--jpv-brand)]/20 bg-[var(--jpv-surface-strong)] px-5 py-4 text-sm font-semibold text-[var(--jpv-brand-deep)]'>
          Community replies are not enabled in this launch preview.
        </div>
      )}
      {query.submission === 'error' && (
        <div className='rounded-jpv-card border border-[var(--jpv-danger)]/20 bg-[var(--jpv-danger-surface)] px-5 py-4 text-sm font-semibold text-[var(--jpv-danger-ink)]'>
          Community replies are not enabled in this launch preview.
        </div>
      )}

      <section className='rounded-jpv-panel border border-[var(--jpv-brand-deep)]/10 bg-white p-7 shadow-jpv-card sm:p-8'>
        <p className='text-xs font-bold uppercase tracking-[0.2em] text-[var(--jpv-sunshine-ink)]'>Launch preview</p>
        <h2 className='mt-2 text-2xl font-bold text-[var(--jpv-brand-deep)]'>Read-only discussion view</h2>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-[var(--jpv-muted)]'>
          Visible discussions and published comments appear here from persisted Payload data. Member replies,
          uploads, and moderation actions remain deferred outside this launch preview.
        </p>
      </section>

      <section>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[var(--jpv-sunshine-ink)]'>Discussion</p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight text-[var(--jpv-brand-deep)]'>Visible comments</h2>
          </div>
          <StatusPill tone='neutral'>Read only</StatusPill>
        </div>

        <div className='mt-7 space-y-5'>
          {post.comments.length > 0 ? (
            post.comments.map((comment) => (
              <article
                className='rounded-jpv-card border border-[var(--jpv-brand-deep)]/10 bg-white p-6 shadow-jpv-card'
                key={comment.id}
              >
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <h3 className='font-bold text-[var(--jpv-brand-deep)]'>{comment.authorName}</h3>
                  <time className='text-xs font-semibold uppercase tracking-[0.1em] text-[var(--jpv-sunshine-ink)]'>
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <div className='mt-4'>
                  <CommunityRichText value={comment.body} />
                </div>
              </article>
            ))
          ) : (
            <div className='rounded-jpv-card border border-dashed border-[var(--jpv-brand-deep)]/20 bg-[var(--jpv-surface)] p-6 text-sm leading-6 text-[var(--jpv-muted)]'>
              No visible comments have been published for this discussion.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
