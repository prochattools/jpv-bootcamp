import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCourseOverview } from '@/lib/payloadCourse/memberPortal'

type CoursePageProps = {
  params: Promise<{ courseSlug: string }>
}

export default async function PortalCoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const requestedPath = `/portal/courses/${courseSlug}`
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const course = await getMemberCourseOverview(payload, memberId, courseSlug)

  if (!course) notFound()

  return (
    <div className='space-y-8'>
      <Link
        className='inline-flex text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline'
        href='/portal/courses'
      >
        ← Back to courses
      </Link>

      <section className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <div className='flex flex-col gap-6 md:flex-row md:items-start md:justify-between'>
          <div className='max-w-3xl'>
            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Course</p>
            <h1 className='mt-3 text-3xl font-semibold tracking-tight'>{course.title}</h1>
            {course.shortDescription ? (
              <p className='mt-4 text-sm leading-6 text-neutral-600'>{course.shortDescription}</p>
            ) : null}
          </div>

          <div className='flex flex-wrap gap-2 text-xs font-semibold'>
            {course.accessBadge ? (
              <span className='rounded-full bg-neutral-100 px-3 py-1 text-neutral-700'>{course.accessBadge}</span>
            ) : null}
            {course.estimatedDuration ? (
              <span className='rounded-full bg-neutral-100 px-3 py-1 text-neutral-700'>{course.estimatedDuration}</span>
            ) : null}
            {course.progressPercent !== null ? (
              <span className='rounded-full bg-neutral-950 px-3 py-1 text-white'>{course.progressPercent}% complete</span>
            ) : null}
          </div>
        </div>
      </section>

      {!course.allowed ? (
        <section className='rounded-2xl border border-amber-200 bg-amber-50 p-6'>
          <h2 className='font-semibold text-amber-950'>This course is currently locked</h2>
          <p className='mt-2 text-sm text-amber-900'>
            {course.lockReason ?? 'Your account does not currently have access to this course.'}
          </p>
        </section>
      ) : course.modules.length > 0 ? (
        <section className='space-y-5'>
          {course.modules.map((module, moduleIndex) => (
            <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={module.id}>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500'>
                  Module {moduleIndex + 1}
                </p>
                <h2 className='mt-2 text-xl font-semibold'>{module.title}</h2>
                {module.description ? (
                  <p className='mt-2 text-sm leading-6 text-neutral-600'>{module.description}</p>
                ) : null}
              </div>

              <ol className='mt-6 divide-y divide-neutral-200'>
                {module.lessons.map((lesson, lessonIndex) => (
                  <li className='flex items-center justify-between gap-4 py-4' key={lesson.id}>
                    <div>
                      <p className='text-xs font-medium text-neutral-500'>Lesson {lessonIndex + 1}</p>
                      <h3 className='mt-1 font-semibold text-neutral-950'>{lesson.title}</h3>
                      {lesson.summary ? <p className='mt-1 text-sm text-neutral-600'>{lesson.summary}</p> : null}
                    </div>

                    <div className='flex shrink-0 items-center gap-3'>
                      {lesson.completed ? (
                        <span className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
                          Complete
                        </span>
                      ) : lesson.previewLesson ? (
                        <span className='rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700'>
                          Preview
                        </span>
                      ) : null}

                      {lesson.slug ? (
                        <Link
                          className='rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white'
                          href={`/portal/courses/${courseSlug}/lessons/${lesson.slug}`}
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      ) : (
        <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600'>
          No lessons are currently published for this course.
        </section>
      )}
    </div>
  )
}
