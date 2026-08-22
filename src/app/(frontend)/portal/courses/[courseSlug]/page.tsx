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
    <div className='space-y-8'>
      <Link
        className='inline-flex text-sm font-semibold text-jpv-inverse-muted underline-offset-4 hover:text-jpv-ink hover:underline'
        href='/portal/courses'
      >
        ← Back to courses
      </Link>

      <MemberFeaturedImage asset={course.coverImage} />

      <section className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-8 shadow-sm'>
        <div className='flex flex-col gap-6 md:flex-row md:items-start md:justify-between'>
          <div className='max-w-3xl'>
            <p className='jpv-eyebrow'>Course</p>
            <h1 className='mt-3 text-3xl font-semibold tracking-tight text-jpv-ink'>{course.title}</h1>
            {course.shortDescription ? (
              <p className='mt-4 text-sm leading-6 text-jpv-muted'>{course.shortDescription}</p>
            ) : null}
          </div>

          <div className='flex flex-wrap gap-2 text-xs font-semibold'>
            {course.estimatedDuration ? (
              <span className='rounded-full bg-jpv-surface-strong px-3 py-1 text-jpv-muted'>{course.estimatedDuration}</span>
            ) : null}
            {course.completedLessonCount !== null && course.lessonCount !== null ? (
              <span className='rounded-full bg-jpv-surface-strong px-3 py-1 text-jpv-muted'>
                {course.completedLessonCount}/{course.lessonCount} lessons complete
              </span>
            ) : null}
            {course.progressPercent !== null ? (
              <span className='rounded-full bg-jpv-brand-deep px-3 py-1 text-jpv-canvas'>{course.progressPercent}% complete</span>
            ) : null}
          </div>
        </div>
      </section>

      {!course.allowed ? (
        <section className='jpv-notice jpv-notice-danger rounded-jpv-panel p-6'>
          <h2 className='font-semibold'>This course is currently locked</h2>
          <p className='mt-2 text-sm'>
            {course.lockReason ?? 'Your account does not currently have access to this course.'}
          </p>
        </section>
      ) : course.modules.length > 0 ? (
        <div className='lg:grid lg:grid-cols-[1fr_280px] lg:gap-8'>
          <section>
            <CourseModuleAccordion
              allowed={course.allowed}
              courseSlug={courseSlug}
              modules={course.modules}
            />
          </section>

          <aside className='mt-8 lg:mt-0'>
            <div className='sticky top-24 space-y-5'>
              <div className='rounded-jpv-panel border border-jpv-border bg-jpv-surface p-5'>
                <p className='text-[0.6875rem] font-extrabold uppercase tracking-wider text-jpv-muted'>Progress</p>
                <p className='mt-3 text-3xl font-bold text-jpv-ink'>
                  {course.progressPercent ?? 0}%
                </p>
                <div className='mt-3 h-2 overflow-hidden rounded-full bg-jpv-border'>
                  <div
                    className='h-2 rounded-full bg-jpv-brand transition-all'
                    style={{ width: `${course.progressPercent ?? 0}%` }}
                  />
                </div>
                <p className='mt-3 text-sm text-jpv-muted'>
                  {course.completedLessonCount ?? 0}/{course.lessonCount ?? 0} lessons
                </p>
                {continueHref ? (
                  <Link className='jpv-button-primary mt-5 inline-flex w-full justify-center' href={continueHref}>
                    Continue
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-8 text-sm text-jpv-muted'>
          No lessons are currently published for this course.
        </section>
      )}
    </div>
  )
}
