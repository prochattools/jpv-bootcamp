import { notFound } from 'next/navigation'

import {
  PAYLOAD_COURSE_PROTOTYPE_BANNER,
  PAYLOAD_COURSE_PROTOTYPE_ENABLED,
} from '@/lib/payloadCoursePrototype'

const courses = [
  {
    title: 'JPV Foundations',
    description: 'Build the foundations for a clear, focused and practical property journey.',
    badge: 'PRO',
    progress: 36,
    lessons: 9,
    duration: '3h 20m',
    state: 'Continue course',
    featured: true,
  },
  {
    title: 'Build Your Offer',
    description: 'Turn your experience into a clear offer with an outcome people understand.',
    badge: 'FREE',
    progress: 0,
    lessons: 6,
    duration: '1h 45m',
    state: 'Start course',
    featured: false,
  },
  {
    title: 'Mentorship Modules',
    description: 'Focused implementation sessions and support resources for approved Free or Pro access.',
    badge: 'SUPPORT',
    progress: 0,
    lessons: 8,
    duration: '4h 10m',
    state: 'Preview locked course',
    featured: false,
    locked: true,
  },
]

const modulePreview = [
  { label: 'Module 1', title: 'Start Here', complete: true },
  { label: 'Module 2', title: 'Build Your Offer', active: true },
  { label: 'Module 3', title: 'Put It Into Practice' },
]

export default function CoursePreviewPage() {
  if (!PAYLOAD_COURSE_PROTOTYPE_ENABLED) {
    notFound()
  }

  return (
    <div className='min-h-screen bg-[var(--jpv-surface)] text-[var(--jpv-ink)]'>
      <div className='border-b border-[var(--jpv-brand-deep)]/10 bg-[var(--jpv-brand-deep)] px-5 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jpv-sunshine)]'>
        {PAYLOAD_COURSE_PROTOTYPE_BANNER}
      </div>

      <header className='border-b border-[var(--jpv-brand-deep)]/10 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10'>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-full bg-[var(--jpv-brand-deep)] text-sm font-bold tracking-wide text-[var(--jpv-sunshine)]'>
              JPV
            </div>
            <div>
              <p className='text-lg font-bold tracking-tight text-[var(--jpv-brand-deep)]'>JPV Bootcamp</p>
              <p className='text-xs font-medium uppercase tracking-[0.16em] text-[var(--jpv-sunshine-ink)]'>Learning Portal</p>
            </div>
          </div>

          <nav className='hidden items-center gap-8 text-sm font-semibold text-[var(--jpv-brand-deep)] md:flex'>
            <a className='text-[var(--jpv-brand-deep)]' href='#courses'>My courses</a>
            <a href='#curriculum'>Curriculum</a>
            <a href='#resources'>Resources</a>
          </nav>

          <div className='flex items-center gap-3'>
            <div className='hidden text-right sm:block'>
              <p className='text-sm font-semibold'>Demo Member</p>
              <p className='text-xs text-[var(--jpv-muted)]'>Pro access preview</p>
            </div>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-[var(--jpv-sunshine)] text-sm font-bold text-[var(--jpv-brand-deep)]'>DM</div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-jpv-panel bg-[var(--jpv-brand-deep)] text-white shadow-jpv-card'>
          <div className='grid lg:grid-cols-[1.3fr_0.7fr]'>
            <div className='p-8 sm:p-10 lg:p-14'>
              <span className='inline-flex rounded-full border border-[var(--jpv-sunshine)]/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--jpv-sunshine)]'>
                Continue learning
              </span>
              <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                Build with clarity. Learn at your own pace.
              </h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-[var(--jpv-inverse-muted)] sm:text-lg'>
                A focused course experience for JPV members, with simple modules, clear progress and practical next steps.
              </p>
              <div className='mt-9 flex flex-wrap gap-4'>
                <button className='rounded-full bg-[var(--jpv-sunshine)] px-6 py-3 text-sm font-bold text-[var(--jpv-brand-deep)] shadow-sm'>
                  Continue JPV Foundations
                </button>
                <button className='rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white'>
                  View curriculum
                </button>
              </div>
            </div>

            <div className='border-t border-white/10 bg-[var(--jpv-brand-hover)] p-8 lg:border-l lg:border-t-0 lg:p-10'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-[var(--jpv-sunshine)]'>Your current path</p>
              <div className='mt-6 space-y-4'>
                {modulePreview.map((module) => (
                  <div key={module.label} className={`rounded-2xl border p-4 ${module.active ? 'border-[var(--jpv-sunshine)] bg-white/8' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className='flex items-center justify-between gap-4'>
                      <div>
                        <p className='text-xs uppercase tracking-[0.14em] text-[var(--jpv-inverse-muted)]'>{module.label}</p>
                        <p className='mt-1 font-semibold'>{module.title}</p>
                      </div>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${module.complete ? 'bg-[var(--jpv-sunshine)] text-[var(--jpv-brand-deep)]' : module.active ? 'border border-[var(--jpv-sunshine)] text-[var(--jpv-sunshine)]' : 'border border-white/15 text-white/45'}`}>
                        {module.complete ? '✓' : module.active ? '2' : '3'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id='courses' className='mt-14'>
          <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
            <div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[var(--jpv-sunshine-ink)]'>Course library</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-[var(--jpv-brand-deep)]'>My courses</h2>
              <p className='mt-2 text-[var(--jpv-muted)]'>A visual preview of how available and restricted courses could appear.</p>
            </div>
            <div className='rounded-full border border-[var(--jpv-brand-deep)]/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--jpv-muted)]'>
              3 courses shown
            </div>
          </div>

          <div className='mt-8 grid gap-6 lg:grid-cols-3'>
            {courses.map((course) => (
              <article key={course.title} className={`group overflow-hidden rounded-jpv-panel border bg-white shadow-jpv-card transition-transform duration-200 hover:-translate-y-1 ${course.featured ? 'border-[var(--jpv-sunshine)]' : 'border-[var(--jpv-brand-deep)]/10'}`}>
                <div className={`relative h-44 overflow-hidden ${course.locked ? 'bg-[var(--jpv-muted)]' : course.featured ? 'bg-[var(--jpv-brand-hover)]' : 'bg-[var(--jpv-sunshine)]'}`}>
                  <div className='absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%),radial-gradient(circle_at_80%_70%,white_0,transparent_28%)]' />
                  <div className='absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold tracking-[0.16em] text-[var(--jpv-brand-deep)]'>
                    {course.badge}
                  </div>
                  {course.locked && (
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <div className='rounded-full border border-white/30 bg-black/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur'>Locked preview</div>
                    </div>
                  )}
                </div>

                <div className='p-6'>
                  <div className='flex items-start justify-between gap-4'>
                    <h3 className='text-xl font-bold tracking-tight text-[var(--jpv-brand-deep)]'>{course.title}</h3>
                    {course.featured && <span className='text-lg text-[var(--jpv-sunshine-ink)]'>★</span>}
                  </div>
                  <p className='mt-3 min-h-[72px] text-sm leading-6 text-[var(--jpv-muted)]'>{course.description}</p>

                  <div className='mt-5 flex items-center gap-4 text-xs font-semibold text-[var(--jpv-muted)]'>
                    <span>{course.lessons} lessons</span>
                    <span className='h-1 w-1 rounded-full bg-[var(--jpv-border)]' />
                    <span>{course.duration}</span>
                  </div>

                  <div className='mt-6'>
                    <div className='flex items-center justify-between text-xs font-semibold'>
                      <span className='text-[var(--jpv-muted)]'>Progress</span>
                      <span className='text-[var(--jpv-brand-deep)]'>{course.progress}%</span>
                    </div>
                    <div className='mt-2 h-2 overflow-hidden rounded-full bg-[var(--jpv-surface-strong)]'>
                      <div className='h-full rounded-full bg-[var(--jpv-sunshine-ink)]' style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>

                  <button className={`mt-6 w-full rounded-full px-5 py-3 text-sm font-bold ${course.locked ? 'border border-[var(--jpv-brand-deep)]/15 bg-[var(--jpv-surface)] text-[var(--jpv-muted)]' : 'bg-[var(--jpv-brand-deep)] text-white'}`}>
                    {course.state}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id='curriculum' className='mt-14 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]'>
          <div className='rounded-jpv-panel border border-[var(--jpv-brand-deep)]/10 bg-white p-7 shadow-jpv-card sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[var(--jpv-sunshine-ink)]'>Next lesson</p>
            <div className='mt-5 flex flex-col justify-between gap-6 sm:flex-row sm:items-center'>
              <div>
                <p className='text-sm font-semibold text-[var(--jpv-muted)]'>Module 2 · Lesson 1</p>
                <h3 className='mt-2 text-2xl font-bold text-[var(--jpv-brand-deep)]'>Understand Your Audience</h3>
                <p className='mt-2 max-w-xl text-sm leading-6 text-[var(--jpv-muted)]'>Clarify who you serve, what they need and how your experience creates value.</p>
              </div>
              <button className='shrink-0 rounded-full bg-[var(--jpv-sunshine)] px-6 py-3 text-sm font-bold text-[var(--jpv-brand-deep)]'>Open lesson</button>
            </div>
          </div>

          <div id='resources' className='rounded-jpv-panel bg-[var(--jpv-sunshine)] p-7 text-[var(--jpv-brand-deep)] sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em]'>Resources</p>
            <h3 className='mt-3 text-2xl font-bold'>Your course toolkit</h3>
            <p className='mt-3 text-sm leading-6 text-[var(--jpv-muted)]'>Worksheets, practical templates and lesson downloads will live together in one clear place.</p>
            <button className='mt-6 rounded-full border border-[var(--jpv-brand-deep)]/20 bg-white/40 px-5 py-3 text-sm font-bold'>View example resources</button>
          </div>
        </section>
      </main>

      <footer className='mt-16 border-t border-[var(--jpv-brand-deep)]/10 bg-white px-6 py-8'>
        <div className='mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm text-[var(--jpv-muted)] sm:flex-row'>
          <p className='font-semibold text-[var(--jpv-brand-deep)]'>JPV Bootcamp Course Prototype</p>
          <p>Static demonstration — no live account, course or payment data</p>
        </div>
      </footer>
    </div>
  )
}
