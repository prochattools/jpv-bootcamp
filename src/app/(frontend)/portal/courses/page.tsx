import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'

export default async function PortalCoursesPage() {
  const { memberId, payload } = await requirePortalMember('/portal/courses')
  const dashboard = await getMemberCourseDashboard(payload, memberId)

  return (
    <div className='space-y-8'>
      <section>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Learning</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Courses</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
          Review your available courses, progress, and access status.
        </p>
      </section>

      {dashboard.courses.length > 0 ? (
        <div className='grid gap-5 md:grid-cols-2'>
          {dashboard.courses.map((course) => (
            <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={course.id}>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <h2 className='text-xl font-semibold'>{course.title}</h2>
                  {course.shortDescription ? (
                    <p className='mt-2 text-sm leading-6 text-neutral-600'>{course.shortDescription}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    course.allowed
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {course.allowed ? course.accessBadge ?? 'Available' : 'Locked'}
                </span>
              </div>

              <dl className='mt-5 grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <dt className='text-neutral-500'>Lessons</dt>
                  <dd className='mt-1 font-semibold text-neutral-950'>{course.lessonCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className='text-neutral-500'>Progress</dt>
                  <dd className='mt-1 font-semibold text-neutral-950'>
                    {course.progressPercent !== null ? `${course.progressPercent}%` : '—'}
                  </dd>
                </div>
              </dl>

              {course.allowed && course.slug ? (
                <Link
                  className='mt-6 inline-flex rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white'
                  href={`/portal/courses/${course.slug}`}
                >
                  Open course
                </Link>
              ) : (
                <p className='mt-6 text-sm text-neutral-500'>
                  {course.lockReason ?? 'This course is not currently available to this account.'}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600'>
          No published courses are currently available.
        </div>
      )}
    </div>
  )
}
