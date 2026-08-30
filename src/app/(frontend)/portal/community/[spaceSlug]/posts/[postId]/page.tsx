import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CommunityRichText } from '@/components/community/CommunityRichText'
import {
  EngagementAuthorIdentity,
  EngagementCommentActionBar,
  EngagementReactionBar,
  reactionErrorMessage,
} from '@/components/community/EngagementPresentation'
import { PostOwnerActions, CommentOwnerActions } from '@/components/community/PostOwnerActions'
import { CommunityCommentComposer } from '@/components/community/CommunityCommentComposer'
import { ShareBookmarkActions } from '@/components/community/ShareBookmarkActions'
import { submitReactionAction } from '@/app/(frontend)/portal/reaction-actions'
import { ProgressiveCommentList } from '@/components/community/ProgressiveCommentList'
import { StatusPill } from '@/components/portal/StatusPill'
import { AdminGate } from '@/components/portal/AdminGate'
import { PostModerationPanel } from '@/components/portal/admin/PostModerationPanel'
import { CommentModerationActions } from '@/components/portal/admin/CommentModerationActions'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import {
  getMemberCommunityPostDetail,
  projectCommunityRichText,
  type MemberCommunityPostDetail,
} from '@/lib/payloadCourse/communityDiscussion'
import {
  getReactionSummary,
  getSpaceCommentReactionSummaries,
  type ReactionSummary,
} from '@/lib/payloadCourse/reactions'
import { getMemberBookmarkState } from '@/lib/payloadCourse/bookmarks'
import { resolveMemberCommunityAttachment, type MemberCommunityAttachmentResolution } from '@/lib/payloadCourse/communityFiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    spaceSlug: string
    postId: string
  }>
  searchParams: Promise<{
    reaction?: string
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

function formatRelative(value: string | null): string {
  if (!value) return 'Date pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date pending'
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  return formatDate(value)
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'JP'
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
  const requestedPath = `/portal/community/${encodeURIComponent(spaceSlug)}/posts/${encodeURIComponent(postId)}`
  const { actor, payload } = await requirePortalAccess(requestedPath)
  const isAdmin = actor.kind === 'admin'
  const memberId = actor.kind === 'member' ? actor.memberId : ''
  const memberEmail = actor.kind === 'member' ? actor.email : ''

  const memberResult = await getMemberCommunityPostDetail(payload, memberId, spaceSlug, postId)

  let post: MemberCommunityPostDetail
  let postIsHidden = false
  let commentHiddenMap: Map<string, boolean> = new Map()

  if (memberResult.allowed) {
    post = memberResult.post
  } else if (isAdmin) {
    const [postDoc, spaceResult, commentsResult] = await Promise.all([
      payload.findByID({
        collection: 'payload_space_posts',
        id: postId,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'payload_spaces',
        where: { slug: { equals: spaceSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'payload_space_comments',
        where: { post: { equals: postId } },
        sort: 'createdAt',
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    if (!postDoc) notFound()
    const spaceDoc = spaceResult.docs[0]
    if (!spaceDoc) notFound()

    // Verify the post belongs to the space in this route
    const postSpaceId = typeof postDoc.space === 'object' && postDoc.space !== null
      ? String((postDoc.space as Record<string, unknown>).id)
      : String(postDoc.space)
    if (postSpaceId !== String(spaceDoc.id)) notFound()

    const resolveDocId = (val: unknown): string | null => {
      if (typeof val === 'string') return val
      if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id)
      return null
    }
    const resolveName = (member: Record<string, unknown> | null): string => {
      if (!member) return 'Community member'
      const display = member.displayName ?? member.fullName ?? member.name
      if (typeof display === 'string' && display.trim()) return display.trim().slice(0, 120)
      const first = typeof member.firstName === 'string' ? member.firstName : ''
      const last = typeof member.lastName === 'string' ? member.lastName : ''
      const combined = [first, last].filter(Boolean).join(' ').trim()
      return combined || 'Community member'
    }

    const postAuthorId = resolveDocId(postDoc.author)
    const commentAuthorIds = new Set<string>()
    for (const c of commentsResult.docs) {
      const aid = resolveDocId(c.author)
      if (aid) commentAuthorIds.add(aid)
    }
    if (postAuthorId) commentAuthorIds.add(postAuthorId)

    const authorMap = new Map<string, Record<string, unknown>>()
    if (commentAuthorIds.size > 0) {
      const batch = await payload.find({
        collection: 'payload_members',
        where: { id: { in: Array.from(commentAuthorIds) } },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })
      for (const m of batch.docs) authorMap.set(String(m.id), m as Record<string, unknown>)
    }

    const postAuthorMember = postAuthorId ? (authorMap.get(postAuthorId) ?? null) : null
    const bodyRichText = projectCommunityRichText(postDoc.body)
    const extractText = (node: unknown): string => {
      if (!node || typeof node !== 'object') return ''
      const n = node as Record<string, unknown>
      if (n.type === 'text' && typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extractText).join('')
      if (n.root && typeof n.root === 'object') return extractText(n.root)
      return ''
    }

    const attachmentFiles = await payload.find({
      collection: 'payload_space_files',
      where: { and: [{ post: { equals: postId } }, { moderationStatus: { equals: 'visible' } }] },
      sort: 'sortOrder',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    }).catch(() => ({ docs: [] as Array<Record<string, unknown>> }))

    const resolvedAttachments = await Promise.all(
      attachmentFiles.docs.map((file) => resolveMemberCommunityAttachment(payload, actor.memberId ?? '', file.id, { allowAdministrator: true })),
    )
    const attachments = resolvedAttachments.filter(
      (attachment): attachment is MemberCommunityAttachmentResolution => attachment.allowed,
    )

    post = {
      id: String(postDoc.id),
      title: String(postDoc.title ?? ''),
      postType: (postDoc.postType === 'question' || postDoc.postType === 'announcement')
        ? postDoc.postType
        : 'discussion',
      pinned: Boolean(postDoc.pinned),
      locked: Boolean(postDoc.locked),
      isViewerAuthor: false,
      authorName: resolveName(postAuthorMember),
      createdAt: postDoc.createdAt ? String(postDoc.createdAt) : null,
      space: {
        id: String(spaceDoc.id),
        name: String(spaceDoc.name ?? spaceSlug),
        slug: String(spaceDoc.slug ?? spaceSlug),
      },
      body: bodyRichText,
      bodyPlainText: extractText(bodyRichText),
      comments: commentsResult.docs.map((c) => {
        const cAuthorId = resolveDocId(c.author)
        const cBody = projectCommunityRichText(c.body)
        return {
          id: String(c.id),
          isViewerAuthor: false,
          authorName: resolveName(cAuthorId ? (authorMap.get(cAuthorId) ?? null) : null),
          body: cBody,
          bodyPlainText: extractText(cBody),
          createdAt: c.createdAt ? String(c.createdAt) : null,
        }
      }),
      attachments,
      canPublish: true,
      canComment: false,
    }

    // Track post and per-comment hidden state for admin moderation controls
    postIsHidden = postDoc.moderationStatus === 'hidden'
    commentHiddenMap = new Map(
      commentsResult.docs.map((c) => [String(c.id), c.moderationStatus === 'hidden'])
    )
  } else {
    notFound()
  }

  let reactionSummary: ReactionSummary | null = null
  try {
    reactionSummary = await getReactionSummary(payload, memberId, {
      kind: 'space_post',
      id: post.id,
    })
  } catch {
    // Keep the post readable while the separately authorized reaction schema
    // or projection is unavailable. Mutations remain fail-closed server-side.
  }
  const bookmarked = await getMemberBookmarkState(payload, memberId, post.id).catch(() => false)
  let commentReactionSummaries: ReadonlyMap<string, ReactionSummary> = new Map()
  try {
    commentReactionSummaries = await getSpaceCommentReactionSummaries(
      payload,
      memberId,
      post.id,
      post.comments.map((comment) => comment.id),
    )
  } catch {
    // Comment reaction projection is optional until the staging migration and
    // validation gate have completed.
  }

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6'>

      {/* 1. Breadcrumb */}
      <nav aria-label='Discussion path' className='flex min-h-11 flex-wrap items-center gap-1.5 text-xs text-jpv-muted'>
        <Link
          className='font-semibold text-jpv-sunshine-ink underline-offset-4 hover:text-jpv-brand-deep hover:underline'
          href='/portal/community'
        >
          Community
        </Link>
        <span aria-hidden='true'>/</span>
        <Link
          className='underline-offset-4 hover:text-jpv-brand-deep hover:underline'
          href={`/portal/community/${encodeURIComponent(post.space.slug)}`}
        >
          {post.space.name}
        </Link>
        <span aria-hidden='true'>/</span>
        <span className='max-w-[12rem] truncate sm:max-w-xs'>{post.title}</span>
      </nav>

      {/* 2–6. Post card */}
      <article
        aria-labelledby='community-post-heading'
        className='overflow-hidden rounded-xl border border-jpv-border bg-jpv-canvas shadow-jpv-card'
      >
        {/* 2. Post header: type badge + author + timestamp */}
        <header className='border-b border-jpv-border bg-jpv-surface px-6 py-5 sm:px-8'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='flex flex-wrap gap-2'>
              <StatusPill tone='neutral'>{post.postType}</StatusPill>
              {post.pinned && <StatusPill tone='neutral'>Pinned</StatusPill>}
              {post.locked && <StatusPill tone='warn'>Comments locked</StatusPill>}
            </div>
            <AdminGate>
              <PostModerationPanel
                currentBody={post.bodyPlainText.trim()}
                currentTitle={post.title}
                hasComments={post.comments.length > 0}
                hidden={postIsHidden}
                locked={post.locked}
                pinned={post.pinned}
                postId={post.id}
                spaceId={post.space.id}
              />
            </AdminGate>
          </div>
          <div className='mt-3 flex items-center gap-3'>
            <span
              aria-hidden='true'
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jpv-brand-deep text-xs font-bold text-jpv-canvas'
            >
              {initials(post.authorName)}
            </span>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-jpv-ink'>{post.authorName}</p>
              <p className='text-xs text-jpv-muted'>{memberEmail}</p>
            </div>
            <div className='ml-auto flex items-center gap-2'>
              {post.isViewerAuthor && (
                <PostOwnerActions
                  postBody={post.bodyPlainText.trim()}
                  postId={post.id}
                  postTitle={post.title}
                  spaceSlug={spaceSlug}
                />
              )}
              <time
                className='shrink-0 text-xs text-jpv-muted'
                dateTime={post.createdAt ?? undefined}
                title={formatDate(post.createdAt)}
              >
                {formatRelative(post.createdAt)}
              </time>
            </div>
          </div>
        </header>

        {/* 3. Post title */}
        <div className='px-6 pt-6 sm:px-8 sm:pt-8'>
          <h1
            className='text-2xl font-bold leading-snug tracking-tight text-jpv-brand-deep sm:text-3xl'
            id='community-post-heading'
          >
            {post.title}
          </h1>
        </div>

        {/* 4. Post body */}
        <div className='px-6 pt-5 sm:px-8'>
          <CommunityRichText value={post.body} />
        </div>

        {/* Reaction bar */}
        <div className='px-6 sm:px-8'>
          <EngagementReactionBar
            action={submitReactionAction}
            className='mt-8'
            counts={reactionSummary?.counts}
            errorMessage={query.reaction === 'error' ? reactionErrorMessage(query.reason) : null}
            label='Post reactions'
            redirectPath={requestedPath}
            targetId={post.id}
            targetKind='space_post'
            totalCount={reactionSummary?.totalCount}
            viewerReaction={reactionSummary?.viewerReaction}
          />
        </div>

        {/* 6. Action row: bookmark + comment count + share */}
        <div className='px-6 py-5 sm:px-8 sm:pb-6'>
          <div className='flex flex-wrap items-center gap-2'>
            <ShareBookmarkActions initialBookmarked={bookmarked} postId={post.id} />
            <span className='inline-flex min-h-11 items-center gap-2 rounded-jpv-pill border border-jpv-border bg-jpv-surface px-4 py-2 text-xs font-semibold text-jpv-muted'>
              <svg aria-hidden='true' className='h-4 w-4' fill='none' viewBox='0 0 24 24'>
                <path d='M5 6.5h14v9H9l-4 3v-12Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.75' />
              </svg>
              {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </div>
      </article>

      {/* 5. Attachments */}
      {post.attachments.length > 0 && (
        <section className='rounded-xl border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Attachments</p>
          <h2 className='mt-1 text-lg font-bold tracking-tight text-jpv-brand-deep'>
            {post.attachments.length} {post.attachments.length === 1 ? 'file' : 'files'}
          </h2>
          <div className='mt-4 grid gap-4 sm:grid-cols-2'>
            {post.attachments.map((attachment, index) => (
              <AttachmentCard
                attachment={attachment}
                key={`${attachment.attachmentType}:${attachment.id}:${index}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Submission feedback notices */}
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

      {/* 7. Discussion section */}
      <section aria-labelledby='community-comments-heading'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Discussion</p>
            <h2 className='mt-1 text-xl font-bold tracking-tight text-jpv-brand-deep' id='community-comments-heading'>
              Comments
            </h2>
          </div>
        </div>
        <EngagementCommentActionBar
          className='mt-3'
          commentCount={post.comments.length}
          replyLabel={post.canComment ? 'Reply in the composer below' : 'Replies are currently unavailable'}
        />

        {/* Divider between post body area and comment list */}
        <hr className='mt-4 border-jpv-border' />

        <div className='mt-5 space-y-4'>
          {post.comments.length > 0 ? (
            <ProgressiveCommentList totalCount={post.comments.length}>
              {post.comments.map((comment) => (
                <article
                  className='rounded-xl border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'
                  key={comment.id}
                >
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <EngagementAuthorIdentity
                      name={comment.authorName}
                      timestampLabel={formatRelative(comment.createdAt)}
                      timestampValue={comment.createdAt ?? undefined}
                    />
                    <div className='flex items-center gap-2'>
                      {comment.isViewerAuthor && (
                        <CommentOwnerActions
                          commentBody={comment.bodyPlainText.trim()}
                          commentId={comment.id}
                          postId={post.id}
                          spaceSlug={spaceSlug}
                        />
                      )}
                      <AdminGate>
                        <CommentModerationActions
                          commentId={comment.id}
                          currentBody={comment.bodyPlainText.trim()}
                          hidden={commentHiddenMap.get(comment.id) ?? false}
                          postId={post.id}
                          spaceId={post.space.id}
                        />
                      </AdminGate>
                      <time className='shrink-0 text-xs text-jpv-muted' dateTime={comment.createdAt ?? undefined}>
                        {formatDate(comment.createdAt)}
                      </time>
                    </div>
                  </div>
                  <div className='mt-4 border-l-2 border-jpv-border pl-4'>
                    <CommunityRichText value={comment.body} />
                  </div>
                  {commentReactionSummaries.get(comment.id) ? (
                    <EngagementReactionBar
                      action={submitReactionAction}
                      className='mt-4'
                      counts={commentReactionSummaries.get(comment.id)?.counts}
                      errorMessage={query.reaction === 'error' ? reactionErrorMessage(query.reason) : null}
                      label='Comment reactions'
                      redirectPath={requestedPath}
                      targetId={comment.id}
                      targetKind='space_comment'
                      totalCount={commentReactionSummaries.get(comment.id)?.totalCount}
                      viewerReaction={commentReactionSummaries.get(comment.id)?.viewerReaction}
                    />
                  ) : null}
                </article>
              ))}
            </ProgressiveCommentList>
          ) : (
            <div className='rounded-xl border border-dashed border-jpv-border bg-jpv-surface p-6 text-sm leading-6 text-jpv-muted'>
              No visible comments have been published for this discussion.
            </div>
          )}
        </div>
      </section>

      {/* 8. Reply form */}
      {post.canComment && (
        <section
          aria-labelledby='community-reply-heading'
          className='rounded-xl border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'
        >
          <h2 className='text-xl font-bold text-jpv-brand-deep' id='community-reply-heading'>Leave a reply</h2>
          <p className='mt-2 text-sm leading-6 text-jpv-muted'>Keep your reply focused on the discussion so it is easy for other learners to follow.</p>
          <CommunityCommentComposer postId={postId} spaceSlug={spaceSlug} />
        </section>
      )}
    </div>
  )
}
