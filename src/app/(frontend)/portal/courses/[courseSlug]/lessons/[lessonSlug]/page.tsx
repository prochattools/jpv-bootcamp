import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { MemberFeaturedImage } from '@/components/portal/MemberContentMedia'
import { submitReactionAction } from '@/app/(frontend)/portal/reaction-actions'
import {
  DiscussionHierarchy,
  EngagementAuthorIdentity,
  EngagementCommentActionBar,
  EngagementFutureActions,
  EngagementReactionBar,
} from '@/components/community/EngagementPresentation'
import { ProgressiveCommentList } from '@/components/community/ProgressiveCommentList'
import { LegacyLessonRichText } from '@/components/portal/LegacyLessonRichText'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { getLessonCommentReactionSummaries, type ReactionSummary } from '@/lib/payloadCourse/reactions'
import {
  createLessonComment,
  listLessonDiscussion,
  plainTextLessonCommentBody,
  type LessonDiscussionComment,
} from '@/lib/payloadCourse/lessonDiscussion'
import {
  getMemberLessonDetail,
  markMemberLessonComplete,
} from '@/lib/payloadCourse/memberPortal'
import { LessonVideoPlayer } from './LessonVideoPlayer'

type LessonPageProps = {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
  searchParams?: Promise<{
    completed?: string | string[] | undefined
    discussion?: string | string[] | undefined
    reason?: string | string[] | undefined
  }>
}

function getLessonPath(courseSlug: string, lessonSlug: string): string {
  return `/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`
}

function formatFileSize(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB'] as const
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

async function completeLesson(formData: FormData) {
  'use server'

  const courseSlug = formData.get('courseSlug')
  const lessonSlug = formData.get('lessonSlug')
  if (typeof courseSlug !== 'string' || typeof lessonSlug !== 'string') return
  if (!courseSlug.trim() || !lessonSlug.trim()) return

  const requestedPath = getLessonPath(courseSlug, lessonSlug)
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)

  if (!detail?.allowed || !detail.lesson?.id || !detail.lesson.title) return

  await markMemberLessonComplete(
    payload as PayloadCourseWriteAPI,
    memberId,
    detail.lesson.id,
    detail.lesson.title,
  )

  revalidatePath('/portal')
  revalidatePath('/portal/courses')
  revalidatePath(`/portal/courses/${courseSlug}`)
  revalidatePath(requestedPath)
  redirect(`${requestedPath}?completed=1`)
}

function lessonDiscussionErrorReason(error: unknown): 'rate_limit' | 'not_allowed' | 'validation' | 'server' {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('rate limit')) return 'rate_limit'
  if (message.includes('unavailable') || message.includes('same lesson') || message.includes('visible comments')) return 'not_allowed'
  if (message.includes('required') || message.includes('rich text') || message.includes('too long')) return 'validation'
  return 'server'
}

async function submitLessonDiscussionComment(formData: FormData) {
  'use server'

  const courseSlug = formData.get('courseSlug')
  const lessonSlug = formData.get('lessonSlug')
  const bodyValue = formData.get('body')
  const parentValue = formData.get('parentId')
  if (typeof courseSlug !== 'string' || typeof lessonSlug !== 'string') return
  if (!courseSlug.trim() || !lessonSlug.trim()) return

  const requestedPath = getLessonPath(courseSlug, lessonSlug)
  const { memberId, payload } = await requirePortalMember(requestedPath)
  let errorReason: ReturnType<typeof lessonDiscussionErrorReason> | null = null

  try {
    const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)
    if (!detail?.allowed || !detail.lesson?.id) throw new Error('Lesson discussion is unavailable for this member.')

    const bodyText = typeof bodyValue === 'string' ? bodyValue.trim() : ''
    if (!bodyText) throw new Error('Body is required.')
    if (bodyText.length > 10_000) throw new Error('Body is too long.')
    const parentId = typeof parentValue === 'string' && parentValue.trim() ? parentValue.trim() : null

    await createLessonComment(payload as PayloadCourseWriteAPI, {
      memberId,
      lessonId: detail.lesson.id,
      parentId,
      body: plainTextLessonCommentBody(bodyText) as unknown as Record<string, unknown>,
    })
  } catch (error) {
    console.error('[submitLessonDiscussionComment] submission error:', error instanceof Error ? error.message : String(error))
    errorReason = lessonDiscussionErrorReason(error)
  }

  revalidatePath(requestedPath)
  if (errorReason) {
    redirect(`${requestedPath}?discussion=error&reason=${errorReason}#lesson-discussion`)
  }
  redirect(`${requestedPath}?discussion=posted#lesson-discussion`)
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDiscussionDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Historical comment'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function LessonCommentThread({
  comments,
  parentId,
  courseSlug,
  lessonSlug,
  reactionSummaries,
  depth = 0,
}: {
  comments: LessonDiscussionComment[]
  parentId: string | null
  courseSlug: string
  lessonSlug: string
  reactionSummaries: ReadonlyMap<string, ReactionSummary>
  depth?: number
}) {
  if (depth > 8) return null
  const children = comments.filter((comment) => comment.parentId === parentId)
  if (children.length === 0) return null

  const commentNodes = children.map((comment) => (
    <article className='rounded-xl border border-jpv-border bg-jpv-surface/60 p-5' key={comment.id}>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <EngagementAuthorIdentity
          name={comment.displayName}
          timestampLabel={formatDiscussionDate(comment.sourceCreatedAt || comment.createdAt)}
          timestampValue={comment.sourceCreatedAt || comment.createdAt}
        />
      </div>
      <LegacyLessonRichText data={comment.body} lessonSlug={lessonSlug} />

      {reactionSummaries.get(comment.id) ? (
        <EngagementReactionBar
          action={submitReactionAction}
          className='mt-4'
          counts={reactionSummaries.get(comment.id)?.counts}
          label='Discussion comment reactions'
          redirectPath={`/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`}
          targetId={comment.id}
          targetKind='lesson_comment'
          totalCount={reactionSummaries.get(comment.id)?.totalCount}
          viewerReaction={reactionSummaries.get(comment.id)?.viewerReaction}
        />
      ) : null}

      <details className='mt-4'>
        <summary className='min-h-10 cursor-pointer py-2 text-sm font-semibold text-jpv-inverse-muted outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'>Reply</summary>
        <form action={submitLessonDiscussionComment} className='mt-3 space-y-3'>
          <input name='courseSlug' type='hidden' value={courseSlug} />
          <input name='lessonSlug' type='hidden' value={lessonSlug} />
          <input name='parentId' type='hidden' value={comment.id} />
          <textarea
            className='min-h-24 w-full rounded-xl border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm outline-none focus:border-jpv-brand'
            maxLength={10_000}
            name='body'
            placeholder={`Reply to ${comment.displayName}`}
            required
          />
          <button className='jpv-button-secondary' type='submit'>Post reply</button>
        </form>
      </details>

      <LessonCommentThread
        comments={comments}
        parentId={comment.id}
        courseSlug={courseSlug}
        lessonSlug={lessonSlug}
        reactionSummaries={reactionSummaries}
        depth={depth + 1}
      />
    </article>
  ))

  if (depth === 0) {
    return <ProgressiveCommentList totalCount={children.length}>{commentNodes}</ProgressiveCommentList>
  }

  return <DiscussionHierarchy depth={depth}>{commentNodes}</DiscussionHierarchy>
}

export default async function PortalLessonPage({ params, searchParams }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params
  const requestedPath = getLessonPath(courseSlug, lessonSlug)
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)
  const query = searchParams ? await searchParams : undefined

  if (!detail) notFound()

  const discussion = detail.allowed && detail.lesson?.id
    ? await listLessonDiscussion(payload as PayloadCourseWriteAPI, memberId, detail.lesson.id)
    : null
  const reactionSummaries = new Map<string, ReactionSummary>()
  if (discussion?.allowed) {
    try {
      const summaries = await getLessonCommentReactionSummaries(
        payload,
        memberId,
        discussion.lessonId,
        discussion.comments.map((comment) => comment.id),
      )
      for (const [id, summary] of summaries) reactionSummaries.set(id, summary)
    } catch {
      // Preserve the readable lesson discussion if the optional reaction
      // projection is unavailable; mutations remain fail-closed in the service.
    }
  }

  return (
    <div className='mx-auto w-full max-w-5xl space-y-8'>
      <nav aria-label='Learning path' className='flex min-h-11 flex-wrap items-center gap-2 text-sm'>
        <Link
          className='font-semibold text-jpv-inverse-muted underline-offset-4 hover:text-jpv-ink hover:underline'
          href={`/portal/courses/${courseSlug}`}
        >
          ← Back to {detail.course.title}
        </Link>
        <span aria-hidden='true' className='text-jpv-muted'>/</span>
        <span className='text-jpv-muted'>{detail.module.title}</span>
      </nav>

      {!detail.allowed || !detail.lesson ? (
        <section className='jpv-notice jpv-notice-danger rounded-2xl p-8'>
          <p className='jpv-eyebrow'>Lesson unavailable</p>
          <h1 className='mt-3 text-2xl font-semibold'>This lesson is currently locked</h1>
          <p className='mt-3 text-sm leading-6'>
            {detail.lockReason ?? 'Your account does not currently have access to this lesson.'}
          </p>
          {detail.previousLesson && !detail.previousLesson.completed ? (
            <p className='jpv-notice mt-4 rounded-xl px-4 py-3 text-sm font-medium'>
              Complete the previous lesson before opening this one.
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section aria-labelledby='lesson-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
            <p className='jpv-eyebrow'>{detail.module.title}</p>
            <div className='mt-3 flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
              <div className='max-w-3xl'>
                <h1 className='text-3xl font-semibold tracking-tight text-jpv-ink' id='lesson-heading'>{detail.lesson.title}</h1>
                {detail.lesson.summary ? (
                  <p className='mt-4 text-sm leading-6 text-jpv-muted'>{detail.lesson.summary}</p>
                ) : null}
              </div>

              <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                {detail.lesson.estimatedDuration ? (
                  <span className='rounded-full bg-jpv-surface-strong px-3 py-1 text-jpv-inverse-muted'>
                    {detail.lesson.estimatedDuration}
                  </span>
                ) : null}
                {detail.lesson.previewLesson ? (
                  <span className='rounded-full bg-jpv-brand/10 px-3 py-1 text-jpv-brand-deep'>Preview</span>
                ) : null}
                {detail.lesson.completed ? (
                  <span className='rounded-full bg-jpv-brand/10 px-3 py-1 text-jpv-brand-deep'>Complete</span>
                ) : null}
              </div>
            </div>
          </section>

          {firstParam(query?.completed) === '1' ? (
            <p className='jpv-notice rounded-jpv-card px-4 py-3 text-sm font-medium' role='status'>
              Lesson marked complete.
            </p>
          ) : null}

          <MemberFeaturedImage asset={detail.lesson.coverImage} />

          <section aria-labelledby='lesson-content-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
            <h2 className='text-xl font-semibold text-jpv-ink' id='lesson-content-heading'>Lesson content</h2>
            {detail.lesson.lockState === 'locked' ? (
              <div className='jpv-notice jpv-notice-danger mt-5 rounded-xl px-4 py-3'>
                <p className='text-sm font-semibold'>Lesson locked</p>
                <p className='mt-1 text-sm'>This lesson is not yet available.</p>
              </div>
            ) : detail.lesson.lockState === 'coming_soon' ? (
              <div className='jpv-notice mt-5 rounded-xl px-4 py-3'>
                <p className='text-sm font-semibold'>Coming soon</p>
                <p className='mt-1 text-sm'>This lesson will be available shortly.</p>
              </div>
            ) : null}
            <LessonVideoPlayer
              lessonSlug={lessonSlug}
              status={detail.lesson.managedVideo?.status}
              thumbnailUrl={detail.lesson.managedVideo?.thumbnailUrl}
              title={detail.lesson.managedVideo?.title ?? 'Lesson video'}
            />
            {detail.lesson.contentLexical ? (
              <LegacyLessonRichText data={detail.lesson.contentLexical} lessonSlug={lessonSlug} />
            ) : null}

            {detail.lesson.resources.length > 0 ? (
              <div className='mt-8 space-y-4'>
                <h3 className='text-lg font-semibold'>Lesson resources</h3>
                <div className='grid gap-4'>
                  {detail.lesson.resources.map((resource) => {
                    const formattedSize = formatFileSize(resource.fileSize)

                    return (
                      <article className='rounded-xl border border-jpv-border p-5' key={resource.downloadUrl}>
                        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                          <div>
                            <h4 className='font-semibold text-jpv-ink'>{resource.title}</h4>
                            {resource.description ? (
                              <p className='mt-2 text-sm leading-6 text-jpv-muted'>{resource.description}</p>
                            ) : null}
                            {resource.fileName || formattedSize ? (
                              <p className='mt-3 text-xs text-jpv-muted'>
                                {[resource.fileName, formattedSize].filter(Boolean).join(' · ')}
                              </p>
                            ) : null}
                          </div>

                          <a
                            className='jpv-button-primary inline-flex shrink-0'
                            href={resource.downloadUrl}
                          >
                            Download
                          </a>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section aria-labelledby='lesson-progress-heading' className='flex flex-col gap-4 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='font-semibold text-jpv-ink' id='lesson-progress-heading'>Next step: lesson progress</h2>
              <p className='mt-1 text-sm text-jpv-muted'>
                {detail.lesson.completed
                  ? 'This lesson is marked complete.'
                  : 'Mark this lesson complete when you are ready to continue.'}
              </p>
            </div>

            {!detail.lesson.completed ? (
              <form action={completeLesson}>
                <input name='courseSlug' type='hidden' value={courseSlug} />
                <input name='lessonSlug' type='hidden' value={lessonSlug} />
                <button className='jpv-button-primary min-h-11' type='submit'>
                  Mark complete
                </button>
              </form>
            ) : null}
          </section>

          <section aria-labelledby='lesson-discussion-heading' className='scroll-mt-24 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8' id='lesson-discussion'>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <p className='jpv-eyebrow'>Community</p>
                <h2 className='mt-2 text-xl font-semibold text-jpv-ink' id='lesson-discussion-heading'>Lesson discussion</h2>
                <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
                  Ask questions, share insights, and reply to other members about this lesson.
                </p>
              </div>
            </div>
            <EngagementCommentActionBar
              className='mt-5'
              commentCount={discussion?.comments.length ?? 0}
              replyLabel='Replies remain available through the existing discussion flow'
            />
            <div className='mt-3'>
              <EngagementFutureActions />
            </div>

            {firstParam(query?.discussion) === 'posted' ? (
              <p className='jpv-notice mt-5 rounded-jpv-card px-4 py-3 text-sm font-medium' role='status'>
                Your discussion comment was posted.
              </p>
            ) : null}
            {firstParam(query?.discussion) === 'error' ? (
              <p className='jpv-notice jpv-notice-danger mt-5 rounded-xl px-4 py-3 text-sm font-medium'>
                {firstParam(query?.reason) === 'rate_limit'
                  ? 'You are posting too quickly. Please try again shortly.'
                  : firstParam(query?.reason) === 'validation'
                    ? 'Please enter a valid discussion comment.'
                    : firstParam(query?.reason) === 'not_allowed'
                      ? 'This discussion action is not available for your account or lesson.'
                      : 'Unable to post the discussion comment right now.'}
              </p>
            ) : null}

            <div className='mt-6'>
              {discussion?.allowed && discussion.comments.length > 0 ? (
                <LessonCommentThread
                  comments={discussion.comments}
                  parentId={null}
                  courseSlug={courseSlug}
                  lessonSlug={lessonSlug}
                  reactionSummaries={reactionSummaries}
                />
              ) : (
                <div className='rounded-xl border border-dashed border-jpv-border px-5 py-6 text-sm text-jpv-muted'>
                  No discussion comments yet. Start the conversation below.
                </div>
              )}
            </div>

            <form action={submitLessonDiscussionComment} className='mt-7 space-y-3 border-t border-jpv-border pt-6'>
              <input name='courseSlug' type='hidden' value={courseSlug} />
              <input name='lessonSlug' type='hidden' value={lessonSlug} />
              <label className='block text-sm font-semibold text-jpv-ink' htmlFor='lesson-discussion-body'>
                Add to the discussion
              </label>
              <textarea
                className='min-h-28 w-full rounded-xl border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm outline-none focus:border-jpv-brand'
                id='lesson-discussion-body'
                maxLength={10_000}
                name='body'
                placeholder='Share a question, insight, or response about this lesson.'
                required
              />
              <button className='jpv-button-primary min-h-11' type='submit'>Post comment</button>
            </form>
          </section>

          <nav aria-label='Lesson navigation' className='flex items-center justify-between gap-4'>
            {detail.previousLesson?.slug ? (
              <Link
                className='inline-flex min-h-11 min-w-0 items-center truncate text-sm font-semibold text-jpv-inverse-muted underline-offset-4 hover:text-jpv-ink hover:underline'
                href={`/portal/courses/${courseSlug}/lessons/${detail.previousLesson.slug}`}
              >
                ← {detail.previousLesson.title}
              </Link>
            ) : (
              <span />
            )}

            {detail.nextLesson?.slug ? (
              <Link
                className='inline-flex min-h-11 min-w-0 items-center truncate text-right text-sm font-semibold text-jpv-inverse-muted underline-offset-4 hover:text-jpv-ink hover:underline'
                href={`/portal/courses/${courseSlug}/lessons/${detail.nextLesson.slug}`}
              >
                {detail.nextLesson.title} →
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </div>
  )
}
