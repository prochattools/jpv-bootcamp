import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CourseModuleAccordion } from '@/components/portal/CourseModuleAccordion'
import { MemberFeaturedImage } from '@/components/portal/MemberContentMedia'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCourseOverview } from '@/lib/payloadCourse/memberPortal'

type CoursePageProps = {
  params: Promise<{ courseSlug: string }>
}

function findContinueLessonHref(
  modules: Array<{ lessons: Array<{ completed: boolean; slug: string | null }> }>,
  courseSlug: string,
): string | null {
  for (const module of modules) {
    for (const lesson of module.lessons) {
      if (!lesson.completed && lesson.slug) {
        return `/portal/courses/${courseSlug}/lessons/${lesson.slug}`
      }
    }
  }
  return null
}

export default async function PortalCoursePage({ params }: CoursePageProps) {
  const { courseSlug } = await params
  const requestedPath = `/portal/courses/${courseSlug}`
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const course = await getMemberCourseOverview(payload, memberId, courseSlug)

  if (!course) notFound()

  const continueHref = course.allowed ? findContinueLessonHref(course.modules, courseSlug) : null

  return (
    <div className='mx-auto w-full max-w-6xl space-y-8'>
      <Link
        className='inline-flex min-h-11 items-center text-sm font-semibold text-jpv-inverse-muted underline-offset-4 hover:text-jpv-ink hover:underline'
        href='/portal/courses'
      >
        ← Back to courses
      </Link>

      <MemberFeaturedImage asset={course.coverImage} />

      <section aria-labelledby='course-overview-heading' className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <div className='flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between'>
          <div className='max-w-3xl'>
            <p className='jpv-eyebrow'>Course overview</p>
            <h1 className='mt-3 text-3xl font-semibold tracking-tight text-jpv-ink' id='course-overview-heading'>{course.title}</h1>
            {course.shortDescription ? (
              <p className='mt-4 text-sm leading-6 text-jpv-muted'>{course.shortDescription}</p>
            ) : null}
        </div>

          {course.allowed ? (
            <div aria-label='Course progress' className='w-full shrink-0 rounded-jpv-card border border-jpv-border bg-jpv-surface p-5 lg:max-w-xs'>
              <div className='flex items-baseline justify-between gap-4'>
                <p className='text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted'>Your progress</p>
                <p className='text-2xl font-bold text-jpv-brand-deep'>{course.progressPercent ?? 0}%</p>
              </div>
              <div
                aria-label={`Course progress: ${course.progressPercent ?? 0}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={course.progressPercent ?? 0}
                className='mt-3 h-2 overflow-hidden rounded-full bg-jpv-border'
                role='progressbar'
              >
                <div className='h-full rounded-full bg-jpv-brand transition-all' style={{ width: `${course.progressPercent ?? 0}%` }} />
              </div>
              <p className='mt-3 text-sm text-jpv-muted'>
                {course.completedLessonCount ?? 0}/{course.lessonCount ?? 0} lessons complete
              </p>
              {continueHref ? (
                <Link className='jpv-button-primary mt-5 inline-flex min-h-11 w-full justify-center' href={continueHref}>
                  Continue learning
                </Link>
              ) : (
                <p className='jpv-notice mt-5 text-sm' role='status'>Course complete. Review any lesson from the curriculum below.</p>
              )}
            </div>
          ) : null}
          </div>

        <dl className='mt-8 grid gap-4 border-t border-jpv-border pt-6 sm:grid-cols-2'>
          {course.estimatedDuration ? (
            <div>
              <dt className='text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted'>Estimated duration</dt>
              <dd className='mt-1 font-semibold text-jpv-ink'>{course.estimatedDuration}</dd>
            </div>
          ) : null}
          {course.lessonCount !== null ? (
            <div>
              <dt className='text-xs font-bold uppercase tracking-[0.14em] text-jpv-muted'>Curriculum</dt>
              <dd className='mt-1 font-semibold text-jpv-ink'>{course.lessonCount} lessons across {course.modules.length} modules</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {!course.allowed ? (
        <section className='jpv-notice jpv-notice-danger rounded-jpv-panel p-6'>
          <h2 className='font-semibold'>This course is currently locked</h2>
          <p className='mt-2 text-sm'>
            {course.lockReason ?? 'Your account does not currently have access to this course.'}
          </p>
        </section>
      ) : course.modules.length > 0 ? (
        <section aria-labelledby='course-curriculum-heading'>
          <div className='mb-5'>
            <p className='jpv-eyebrow'>Learning path</p>
            <h2 className='mt-2 text-2xl font-semibold text-jpv-ink' id='course-curriculum-heading'>Course curriculum</h2>
            <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>Open a module to see lesson status, duration, and the next available action.</p>
          </div>
          <CourseModuleAccordion
            allowed={course.allowed}
            continueHref={continueHref}
            courseSlug={courseSlug}
            modules={course.modules}
          />
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-8 text-sm text-jpv-muted'>
          No lessons are currently published for this course.
        </section>
      )}
    </div>
  )
}
