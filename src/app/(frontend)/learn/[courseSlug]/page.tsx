import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { getMemberCourseOverview } from '@/lib/payloadCourse/memberPortal'

import { PortalShell, StatusPill } from '../PortalShell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function titleCase(value: string | null | undefined): string {
  if (!value) return 'Course'
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export default async function LearnCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  const { courseSlug } = await params
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect(`/learn/login?next=/learn/${courseSlug}`)
  }

  const email = typeof member.email === 'string' ? member.email : null
  const course = await getMemberCourseOverview(payload, member.id, courseSlug)
  if (!course) {
    notFound()
  }

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-[28px] bg-[#153f2e] text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)]'>
          <div className='p-8 sm:p-10 lg:p-14'>
            <div className='flex flex-wrap gap-3'>
              <StatusPill tone={course.allowed ? 'good' : 'warn'}>
                {course.allowed ? 'Unlocked' : 'Locked'}
              </StatusPill>
              <StatusPill tone='neutral'>{titleCase(course.accessBadge)}</StatusPill>
              <StatusPill tone='neutral'>{course.estimatedDuration ?? 'Duration pending'}</StatusPill>
            </div>
            <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
              {course.title}
            </h1>
            <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
              {course.shortDescription ?? 'Course description pending.'}
            </p>
          </div>
        </section>

        {!course.allowed ? (
          <section className='mt-8 rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Access blocked</p>
            <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>This course is locked</h2>
            <p className='mt-3 max-w-2xl text-sm leading-6 text-[#68766f]'>{course.lockReason}</p>
            <Link
              className='mt-6 inline-flex rounded-full border border-[#153f2e]/15 px-5 py-3 text-sm font-bold text-[#153f2e]'
              href='/learn'
            >
              Back to courses
            </Link>
          </section>
        ) : (
          <section className='mt-10 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]'>
            <aside className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Progress</p>
              <h2 className='mt-3 text-2xl font-bold text-[#153f2e]'>{course.progressPercent ?? 0}% complete</h2>
              <p className='mt-3 text-sm leading-6 text-[#68766f]'>
                {course.completedLessonCount ?? 0} of {course.lessonCount ?? 0} lessons completed.
              </p>
              <div className='mt-5 h-2 overflow-hidden rounded-full bg-[#e9e7df]'>
                <div
                  className='h-full rounded-full bg-[#9d864b]'
                  style={{ width: `${course.progressPercent ?? 0}%` }}
                />
              </div>
            </aside>

            <div className='space-y-5'>
              {course.modules.map((module) => (
                <article
                  className='rounded-[24px] border border-[#153f2e]/10 bg-white p-6 shadow-[0_16px_45px_rgba(31,52,43,0.08)]'
                  key={module.id}
                >
                  <div>
                    <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Module</p>
                    <h2 className='mt-2 text-2xl font-bold text-[#153f2e]'>{module.title}</h2>
                    {module.description && (
                      <p className='mt-2 text-sm leading-6 text-[#68766f]'>{module.description}</p>
                    )}
                  </div>

                  <div className='mt-5 divide-y divide-[#153f2e]/10'>
                    {module.lessons.map((lesson) => (
                      <div className='flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between' key={lesson.id}>
                        <div>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='font-bold text-[#153f2e]'>{lesson.title}</h3>
                            {lesson.previewLesson && <StatusPill tone='neutral'>Preview</StatusPill>}
                            {lesson.completed && <StatusPill tone='good'>Completed</StatusPill>}
                          </div>
                          <p className='mt-1 text-sm text-[#68766f]'>
                            {lesson.estimatedDuration ?? 'Duration pending'}
                          </p>
                        </div>

                        {course.slug && lesson.slug && (
                          <Link
                            className='inline-flex rounded-full bg-[#153f2e] px-5 py-2.5 text-sm font-bold text-white'
                            href={`/learn/${course.slug}/${lesson.slug}`}
                          >
                            Open lesson
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </PortalShell>
  )
}
