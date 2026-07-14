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
    <article className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_12px_30px_rgba(31,52,43,0.06)]'>
      <p className='text-xs font-bold uppercase tracking-[0.14em] text-[#8a7450]'>{attachment.spaceName}</p>
      <h3 className='mt-2 text-lg font-bold text-[#153f2e]'>{attachment.title}</h3>
      {'filename' in attachment && attachment.filename ? (
        <p className='mt-2 text-sm text-[#68766f]'>{attachment.filename}</p>
      ) : null}
      {'mimeType' in attachment && 'byteSize' in attachment ? (
        <p className='mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8a7450]'>
          {attachment.mimeType} · {attachment.byteSize} bytes
        </p>
      ) : null}
      <a
        className='mt-4 inline-flex rounded-full bg-[#153f2e] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f3023]'
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
  const submitComment = submitCommunityComment.bind(null, spaceSlug, postId)

  return (
    <div className='mx-auto max-w-4xl space-y-10'>
      <Link
        className='text-sm font-bold text-[#6c5a36] hover:text-[#153f2e]'
        href={`/portal/community/${encodeURIComponent(post.space.slug)}`}
      >
        Back to {post.space.name}
      </Link>

      <article className='overflow-hidden rounded-[28px] border border-[#153f2e]/10 bg-white shadow-[0_24px_70px_rgba(31,52,43,0.1)]'>
        <header className='bg-[#153f2e] p-8 text-white sm:p-10'>
          <div className='flex flex-wrap gap-3'>
            <StatusPill tone='neutral'>{post.postType}</StatusPill>
            {post.pinned && <StatusPill tone='neutral'>Pinned</StatusPill>}
            {post.locked && <StatusPill tone='warn'>Comments locked</StatusPill>}
          </div>
          <h1 className='mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>{post.title}</h1>
          <p className='mt-4 text-sm text-[#d5e0da]'>
            Posted by {post.authorName} · {formatDate(post.createdAt)}
          </p>
          <p className='mt-2 text-xs text-[#d5e0da]'>{memberEmail}</p>
        </header>

        <div className='p-8 sm:p-10'>
          <CommunityRichText value={post.body} />
        </div>
      </article>

      {post.attachments.length > 0 && (
        <section>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Attachments</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>Visible attachments</h2>
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
        <div className='rounded-[18px] border border-[#2f7355]/20 bg-[#eaf4ee] px-5 py-4 text-sm font-semibold text-[#24543f]'>
          Your reply was submitted for review. It will appear after approval.
        </div>
      )}
      {query.submission === 'error' && (
        <div className='rounded-[18px] border border-[#9c5c4f]/20 bg-[#f8ece8] px-5 py-4 text-sm font-semibold text-[#78463d]'>
          The reply could not be submitted. Review the form and try again later.
        </div>
      )}

      {post.canComment && (
        <section className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_14px_35px_rgba(31,52,43,0.07)] sm:p-8'>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Moderated reply</p>
          <h2 className='mt-2 text-2xl font-bold text-[#153f2e]'>Add a comment</h2>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-[#68766f]'>
            Replies enter review before becoming visible to other members.
          </p>
          <form action={submitComment} className='mt-6 space-y-5'>
            <label className='block'>
              <span className='text-sm font-bold text-[#153f2e]'>Reply</span>
              <textarea
                className='mt-2 min-h-36 w-full rounded-[14px] border border-[#153f2e]/15 px-4 py-3 text-[#24372f] outline-none transition focus:border-[#8a7450]'
                maxLength={10000}
                name='body'
                required
              />
            </label>
            <button
              className='rounded-full bg-[#153f2e] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0f3023]'
              type='submit'
            >
              Submit reply for review
            </button>
          </form>
        </section>
      )}

      <section>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Discussion</p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>Visible comments</h2>
          </div>
          <StatusPill tone={post.canComment ? 'good' : 'neutral'}>
            {post.canComment ? 'Moderator replies enabled' : 'Read only'}
          </StatusPill>
        </div>

        <div className='mt-7 space-y-5'>
          {post.comments.length > 0 ? (
            post.comments.map((comment) => (
              <article
                className='rounded-[22px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_12px_30px_rgba(31,52,43,0.06)]'
                key={comment.id}
              >
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <h3 className='font-bold text-[#153f2e]'>{comment.authorName}</h3>
                  <time className='text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7450]'>
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <div className='mt-4'>
                  <CommunityRichText value={comment.body} />
                </div>
              </article>
            ))
          ) : (
            <div className='rounded-[22px] border border-dashed border-[#153f2e]/20 bg-[#f4f1e9] p-6 text-sm leading-6 text-[#64736c]'>
              No visible comments have been published for this discussion.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
