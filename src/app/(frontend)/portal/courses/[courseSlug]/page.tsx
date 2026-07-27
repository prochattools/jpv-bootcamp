import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MemberFeaturedImage } from '@/components/portal/MemberContentMedia'
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

      <MemberFeaturedImage asset={course.coverImage} />

      <section className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <div className='flex flex-col gap-6 md:flex-row md:items-start md:justify-between'>
          <div className='max-w-3xl'>
            <p className='jpv-eyebrow'>Course</p>
            <h1 className='mt-3 text-3xl font-semibold tracking-tight'>{course.title}</h1>
            {course.shortDescription ? (
              <p className='mt-4 text-sm leading-6 text-neutral-600'>{course.shortDescription}</p>
            ) : null}
          </div>

          <div className='flex flex-wrap gap-2 text-xs font-semibold'>
            {course.estimatedDuration ? (
              <span className='rounded-full bg-neutral-100 px-3 py-1 text-neutral-700'>{course.estimatedDuration}</span>
            ) : null}
            {course.completedLessonCount !== null && course.lessonCount !== null ? (
              <span className='rounded-full bg-neutral-100 px-3 py-1 text-neutral-700'>
                {course.completedLessonCount}/{course.lessonCount} lessons complete
              </span>
            ) : null}
            {course.progressPercent !== null ? (
              <span className='rounded-full bg-[var(--jpv-brand-deep)] px-3 py-1 text-[var(--jpv-canvas)]'>{course.progressPercent}% complete</span>
            ) : null}
          </div>
        </div>
      </section>

      {!course.allowed ? (
        <section className='jpv-notice jpv-notice-danger rounded-2xl p-6'>
          <h2 className='font-semibold'>This course is currently locked</h2>
          <p className='mt-2 text-sm'>
            {course.lockReason ?? 'Your account does not currently have access to this course.'}
          </p>
        </section>
      ) : course.modules.length > 0 ? (
        <section className='space-y-5'>
          {course.modules.map((module, moduleIndex) => (
            <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={module.id}>
              <div>
                <p className='jpv-eyebrow'>
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
                    <div className='min-w-0'>
                      <p className='text-xs font-medium text-neutral-500'>Lesson {lessonIndex + 1}</p>
                      <h3 className='mt-1 font-semibold text-neutral-950'>{lesson.title}</h3>
                      {lesson.summary ? <p className='mt-1 text-sm text-neutral-600'>{lesson.summary}</p> : null}
                      {lesson.estimatedDuration ? (
                        <p className='mt-1 text-xs font-medium text-neutral-500'>{lesson.estimatedDuration}</p>
                      ) : null}
                    </div>

                    <div className='flex shrink-0 items-center gap-3'>
                      {lesson.completed ? (
                        <span className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
                          Complete
                        </span>
                      ) : lesson.lockState === 'locked' ? (
                        <span className='jpv-notice jpv-notice-danger rounded-full px-3 py-1 text-xs font-semibold'>
                          Locked
                        </span>
                      ) : lesson.lockState === 'coming_soon' ? (
                        <span className='jpv-notice rounded-full px-3 py-1 text-xs font-semibold'>
                          Coming soon
                        </span>
                      ) : lesson.previewLesson ? (
                        <span className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
                          Preview
                        </span>
                      ) : null}

                      {lesson.slug ? (
                        <Link
                          className='jpv-button-primary'
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
