import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CommunityRichText } from '@/components/community/CommunityRichText'
import { StatusPill } from '@/components/portal/StatusPill'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCommunityPostDetail } from '@/lib/payloadCourse/communityDiscussion'
import type { MemberCommunityAttachmentResolution } from '@/lib/payloadCourse/communityFiles'
import { submitCommunityComment } from '../../../actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    spaceSlug: string
    postId: string
  }>
  searchParams: Promise<{
    submission?: string
    reason?: string
  }>
}

function formatDate(value: string | null) {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function AttachmentCard({ attachment }: { attachment: MemberCommunityAttachmentResolution }) {
  if (!('downloadUrl' in attachment) || !attachment.downloadUrl) return null

  return (
    <article className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'>
      <p className='text-xs font-bold uppercase tracking-[0.14em] text-jpv-sunshine-ink'>{attachment.spaceName}</p>
      <h3 className='mt-2 text-lg font-bold text-jpv-brand-deep'>{attachment.title}</h3>
      {'filename' in attachment && attachment.filename ? (
        <p className='mt-2 text-sm text-jpv-muted'>{attachment.filename}</p>
      ) : null}
      {'mimeType' in attachment && 'byteSize' in attachment ? (
        <p className='mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-jpv-sunshine-ink'>
          {attachment.mimeType} · {attachment.byteSize} bytes
        </p>
      ) : null}
      <a
        className='jpv-button-secondary mt-4 min-h-11'
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
        className='text-sm font-bold text-jpv-sunshine-ink hover:text-jpv-brand-deep'
        href={`/portal/community/${encodeURIComponent(post.space.slug)}`}
      >
        Back to {post.space.name}
      </Link>

      <article className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-canvas shadow-jpv-card'>
        <header className='bg-jpv-brand-deep p-8 text-jpv-canvas sm:p-10'>
          <div className='flex flex-wrap gap-3'>
            <StatusPill tone='neutral'>{post.postType}</StatusPill>
            {post.pinned && <StatusPill tone='neutral'>Pinned</StatusPill>}
            {post.locked && <StatusPill tone='warn'>Comments locked</StatusPill>}
          </div>
          <h1 className='mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>{post.title}</h1>
          <p className='mt-4 text-sm text-jpv-inverse-muted'>
            Posted by {post.authorName} · {formatDate(post.createdAt)}
          </p>
          <p className='mt-2 text-xs text-jpv-inverse-muted'>{memberEmail}</p>
        </header>

        <div className='p-8 sm:p-10'>
          <CommunityRichText value={post.body} />
        </div>
      </article>

      {post.attachments.length > 0 && (
        <section>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Attachments</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep'>Visible attachments</h2>
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
        <div className='jpv-notice'>
          Your reply has been published.
        </div>
      )}
      {query.submission === 'error' && (
        <div className='jpv-notice jpv-notice-danger'>
          {query.reason === 'rate_limit'
            ? 'You are replying too quickly. Please wait a moment before trying again.'
            : query.reason === 'not_allowed'
              ? 'You do not have permission to reply in this discussion. Check your membership status.'
              : query.reason === 'validation'
                ? 'Your reply could not be saved. Please check that the body is filled in correctly.'
                : 'An unexpected error occurred while submitting your reply. Please try again or contact support if this persists.'}
        </div>
      )}

      <section>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Discussion</p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep'>Comments</h2>
          </div>
        </div>

        <div className='mt-7 space-y-5'>
          {post.comments.length > 0 ? (
            post.comments.map((comment) => (
              <article
                className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card'
                key={comment.id}
              >
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <h3 className='font-bold text-jpv-brand-deep'>{comment.authorName}</h3>
                  <time className='text-xs font-semibold uppercase tracking-[0.1em] text-jpv-sunshine-ink'>
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <div className='mt-4'>
                  <CommunityRichText value={comment.body} />
                </div>
              </article>
            ))
          ) : (
            <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-surface p-6 text-sm leading-6 text-jpv-muted'>
              No visible comments have been published for this discussion.
            </div>
          )}
        </div>
      </section>

      {post.canComment && (
        <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-7 shadow-jpv-card sm:p-8'>
          <h2 className='text-2xl font-bold text-jpv-brand-deep'>Leave a reply</h2>
          <form
            action={submitCommunityComment.bind(null, spaceSlug, postId)}
            className='mt-5 space-y-4'
          >
            <div>
              <label className='block text-sm font-bold text-jpv-brand-deep' htmlFor='comment-body'>
                Your reply
              </label>
              <textarea
                className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
                id='comment-body'
                maxLength={10000}
                name='body'
                placeholder='Share your reply…'
                required
                rows={4}
              />
            </div>
            <div>
              <label className='block text-sm font-bold text-jpv-brand-deep' htmlFor='comment-video'>
                Video link <span className='font-normal text-jpv-muted'>(optional)</span>
              </label>
              <input
                className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
                id='comment-video'
                name='videoUrl'
                placeholder='YouTube, Vimeo, or Bunny Stream URL'
                type='url'
              />
            </div>
            <button
              className='jpv-button-primary min-h-11'
              type='submit'
            >
              Submit reply
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
