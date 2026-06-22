import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { getMemberLessonDetail } from '@/lib/payloadCourse/memberPortal'

import { completeLessonAction } from '../../actions'
import { PortalShell, StatusPill } from '../../PortalShell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function LearnLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { courseSlug, lessonSlug } = await params
  const query = await searchParams
  const completed = firstParam(query.completed) === '1'
  const blocked = firstParam(query.blocked) === '1'
  const { member, payload } = await getCurrentPayloadMember()

  if (!member) {
    redirect(`/learn/login?next=/learn/${courseSlug}/${lessonSlug}`)
  }

  const email = typeof member.email === 'string' ? member.email : null
  const detail = await getMemberLessonDetail(payload, member.id, courseSlug, lessonSlug)
  if (!detail?.lesson) {
    notFound()
  }

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <Link className='text-sm font-bold text-[#153f2e]' href={`/learn/${courseSlug}`}>
          Back to course
        </Link>

        {!detail.allowed ? (
          <section className='mt-6 rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
              {detail.course.title}
            </p>
            <h1 className='mt-3 text-3xl font-bold tracking-tight text-[#153f2e]'>Lesson locked</h1>
            <p className='mt-3 max-w-2xl text-sm leading-6 text-[#68766f]'>
              {blocked ? 'The completion request was blocked because access did not pass.' : detail.lockReason}
            </p>
            {detail.previousLesson && !detail.previousLesson.completed && (
              <p className='mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800'>
                Complete the previous lesson before opening this one.
              </p>
            )}
          </section>
        ) : (
          <section className='mt-6 grid gap-6 lg:grid-cols-[1fr_0.38fr]'>
            <article className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)] sm:p-8'>
              <div className='flex flex-wrap gap-3'>
                <StatusPill tone={detail.lesson.completed ? 'good' : 'neutral'}>
                  {detail.lesson.completed ? 'Completed' : 'In progress'}
                </StatusPill>
                {detail.lesson.previewLesson && <StatusPill tone='neutral'>Preview</StatusPill>}
                <StatusPill tone='neutral'>{detail.lesson.estimatedDuration ?? 'Duration pending'}</StatusPill>
              </div>

              <p className='mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
                {detail.module.title}
              </p>
              <h1 className='mt-3 text-4xl font-bold leading-tight tracking-tight text-[#153f2e]'>
                {detail.lesson.title}
              </h1>
              {detail.lesson.summary && (
                <p className='mt-5 max-w-2xl text-base leading-7 text-[#68766f]'>
                  {detail.lesson.summary}
                </p>
              )}

              <div className='mt-8 rounded-[24px] bg-[#153f2e] p-7 text-white'>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#d9c897]'>
                  Lesson content
                </p>
                <h2 className='mt-3 text-2xl font-bold'>Payload lesson renderer placeholder</h2>
                <p className='mt-3 text-sm leading-6 text-[#d5e0da]'>
                  Access has passed. Rich text, media downloads, comments, and files should be rendered here only after their final renderers and file access checks are added.
                </p>
                {detail.lesson.videoIdOrPreviewUrl && (
                  <p className='mt-4 rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-sm'>
                    Video: {detail.lesson.videoProviderLabel ?? 'provider'} · {detail.lesson.videoIdOrPreviewUrl}
                  </p>
                )}
              </div>

              {completed && (
                <p className='mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
                  Lesson marked complete.
                </p>
              )}
            </article>

            <aside className='space-y-5'>
              <div className='rounded-[24px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Progress</p>
                <form action={completeLessonAction} className='mt-5'>
                  <input name='courseSlug' type='hidden' value={courseSlug} />
                  <input name='lessonSlug' type='hidden' value={lessonSlug} />
                  <button
                    className='w-full rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60'
                    disabled={detail.lesson.completed}
                    type='submit'
                  >
                    {detail.lesson.completed ? 'Already complete' : 'Mark complete'}
                  </button>
                </form>
              </div>

              <div className='rounded-[24px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Navigation</p>
                <div className='mt-5 space-y-3'>
                  {detail.previousLesson?.slug && (
                    <Link
                      className='block rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4 text-sm font-bold text-[#153f2e]'
                      href={`/learn/${courseSlug}/${detail.previousLesson.slug}`}
                    >
                      Previous: {detail.previousLesson.title}
                    </Link>
                  )}
                  {detail.nextLesson?.slug && (
                    <Link
                      className='block rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4 text-sm font-bold text-[#153f2e]'
                      href={`/learn/${courseSlug}/${detail.nextLesson.slug}`}
                    >
                      Next: {detail.nextLesson.title}
                    </Link>
                  )}
                </div>
              </div>
            </aside>
          </section>
        )}
      </main>
    </PortalShell>
  )
}
