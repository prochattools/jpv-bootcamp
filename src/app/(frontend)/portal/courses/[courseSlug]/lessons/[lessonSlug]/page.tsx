import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Download, FileText } from 'lucide-react'

import { MemberFeaturedImage } from '@/components/portal/MemberContentMedia'
import { submitReactionAction } from '@/app/(frontend)/portal/reaction-actions'
import {
  DiscussionHierarchy,
  EngagementAuthorIdentity,
  EngagementCommentActionBar,
  EngagementFutureActions,
  EngagementReactionBar,
  reactionErrorMessage,
} from '@/components/community/EngagementPresentation'
import { ProgressiveCommentList } from '@/components/community/ProgressiveCommentList'
import { LessonCommentOwnerActions } from '@/components/community/LessonCommentOwnerActions'
import { LessonCommentComposer } from '@/components/community/LessonCommentComposer'
import { AdminGate } from '@/components/portal/AdminGate'
import { LegacyLessonRichText } from '@/components/portal/LegacyLessonRichText'
import { LessonCourseNavigation } from '@/components/portal/LessonCourseNavigation'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import { getAdminLessonDetail } from '@/lib/portalAdmin/adminPortal'
import { getLessonCommentReactionSummaries, type ReactionSummary } from '@/lib/payloadCourse/reactions'
import {
  listLessonDiscussion,
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
    reaction?: string | string[] | undefined
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

function lessonCommentPlainText(body: LessonDiscussionComment['body']): string {
  const texts: string[] = []
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    const node = value as Record<string, unknown>
    if (typeof node.text === 'string') texts.push(node.text)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  visit(body.root)
  return texts.join(' ').replace(/\s+/g, ' ').trim()
}

function LessonCommentThread({
  comments,
  parentId,
  courseSlug,
  lessonSlug,
  viewerMemberId,
  reactionSummaries,
  reactionError,
  depth = 0,
}: {
  comments: LessonDiscussionComment[]
  parentId: string | null
  courseSlug: string
  lessonSlug: string
  viewerMemberId: string
  reactionSummaries: ReadonlyMap<string, ReactionSummary>
  reactionError: string | null
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
        {comment.authorId === viewerMemberId ? (
          <LessonCommentOwnerActions
            commentId={comment.id}
            courseSlug={courseSlug}
            initialBody={lessonCommentPlainText(comment.body)}
            lessonSlug={lessonSlug}
          />
        ) : null}
      </div>
      <LegacyLessonRichText data={comment.body} lessonSlug={lessonSlug} />

      {reactionSummaries.get(comment.id) ? (
        <EngagementReactionBar
          action={submitReactionAction}
          className='mt-4'
          counts={reactionSummaries.get(comment.id)?.counts}
          errorMessage={reactionError}
          label='Discussion comment reactions'
          redirectPath={`/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`}
          targetId={comment.id}
          targetKind='lesson_comment'
          totalCount={reactionSummaries.get(comment.id)?.totalCount}
          viewerReaction={reactionSummaries.get(comment.id)?.viewerReaction}
        />
      ) : null}

      <details className='mt-4'>
        <summary className='min-h-10 cursor-pointer py-2 text-sm font-semibold text-jpv-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'>Reply</summary>
        <LessonCommentComposer
          courseSlug={courseSlug}
          lessonSlug={lessonSlug}
          parentId={comment.id}
          placeholder={`Reply to ${comment.displayName}`}
          submitLabel='Post reply'
        />
      </details>

      <LessonCommentThread
        comments={comments}
        parentId={comment.id}
        courseSlug={courseSlug}
        lessonSlug={lessonSlug}
        viewerMemberId={viewerMemberId}
        reactionSummaries={reactionSummaries}
        reactionError={reactionError}
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
  const { actor, payload } = await requirePortalAccess(requestedPath)
  const query = searchParams ? await searchParams : undefined

  if (actor.kind === 'admin') {
    const detail = await getAdminLessonDetail(payload, courseSlug, lessonSlug)
    if (!detail) notFound()

    return (
      <div className='mx-auto grid w-full max-w-[90rem] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <main className='min-w-0 space-y-8'>
        <nav aria-label='Learning path' className='text-sm text-jpv-muted'>
          <ol className='flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1'>
            <li>
              <Link
                className='font-semibold text-jpv-brand-deep underline-offset-4 hover:text-jpv-ink hover:underline'
                href={`/portal/courses/${courseSlug}`}
              >
                {detail.course.title}
              </Link>
            </li>
            <li aria-hidden='true'>/</li>
            <li>{detail.module.title}</li>
            <li aria-hidden='true'>/</li>
            <li className='font-medium text-jpv-ink'>{detail.lesson.title}</li>
          </ol>
        </nav>

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
              <span className='rounded-full bg-yellow-100 px-3 py-1 text-yellow-800'>Admin view</span>
            </div>
          </div>
        </section>

        <AdminGate>
          <section className='rounded-jpv-panel border border-yellow-200 bg-yellow-50 p-6 shadow-jpv-card sm:p-8'>
            <p className='jpv-eyebrow text-yellow-700'>Admin metadata</p>
            <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3'>
              <div>
                <dt className='font-semibold text-jpv-ink'>Lock state</dt>
                <dd className='text-jpv-muted'>{detail.lesson.lockState}</dd>
              </div>
              <div>
                <dt className='font-semibold text-jpv-ink'>Sort order</dt>
                <dd className='text-jpv-muted'>{detail.lesson.sortOrder}</dd>
              </div>
              <div>
                <dt className='font-semibold text-jpv-ink'>Preview lesson</dt>
                <dd className='text-jpv-muted'>{detail.lesson.previewLesson ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className='font-semibold text-jpv-ink'>Course status</dt>
                <dd className='text-jpv-muted'>{detail.course.status}</dd>
              </div>
            </dl>
          </section>
        </AdminGate>

        <section aria-labelledby='lesson-media-heading' className='space-y-4'>
          <h2 className='sr-only' id='lesson-media-heading'>Lesson media</h2>
          {detail.lesson.coverImage ? (
            <div className='mx-auto max-h-[480px] w-full overflow-hidden rounded-jpv-panel'>
              <MemberFeaturedImage asset={detail.lesson.coverImage} />
            </div>
          ) : null}
          <div className='mx-auto w-full max-w-4xl [&>div]:max-h-[480px]'>
            <LessonVideoPlayer
              lessonSlug={lessonSlug}
              status={detail.lesson.managedVideo?.status}
              thumbnailUrl={detail.lesson.managedVideo?.thumbnailUrl}
              title={detail.lesson.managedVideo?.title ?? 'Lesson video'}
            />
          </div>
        </section>

        <section aria-labelledby='lesson-content-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
          <h2 className='text-xl font-semibold text-jpv-ink' id='lesson-content-heading'>Lesson content</h2>
          {detail.lesson.contentLexical ? (
            <LegacyLessonRichText data={detail.lesson.contentLexical} lessonSlug={lessonSlug} />
          ) : (
            <p className='mt-5 text-sm text-jpv-muted'>Lesson content is not available yet.</p>
          )}
        </section>

        {detail.lesson.resources.length > 0 ? (
          <section aria-labelledby='lesson-resources-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
            <div className='flex items-end justify-between gap-4'>
              <div>
                <p className='jpv-eyebrow'>Downloads</p>
                <h2 className='mt-2 text-xl font-semibold text-jpv-ink' id='lesson-resources-heading'>Lesson resources</h2>
              </div>
              <span className='text-sm text-jpv-muted'>{detail.lesson.resources.length} available</span>
            </div>
            <div className='mt-5 grid gap-3'>
              {detail.lesson.resources.map((resource) => {
                const formattedSize = formatFileSize(resource.fileSize)
                return (
                  <article className='flex flex-col gap-4 rounded-jpv-card border border-jpv-border bg-jpv-surface p-4 sm:flex-row sm:items-center sm:justify-between' key={resource.downloadUrl}>
                    <div className='flex min-w-0 items-start gap-3'>
                      <span aria-hidden='true' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-jpv-card bg-jpv-brand/10 text-jpv-brand-deep'>
                        <FileText className='h-5 w-5' />
                      </span>
                      <div className='min-w-0'>
                        <h3 className='font-semibold text-jpv-ink'>{resource.title}</h3>
                        {resource.description ? (
                          <p className='mt-1 text-sm leading-6 text-jpv-muted'>{resource.description}</p>
                        ) : null}
                        {resource.fileName || formattedSize ? (
                          <p className='mt-2 text-xs text-jpv-muted'>
                            {[resource.fileName, formattedSize].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <a
                      aria-label={`Download ${resource.title}`}
                      className='jpv-button-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2'
                      href={resource.downloadUrl}
                    >
                      <Download aria-hidden='true' className='h-4 w-4' />
                      Download
                    </a>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section aria-labelledby='lesson-discussion-heading' className='scroll-mt-24 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8' id='lesson-discussion'>
          <p className='jpv-eyebrow'>Community</p>
          <h2 className='mt-2 text-xl font-semibold text-jpv-ink' id='lesson-discussion-heading'>Lesson discussion</h2>
          <p className='mt-3 rounded-xl border border-dashed border-jpv-border px-5 py-6 text-sm text-jpv-muted'>
            Admin viewing — use a member account to post.
          </p>
        </section>

        </main>
        <LessonCourseNavigation
          courseSlug={courseSlug}
          currentLessonSlug={lessonSlug}
          modules={detail.courseNavigation}
        />
      </div>
    )
  }

  const memberId = actor.memberId
  const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)

  if (!detail) notFound()

  const discussion = detail.allowed && detail.lesson?.id
    ? await listLessonDiscussion(payload as PayloadCourseWriteAPI, memberId, detail.lesson.id)
    : null
  const reactionSummaries = new Map<string, ReactionSummary>()
  const reactionError = firstParam(query?.reaction) === 'error'
    ? reactionErrorMessage(firstParam(query?.reason))
    : null
  const discussionIsOpen = firstParam(query?.discussion) === 'posted' || firstParam(query?.discussion) === 'error'
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
    <div className='mx-auto grid w-full max-w-[90rem] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]'>
      <main className='min-w-0 space-y-8'>
      <nav aria-label='Learning path' className='text-sm text-jpv-muted'>
        <ol className='flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1'>
          <li>
            <Link
              className='font-semibold text-jpv-brand-deep underline-offset-4 hover:text-jpv-ink hover:underline'
              href={`/portal/courses/${courseSlug}`}
            >
              {detail.course.title}
            </Link>
          </li>
          <li aria-hidden='true'>/</li>
          <li>{detail.module.title}</li>
          <li aria-hidden='true'>/</li>
          <li className='font-medium text-jpv-ink'>{detail.lesson?.title ?? 'Lesson'}</li>
        </ol>
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

          <section aria-labelledby='lesson-media-heading' className='space-y-4'>
            <h2 className='sr-only' id='lesson-media-heading'>Lesson media</h2>
            {detail.lesson.coverImage ? (
              <div className='mx-auto max-h-[480px] w-full overflow-hidden rounded-jpv-panel'>
                <MemberFeaturedImage asset={detail.lesson.coverImage} />
              </div>
            ) : null}
            <div className='mx-auto w-full max-w-4xl [&>div]:max-h-[480px]'>
              <LessonVideoPlayer
                lessonSlug={lessonSlug}
                status={detail.lesson.managedVideo?.status}
                thumbnailUrl={detail.lesson.managedVideo?.thumbnailUrl}
                title={detail.lesson.managedVideo?.title ?? 'Lesson video'}
              />
            </div>
          </section>

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
            {detail.lesson.contentLexical ? (
              <LegacyLessonRichText data={detail.lesson.contentLexical} lessonSlug={lessonSlug} />
            ) : (
              <p className='mt-5 text-sm text-jpv-muted'>Lesson content is not available yet.</p>
            )}
          </section>

          {detail.lesson.resources.length > 0 ? (
            <section aria-labelledby='lesson-resources-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
              <div className='flex items-end justify-between gap-4'>
                <div>
                  <p className='jpv-eyebrow'>Downloads</p>
                  <h2 className='mt-2 text-xl font-semibold text-jpv-ink' id='lesson-resources-heading'>Lesson resources</h2>
                </div>
                <span className='text-sm text-jpv-muted'>{detail.lesson.resources.length} available</span>
              </div>
              <div className='mt-5 grid gap-3'>
                {detail.lesson.resources.map((resource) => {
                  const formattedSize = formatFileSize(resource.fileSize)

                  return (
                    <article className='flex flex-col gap-4 rounded-jpv-card border border-jpv-border bg-jpv-surface p-4 sm:flex-row sm:items-center sm:justify-between' key={resource.downloadUrl}>
                      <div className='flex min-w-0 items-start gap-3'>
                        <span aria-hidden='true' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-jpv-card bg-jpv-brand/10 text-jpv-brand-deep'>
                          <FileText className='h-5 w-5' />
                        </span>
                        <div className='min-w-0'>
                          <h3 className='font-semibold text-jpv-ink'>{resource.title}</h3>
                          {resource.description ? (
                            <p className='mt-1 text-sm leading-6 text-jpv-muted'>{resource.description}</p>
                          ) : null}
                          {resource.fileName || formattedSize ? (
                            <p className='mt-2 text-xs text-jpv-muted'>
                              {[resource.fileName, formattedSize].filter(Boolean).join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <a
                        aria-label={`Download ${resource.title}`}
                        className='jpv-button-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2'
                        href={resource.downloadUrl}
                      >
                        <Download aria-hidden='true' className='h-4 w-4' />
                        Download
                      </a>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby='lesson-discussion-heading' className='scroll-mt-24 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8' id='lesson-discussion'>
            <details className='group' open={discussionIsOpen}>
              <summary className='list-none cursor-pointer rounded-jpv-card outline-none focus-visible:ring-2 focus-visible:ring-jpv-green'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <p className='jpv-eyebrow'>Community</p>
                    <h2 className='mt-2 text-xl font-semibold text-jpv-ink' id='lesson-discussion-heading'>Lesson discussion</h2>
                    <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
                      Ask questions, share insights, and reply to other members about this lesson.
                    </p>
                  </div>
                  <div className='flex flex-wrap items-center gap-3'>
                    <span className='text-sm font-semibold text-jpv-muted'>
                      {discussion?.comments.length ?? 0} {(discussion?.comments.length ?? 0) === 1 ? 'comment' : 'comments'}
                    </span>
                    <span className='jpv-button-secondary inline-flex min-h-11 items-center'>View discussion</span>
                  </div>
                </div>
              </summary>

              <div className='mt-6 border-t border-jpv-border pt-6'>
                <EngagementCommentActionBar
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
                      viewerMemberId={memberId}
                      reactionSummaries={reactionSummaries}
                      reactionError={reactionError}
                    />
                  ) : (
                    <div className='rounded-xl border border-dashed border-jpv-border px-5 py-6 text-sm text-jpv-muted'>
                      No discussion comments yet. Start the conversation below.
                    </div>
                  )}
                </div>

                <div className='mt-7 border-t border-jpv-border pt-6'>
                  <LessonCommentComposer courseSlug={courseSlug} lessonSlug={lessonSlug} />
                </div>
              </div>
            </details>
          </section>

          <section aria-labelledby='lesson-progress-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-5 shadow-jpv-card sm:p-6'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
              <div className='min-w-0'>
                <h2 className='font-semibold text-jpv-ink' id='lesson-progress-heading'>Next step: lesson progress</h2>
                <p className='mt-1 text-sm text-jpv-muted'>
                  {detail.lesson.completed
                    ? 'This lesson is marked complete.'
                    : 'Mark this lesson complete when you are ready to continue.'}
                </p>
              </div>

              {!detail.lesson.completed ? (
                <form action={completeLesson} className='shrink-0'>
                  <input name='courseSlug' type='hidden' value={courseSlug} />
                  <input name='lessonSlug' type='hidden' value={lessonSlug} />
                  <button className='jpv-button-primary min-h-11 w-full sm:w-auto' type='submit'>
                    Mark complete
                  </button>
                </form>
              ) : null}
            </div>

          </section>
        </>
      )}
      </main>
      {detail.allowed ? (
        <LessonCourseNavigation
          courseSlug={courseSlug}
          currentLessonSlug={lessonSlug}
          modules={detail.courseNavigation}
        />
      ) : null}
    </div>
  )
}
