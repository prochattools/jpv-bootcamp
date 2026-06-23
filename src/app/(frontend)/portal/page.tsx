import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'

export default async function PortalDashboardPage() {
  const { memberId, payload } = await requirePortalMember('/portal')
  const dashboard = await getMemberCourseDashboard(payload, memberId)
  const availableCourses = dashboard.courses.filter((course) => course.allowed)

  return (
    <div className='space-y-10'>
      <section>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>JPV Bootcamp</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Welcome back</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
          Continue your learning, review your available courses, and manage your member account.
        </p>
      </section>

      {dashboard.continueLesson ? (
        <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500'>Continue learning</p>
          <h2 className='mt-3 text-xl font-semibold'>{dashboard.continueLesson.lessonTitle}</h2>
          <p className='mt-2 text-sm text-neutral-600'>{dashboard.continueLesson.courseTitle}</p>
          {dashboard.continueLesson.courseSlug && dashboard.continueLesson.lessonSlug ? (
            <Link
              className='mt-5 inline-flex rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white'
              href={`/portal/courses/${dashboard.continueLesson.courseSlug}/lessons/${dashboard.continueLesson.lessonSlug}`}
            >
              Continue lesson
            </Link>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-semibold'>Your courses</h2>
            <p className='mt-2 text-sm text-neutral-600'>Courses currently available to this member account.</p>
          </div>
          <Link className='text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline' href='/portal/courses'>
            View all
          </Link>
        </div>

        {availableCourses.length > 0 ? (
          <div className='mt-6 grid gap-5 md:grid-cols-2'>
            {availableCourses.slice(0, 4).map((course) => (
              <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={course.id}>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h3 className='text-lg font-semibold'>{course.title}</h3>
                    {course.shortDescription ? (
                      <p className='mt-2 text-sm leading-6 text-neutral-600'>{course.shortDescription}</p>
                    ) : null}
                  </div>
                  {course.progressPercent !== null ? (
                    <span className='rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700'>
                      {course.progressPercent}%
                    </span>
                  ) : null}
                </div>

                {course.slug ? (
                  <Link
                    className='mt-5 inline-flex text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline'
                    href={`/portal/courses/${course.slug}`}
                  >
                    Open course
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className='mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600'>
            No courses are currently available for this account.
          </div>
        )}
      </section>
    </div>
  )
}
