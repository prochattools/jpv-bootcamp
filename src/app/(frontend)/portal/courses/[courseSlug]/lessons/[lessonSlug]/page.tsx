import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'
import {
  getMemberLessonDetail,
  markMemberLessonComplete,
} from '@/lib/payloadCourse/memberPortal'
import { LessonVideoPlayer } from './LessonVideoPlayer'

type LessonPageProps = {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
  searchParams?: Promise<{ completed?: string | string[] | undefined }>
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

export default async function PortalLessonPage({ params, searchParams }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params
  const requestedPath = getLessonPath(courseSlug, lessonSlug)
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const detail = await getMemberLessonDetail(payload, memberId, courseSlug, lessonSlug)
  const query = searchParams ? await searchParams : undefined

  if (!detail) notFound()

  return (
    <div className='space-y-8'>
      <Link
        className='inline-flex text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline'
        href={`/portal/courses/${courseSlug}`}
      >
        ← Back to {detail.course.title}
      </Link>

      {!detail.allowed || !detail.lesson ? (
        <section className='rounded-2xl border border-amber-200 bg-amber-50 p-8'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-amber-800'>Lesson unavailable</p>
          <h1 className='mt-3 text-2xl font-semibold text-amber-950'>This lesson is currently locked</h1>
          <p className='mt-3 text-sm leading-6 text-amber-900'>
            {detail.lockReason ?? 'Your account does not currently have access to this lesson.'}
          </p>
          {detail.previousLesson && !detail.previousLesson.completed ? (
            <p className='mt-4 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-amber-800'>
              Complete the previous lesson before opening this one.
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>{detail.module.title}</p>
            <div className='mt-3 flex flex-col gap-5 md:flex-row md:items-start md:justify-between'>
              <div className='max-w-3xl'>
                <h1 className='text-3xl font-semibold tracking-tight'>{detail.lesson.title}</h1>
                {detail.lesson.summary ? (
                  <p className='mt-4 text-sm leading-6 text-neutral-600'>{detail.lesson.summary}</p>
                ) : null}
              </div>

              <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                {detail.lesson.estimatedDuration ? (
                  <span className='rounded-full bg-neutral-100 px-3 py-1 text-neutral-700'>
                    {detail.lesson.estimatedDuration}
                  </span>
                ) : null}
                {detail.lesson.previewLesson ? (
                  <span className='rounded-full bg-blue-50 px-3 py-1 text-blue-700'>Preview</span>
                ) : null}
                {detail.lesson.completed ? (
                  <span className='rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'>Complete</span>
                ) : null}
              </div>
            </div>
          </section>

          {firstParam(query?.completed) === '1' ? (
            <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
              Lesson marked complete.
            </p>
          ) : null}

          <section className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
            <h2 className='text-xl font-semibold'>Lesson content</h2>
            {detail.lesson.lockState === 'locked' ? (
              <div className='mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'>
                <p className='text-sm font-semibold text-amber-800'>Lesson locked</p>
                <p className='mt-1 text-sm text-amber-700'>This lesson is not yet available.</p>
              </div>
            ) : detail.lesson.lockState === 'coming_soon' ? (
              <div className='mt-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3'>
                <p className='text-sm font-semibold text-neutral-700'>Coming soon</p>
                <p className='mt-1 text-sm text-neutral-600'>This lesson will be available shortly.</p>
              </div>
            ) : null}
            <LessonVideoPlayer lessonSlug={lessonSlug} />
            {detail.lesson.contentHtml ? (
              <div
                className='lesson-body mt-8 max-w-none text-sm leading-7 text-neutral-800 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-neutral-950 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3'
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: detail.lesson.contentHtml }}
              />
            ) : null}

            {detail.lesson.resources.length > 0 ? (
              <div className='mt-8 space-y-4'>
                <h3 className='text-lg font-semibold'>Lesson resources</h3>
                <div className='grid gap-4'>
                  {detail.lesson.resources.map((resource) => {
                    const formattedSize = formatFileSize(resource.fileSize)

                    return (
                      <article className='rounded-xl border border-neutral-200 p-5' key={resource.downloadUrl}>
                        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                          <div>
                            <h4 className='font-semibold text-neutral-950'>{resource.title}</h4>
                            {resource.description ? (
                              <p className='mt-2 text-sm leading-6 text-neutral-600'>{resource.description}</p>
                            ) : null}
                            {resource.fileName || formattedSize ? (
                              <p className='mt-3 text-xs text-neutral-500'>
                                {[resource.fileName, formattedSize].filter(Boolean).join(' · ')}
                              </p>
                            ) : null}
                          </div>

                          <a
                            className='inline-flex shrink-0 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white'
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

          <section className='flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='font-semibold'>Lesson progress</h2>
              <p className='mt-1 text-sm text-neutral-600'>
                {detail.lesson.completed
                  ? 'This lesson is marked complete.'
                  : 'Mark this lesson complete when you are ready to continue.'}
              </p>
            </div>

            {!detail.lesson.completed ? (
              <form action={completeLesson}>
                <input name='courseSlug' type='hidden' value={courseSlug} />
                <input name='lessonSlug' type='hidden' value={lessonSlug} />
                <button className='rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white' type='submit'>
                  Mark complete
                </button>
              </form>
            ) : null}
          </section>

          <nav aria-label='Lesson navigation' className='flex items-center justify-between gap-4'>
            {detail.previousLesson?.slug ? (
              <Link
                className='text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline'
                href={`/portal/courses/${courseSlug}/lessons/${detail.previousLesson.slug}`}
              >
                ← {detail.previousLesson.title}
              </Link>
            ) : (
              <span />
            )}

            {detail.nextLesson?.slug ? (
              <Link
                className='text-right text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline'
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
