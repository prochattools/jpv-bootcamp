import Link from 'next/link'

import { AdminGate } from '@/components/portal/AdminGate'
import { CreateCourseButton } from '@/components/portal/admin/CreateCourseButton'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getAdminCourseDashboard } from '@/lib/portalAdmin/adminPortal'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'

export default async function PortalCoursesPage() {
  const { actor, payload } = await requirePortalAccess('/portal/courses')

  if (actor.kind === 'admin') {
    const courses = await getAdminCourseDashboard(payload)

    return (
      <div className='mx-auto max-w-5xl space-y-6'>
        <section>
          <p className='jpv-eyebrow'>Administration</p>
          <h1 className='mt-3 text-2xl font-semibold tracking-tight text-jpv-ink'>All Courses</h1>
          <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
            Viewing all courses including draft and archived. Members only see published courses.
          </p>
        </section>

        <AdminGate>
          <div className='flex items-center gap-3'>
            <CreateCourseButton />
          </div>
        </AdminGate>

        {courses.length === 0 ? (
          <div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-10 text-center'>
            <p className='text-base font-medium text-jpv-ink'>No courses exist</p>
            <p className='mt-2 text-sm text-jpv-muted'>Create a course to get started.</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {courses.map((course) => (
              <article
                className='flex flex-col overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-canvas shadow-sm'
                key={course.id}
              >
                {course.coverImage ? (
                  <div className='aspect-video w-full overflow-hidden bg-jpv-surface'>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={course.coverImage.alt}
                      className='h-full w-full object-cover'
                      height={course.coverImage.height ?? undefined}
                      loading='lazy'
                      src={course.coverImage.url}
                      width={course.coverImage.width ?? undefined}
                    />
                  </div>
                ) : (
                  <div className='aspect-video w-full bg-jpv-surface' />
                )}

                <div className='flex flex-1 flex-col gap-4 p-5'>
                  <div className='flex-1 space-y-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <h3 className='text-base font-semibold text-jpv-ink'>{course.title}</h3>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        course.status === 'published' ? 'bg-jpv-brand/10 text-jpv-brand-deep'
                          : course.status === 'archived' ? 'bg-red-100 text-red-700'
                          : 'bg-jpv-sunshine/20 text-jpv-sunshine-ink'
                      }`}>
                        {course.status}
                      </span>
                    </div>

                    <dl className='flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                      <div>
                        <dt className='inline text-jpv-muted'>Lessons: </dt>
                        <dd className='inline font-semibold text-jpv-ink'>{course.lessonCount}</dd>
                      </div>
                      <div>
                        <dt className='inline text-jpv-muted'>Modules: </dt>
                        <dd className='inline font-semibold text-jpv-ink'>{course.modules.length}</dd>
                      </div>
                      <div>
                        <dt className='inline text-jpv-muted'>Visibility: </dt>
                        <dd className='inline font-semibold text-jpv-ink'>{course.visibility}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className='mt-auto'>
                    {course.slug ? (
                      <Link className='jpv-button-primary inline-flex text-sm' href={`/portal/courses/${course.slug}`}>
                        View course
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  const memberId = actor.memberId
  const dashboard = await getMemberCourseDashboard(payload, memberId)

  // Identify the course the member should continue (first allowed course with an incomplete lesson)
  const continueLesson = dashboard.continueLesson
  const featuredCourse = continueLesson
    ? dashboard.courses.find((c) => c.slug === continueLesson.courseSlug) ?? null
    : null
  const continueUrl =
    featuredCourse?.slug && continueLesson?.lessonSlug
      ? `/portal/courses/${featuredCourse.slug}/lessons/${continueLesson.lessonSlug}`
      : featuredCourse?.slug
        ? `/portal/courses/${featuredCourse.slug}`
        : null

  return (
    <div className='mx-auto max-w-5xl space-y-6'>
      {/* Page header */}
      <section>
        <p className='jpv-eyebrow'>Learning</p>
        <h1 className='mt-3 text-2xl font-semibold tracking-tight text-jpv-ink'>Your Courses</h1>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>
          Track your progress and pick up where you left off.
        </p>
      </section>

      {dashboard.courses.length === 0 ? (
        /* Empty state */
        <div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-10 text-center'>
          <p className='text-base font-medium text-jpv-ink'>No courses yet</p>
          <p className='mt-2 text-sm text-jpv-muted'>
            You are not currently enrolled in any courses.
          </p>
          <Link className='jpv-button-primary mt-6 inline-flex' href='/portal'>
            Browse available courses
          </Link>
        </div>
      ) : (
        <div className='space-y-6'>
          {/* Featured in-progress course */}
          {featuredCourse && continueUrl ? (
            <section>
              <h2 className='mb-4 text-xs font-semibold uppercase tracking-widest text-jpv-muted'>
                Continue learning
              </h2>
              <div className='overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-canvas shadow-sm'>
                <div className='flex flex-col md:flex-row'>
                  {/* Cover image — left column on desktop */}
                  {featuredCourse.coverImage ? (
                    <div className='aspect-video w-full flex-shrink-0 overflow-hidden bg-jpv-surface md:aspect-auto md:w-72'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={featuredCourse.coverImage.alt}
                        className='h-full w-full object-cover'
                        height={featuredCourse.coverImage.height ?? undefined}
                        loading='eager'
                        src={featuredCourse.coverImage.url}
                        width={featuredCourse.coverImage.width ?? undefined}
                      />
                    </div>
                  ) : (
                    <div className='aspect-video w-full flex-shrink-0 bg-jpv-surface md:aspect-auto md:w-72' />
                  )}

                  {/* Info — right column on desktop */}
                  <div className='flex flex-1 flex-col justify-between gap-6 p-6'>
                    <div className='space-y-4'>
                      <h3 className='text-xl font-semibold text-jpv-ink'>{featuredCourse.title}</h3>
                      {featuredCourse.shortDescription ? (
                        <p className='text-sm leading-6 text-jpv-muted'>
                          {featuredCourse.shortDescription}
                        </p>
                      ) : null}

                      <dl className='flex flex-wrap gap-x-6 gap-y-1 text-sm'>
                        {featuredCourse.lessonCount !== null ? (
                          <div>
                            <dt className='inline text-jpv-muted'>Lessons: </dt>
                            <dd className='inline font-semibold text-jpv-ink'>
                              {featuredCourse.lessonCount}
                            </dd>
                          </div>
                        ) : null}
                        {featuredCourse.progressPercent !== null ? (
                          <div>
                            <dt className='inline text-jpv-muted'>Progress: </dt>
                            <dd className='inline font-semibold text-jpv-ink'>
                              {featuredCourse.progressPercent}%
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {/* Progress bar */}
                      {featuredCourse.progressPercent !== null ? (
                        <div
                          aria-label={`${featuredCourse.progressPercent}% complete`}
                          aria-valuenow={featuredCourse.progressPercent}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          role='progressbar'
                          className='h-2 w-full overflow-hidden rounded-full bg-jpv-surface-strong'
                        >
                          <div
                            className='h-2 rounded-full bg-jpv-brand'
                            style={{ width: `${featuredCourse.progressPercent}%` }}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <Link className='jpv-button-primary inline-flex' href={continueUrl}>
                        Continue
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* All courses grid */}
          <section>
            <h2 className='mb-4 text-xs font-semibold uppercase tracking-widest text-jpv-muted'>
              All courses
            </h2>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {dashboard.courses.map((course) => (
                <article
                  className='flex flex-col overflow-hidden rounded-jpv-panel border border-jpv-border bg-jpv-canvas shadow-sm'
                  key={course.id}
                >
                  {/* Cover image */}
                  {course.coverImage ? (
                    <div className='aspect-video w-full overflow-hidden bg-jpv-surface'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={course.coverImage.alt}
                        className='h-full w-full object-cover'
                        height={course.coverImage.height ?? undefined}
                        loading='lazy'
                        src={course.coverImage.url}
                        width={course.coverImage.width ?? undefined}
                      />
                    </div>
                  ) : (
                    <div className='aspect-video w-full bg-jpv-surface' />
                  )}

                  <div className='flex flex-1 flex-col gap-4 p-5'>
                    <div className='flex-1 space-y-3'>
                      {/* Title + access badge */}
                      <div className='flex items-start justify-between gap-2'>
                        <h3 className='text-base font-semibold text-jpv-ink'>{course.title}</h3>
                        <span
                          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            course.allowed
                              ? 'bg-jpv-brand/10 text-jpv-brand-deep'
                              : 'bg-jpv-surface-strong text-jpv-muted'
                          }`}
                        >
                          {course.allowed ? (course.accessBadge ?? 'Available') : 'Locked'}
                        </span>
                      </div>

                      {/* Lesson count + progress percentage */}
                      <dl className='flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                        {course.lessonCount !== null ? (
                          <div>
                            <dt className='inline text-jpv-muted'>Lessons: </dt>
                            <dd className='inline font-semibold text-jpv-ink'>
                              {course.lessonCount}
                            </dd>
                          </div>
                        ) : null}
                        {course.progressPercent !== null ? (
                          <div>
                            <dt className='inline text-jpv-muted'>Progress: </dt>
                            <dd className='inline font-semibold text-jpv-ink'>
                              {course.progressPercent}%
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {/* Progress bar */}
                      {course.progressPercent !== null ? (
                        <div
                          aria-label={`${course.progressPercent}% complete`}
                          aria-valuenow={course.progressPercent}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          role='progressbar'
                          className='h-2 w-full overflow-hidden rounded-full bg-jpv-surface-strong'
                        >
                          <div
                            className='h-2 rounded-full bg-jpv-brand'
                            style={{ width: `${course.progressPercent}%` }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* CTA */}
                    <div className='mt-auto'>
                      {course.allowed && course.slug ? (
                        <Link
                          className='jpv-button-primary inline-flex text-sm'
                          href={`/portal/courses/${course.slug}`}
                        >
                          View course
                        </Link>
                      ) : (
                        <p className='text-xs text-jpv-muted'>
                          {course.lockReason ?? 'This course is not currently available.'}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
