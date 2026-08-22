import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'

export default async function PortalCoursesPage() {
  const { memberId, payload } = await requirePortalMember('/portal/courses')
  const dashboard = await getMemberCourseDashboard(payload, memberId)

  return (
    <div className='space-y-8'>
      <section>
        <p className='jpv-eyebrow'>Learning</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-jpv-ink'>Courses</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted'>
          Review your available courses, progress, and access status.
        </p>
      </section>

      {dashboard.courses.length > 0 ? (
        <div className='grid gap-5 md:grid-cols-2'>
          {dashboard.courses.map((course) => (
            <article className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-sm' key={course.id}>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <h2 className='text-xl font-semibold text-jpv-ink'>{course.title}</h2>
                  {course.shortDescription ? (
                    <p className='mt-2 text-sm leading-6 text-jpv-muted'>{course.shortDescription}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    course.allowed
                      ? 'bg-jpv-brand/10 text-jpv-brand-deep'
                      : 'bg-jpv-surface-strong text-jpv-muted'
                  }`}
                >
                  {course.allowed ? course.accessBadge ?? 'Available' : 'Locked'}
                </span>
              </div>

              <dl className='mt-5 grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <dt className='text-jpv-muted'>Lessons</dt>
                  <dd className='mt-1 font-semibold text-jpv-ink'>{course.lessonCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className='text-jpv-muted'>Progress</dt>
                  <dd className='mt-1 font-semibold text-jpv-ink'>
                    {course.progressPercent !== null ? `${course.progressPercent}%` : '—'}
                  </dd>
                </div>
              </dl>

              {course.allowed && course.slug ? (
                <Link
                  className='jpv-button-primary mt-6 inline-flex'
                  href={`/portal/courses/${course.slug}`}
                >
                  Open course
                </Link>
              ) : (
                <p className='mt-6 text-sm text-jpv-muted'>
                  {course.lockReason ?? 'This course is not currently available to this account.'}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-8 text-sm text-jpv-muted'>
          No published courses are currently available.
        </div>
      )}
    </div>
  )
}
