import { redirect } from 'next/navigation'

import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'

import { PortalShell, StatusPill } from './PortalShell'

export const metadata = {
  title: 'My Courses | JPV Bootcamp',
  description: 'Payload-backed JPV Bootcamp member dashboard.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function memberStatusTone(status: unknown): 'good' | 'warn' | 'neutral' {
  return status === 'active' ? 'good' : status ? 'warn' : 'neutral'
}

export default async function LearnDashboardPage() {
  const { member, payload } = await getCurrentPayloadMember()
  if (!member) {
    redirect('/learn/login?next=/learn')
  }

  const dashboard = await getMemberCourseDashboard(payload, member.id)
  const email = typeof member.email === 'string' ? member.email : null
  const accountStatus = typeof member.accountStatus === 'string' ? member.accountStatus : 'pending'
  const unlockedCount = dashboard.courses.filter((course) => course.allowed).length

  return (
    <PortalShell memberEmail={email}>
      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-[28px] bg-[#153f2e] text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)]'>
          <div className='grid lg:grid-cols-[1.25fr_0.75fr]'>
            <div className='p-8 sm:p-10 lg:p-14'>
              <span className='inline-flex rounded-full border border-[#e2d5aa]/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e6d9b1]'>
                Member dashboard
              </span>
              <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                Your courses and access are now evaluated through Payload.
              </h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
                This page reads your `payload_members` account, evaluates each published course server-side, and only loads lesson outlines for courses you can access.
              </p>
              <div className='mt-8 flex flex-wrap gap-3'>
                <StatusPill tone={memberStatusTone(accountStatus)}>Account {accountStatus}</StatusPill>
                <StatusPill tone='neutral'>{unlockedCount} unlocked</StatusPill>
                <StatusPill tone='neutral'>{dashboard.courses.length} published courses</StatusPill>
              </div>
            </div>

            <aside className='border-t border-white/10 bg-[#0f3425] p-8 lg:border-l lg:border-t-0 lg:p-10'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-[#d9c897]'>
                Continue learning
              </p>
              {dashboard.continueLesson ? (
                <div className='mt-6 rounded-2xl border border-[#d9c897] bg-white/8 p-5'>
                  <p className='text-xs uppercase tracking-[0.14em] text-[#aabdb3]'>
                    {dashboard.continueLesson.courseTitle}
                  </p>
                  <h2 className='mt-2 text-xl font-bold'>{dashboard.continueLesson.lessonTitle}</h2>
                  <p className='mt-3 text-sm text-[#d5e0da]'>
                    {dashboard.continueLesson.estimatedDuration ?? 'Lesson duration pending'}
                  </p>
                  <button
                    className='mt-5 rounded-full bg-[#d9c897] px-5 py-3 text-sm font-bold text-[#153f2e]'
                    disabled
                    type='button'
                  >
                    Lesson page coming next
                  </button>
                </div>
              ) : (
                <div className='mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5'>
                  <h2 className='text-xl font-bold'>No available next lesson</h2>
                  <p className='mt-3 text-sm leading-6 text-[#d5e0da]'>
                    Unlock a course or complete the migration import to populate a continue-learning state.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className='mt-14'>
          <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>
                Course library
              </p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>My courses</h2>
              <p className='mt-2 max-w-2xl text-[#64736c]'>
                Locked courses show a reason without rendering private module or lesson content.
              </p>
            </div>
          </div>

          <div className='mt-8 grid gap-6 lg:grid-cols-3'>
            {dashboard.courses.map((course) => (
              <article
                className={`overflow-hidden rounded-[24px] border bg-white shadow-[0_16px_45px_rgba(31,52,43,0.08)] ${
                  course.allowed ? 'border-[#b7a56f]' : 'border-[#153f2e]/10'
                }`}
                key={course.id}
              >
                <div className={`relative h-36 ${course.allowed ? 'bg-[#214e3a]' : 'bg-[#4d514d]'}`}>
                  <div className='absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%),radial-gradient(circle_at_80%_70%,white_0,transparent_28%)]' />
                  <div className='absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#153f2e]'>
                    {course.accessBadge ?? 'course'}
                  </div>
                  {!course.allowed && (
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <div className='rounded-full border border-white/30 bg-black/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur'>
                        Locked
                      </div>
                    </div>
                  )}
                </div>

                <div className='p-6'>
                  <h3 className='text-xl font-bold tracking-tight text-[#153f2e]'>{course.title}</h3>
                  <p className='mt-3 min-h-[72px] text-sm leading-6 text-[#68766f]'>
                    {course.shortDescription ?? 'Course description pending.'}
                  </p>

                  <div className='mt-5 flex items-center gap-4 text-xs font-semibold text-[#66766e]'>
                    <span>
                      {course.allowed && course.lessonCount !== null
                        ? `${course.lessonCount} lessons`
                        : 'Lesson outline hidden'}
                    </span>
                    <span className='h-1 w-1 rounded-full bg-[#9cab9f]' />
                    <span>{course.estimatedDuration ?? 'Duration pending'}</span>
                  </div>

                  {course.allowed ? (
                    <div className='mt-6'>
                      <div className='flex items-center justify-between text-xs font-semibold'>
                        <span className='text-[#53675d]'>Progress</span>
                        <span className='text-[#153f2e]'>{course.progressPercent ?? 0}%</span>
                      </div>
                      <div className='mt-2 h-2 overflow-hidden rounded-full bg-[#e9e7df]'>
                        <div
                          className='h-full rounded-full bg-[#9d864b]'
                          style={{ width: `${course.progressPercent ?? 0}%` }}
                        />
                      </div>
                      <button
                        className='mt-6 w-full rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white'
                        disabled
                        type='button'
                      >
                        Course overview coming next
                      </button>
                    </div>
                  ) : (
                    <div className='mt-6 rounded-2xl border border-[#153f2e]/10 bg-[#f4f1e9] p-4'>
                      <p className='text-sm font-semibold text-[#153f2e]'>Access blocked</p>
                      <p className='mt-2 text-sm leading-6 text-[#68766f]'>{course.lockReason}</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
