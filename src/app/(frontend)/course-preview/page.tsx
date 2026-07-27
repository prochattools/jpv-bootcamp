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
    <div className='min-h-screen bg-jpv-surface text-jpv-ink'>
      <div className='border-b border-jpv-border bg-jpv-brand-deep px-5 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-jpv-sunshine'>
        {PAYLOAD_COURSE_PROTOTYPE_BANNER}
      </div>

      <header className='border-b border-jpv-border bg-jpv-canvas/90 backdrop-blur'>
        <div className='mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10'>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-full bg-jpv-brand-deep text-sm font-bold tracking-wide text-jpv-sunshine'>
              JPV
            </div>
            <div>
              <p className='text-lg font-bold tracking-tight text-jpv-brand-deep'>JPV Bootcamp</p>
              <p className='text-xs font-medium uppercase tracking-[0.16em] text-jpv-sunshine-ink'>Learning Portal</p>
            </div>
          </div>

          <nav className='hidden items-center gap-8 text-sm font-semibold text-jpv-brand-deep md:flex'>
            <a className='text-jpv-brand-deep' href='#courses'>My courses</a>
            <a href='#curriculum'>Curriculum</a>
            <a href='#resources'>Resources</a>
          </nav>

          <div className='flex items-center gap-3'>
            <div className='hidden text-right sm:block'>
              <p className='text-sm font-semibold'>Demo Member</p>
              <p className='text-xs text-jpv-muted'>Pro access preview</p>
            </div>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-jpv-sunshine text-sm font-bold text-jpv-brand-deep'>DM</div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-jpv-panel bg-jpv-brand-deep text-jpv-canvas shadow-jpv-card'>
          <div className='grid lg:grid-cols-[1.3fr_0.7fr]'>
            <div className='p-8 sm:p-10 lg:p-14'>
              <span className='inline-flex rounded-full border border-jpv-sunshine/30 bg-jpv-canvas/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine'>
                Continue learning
              </span>
              <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                Build with clarity. Learn at your own pace.
              </h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
                A focused course experience for JPV members, with simple modules, clear progress and practical next steps.
              </p>
              <div className='mt-9 flex flex-wrap gap-4'>
                <button className='jpv-button-primary min-h-11'>
                  Continue JPV Foundations
                </button>
                <button className='jpv-button-secondary min-h-11'>
                  View curriculum
                </button>
              </div>
            </div>

            <div className='border-t border-jpv-canvas/10 bg-jpv-brand-hover p-8 lg:border-l lg:border-t-0 lg:p-10'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine'>Your current path</p>
              <div className='mt-6 space-y-4'>
                {modulePreview.map((module) => (
                  <div key={module.label} className={`rounded-2xl border p-4 ${module.active ? 'border-jpv-sunshine bg-jpv-canvas/8' : 'border-jpv-canvas/10 bg-jpv-canvas/[0.03]'}`}>
                    <div className='flex items-center justify-between gap-4'>
                      <div>
                        <p className='text-xs uppercase tracking-[0.14em] text-jpv-inverse-muted'>{module.label}</p>
                        <p className='mt-1 font-semibold'>{module.title}</p>
                      </div>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${module.complete ? 'bg-jpv-sunshine text-jpv-brand-deep' : module.active ? 'border border-jpv-sunshine text-jpv-sunshine' : 'border border-jpv-canvas/15 text-jpv-canvas/45'}`}>
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
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Course library</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep'>My courses</h2>
              <p className='mt-2 text-jpv-muted'>A visual preview of how available and restricted courses could appear.</p>
            </div>
            <div className='rounded-full border border-jpv-border bg-jpv-canvas px-4 py-2 text-sm font-semibold text-jpv-muted'>
              3 courses shown
            </div>
          </div>

          <div className='mt-8 grid gap-6 lg:grid-cols-3'>
            {courses.map((course) => (
              <article key={course.title} className={`group overflow-hidden rounded-jpv-panel border bg-jpv-canvas shadow-jpv-card transition-transform duration-200 hover:-translate-y-1 ${course.featured ? 'border-jpv-sunshine' : 'border-jpv-border'}`}>
                <div className={`relative h-44 overflow-hidden ${course.locked ? 'bg-jpv-muted' : course.featured ? 'bg-jpv-brand-hover' : 'bg-jpv-sunshine'}`}>
                  <div className='absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%),radial-gradient(circle_at_80%_70%,white_0,transparent_28%)]' />
                  <div className='absolute left-5 top-5 rounded-full bg-jpv-canvas/90 px-3 py-1 text-xs font-extrabold tracking-[0.16em] text-jpv-brand-deep'>
                    {course.badge}
                  </div>
                  {course.locked && (
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <div className='rounded-full border border-jpv-canvas/30 bg-jpv-ink/20 px-4 py-2 text-sm font-semibold text-jpv-canvas backdrop-blur'>Locked preview</div>
                    </div>
                  )}
                </div>

                <div className='p-6'>
                  <div className='flex items-start justify-between gap-4'>
                    <h3 className='text-xl font-bold tracking-tight text-jpv-brand-deep'>{course.title}</h3>
                    {course.featured && <span className='text-lg text-jpv-sunshine-ink'>★</span>}
                  </div>
                  <p className='mt-3 min-h-[72px] text-sm leading-6 text-jpv-muted'>{course.description}</p>

                  <div className='mt-5 flex items-center gap-4 text-xs font-semibold text-jpv-muted'>
                    <span>{course.lessons} lessons</span>
                    <span className='h-1 w-1 rounded-full bg-jpv-border' />
                    <span>{course.duration}</span>
                  </div>

                  <div className='mt-6'>
                    <div className='flex items-center justify-between text-xs font-semibold'>
                      <span className='text-jpv-muted'>Progress</span>
                      <span className='text-jpv-brand-deep'>{course.progress}%</span>
                    </div>
                    <div className='mt-2 h-2 overflow-hidden rounded-full bg-jpv-surface-strong'>
                      <div className='h-full rounded-full bg-jpv-sunshine-ink' style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>

                  <button className={`mt-6 min-h-11 w-full justify-center ${course.locked ? 'jpv-button-secondary opacity-60' : 'jpv-button-primary'}`}>
                    {course.state}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id='curriculum' className='mt-14 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]'>
          <div className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-7 shadow-jpv-card sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Next lesson</p>
            <div className='mt-5 flex flex-col justify-between gap-6 sm:flex-row sm:items-center'>
              <div>
                <p className='text-sm font-semibold text-jpv-muted'>Module 2 · Lesson 1</p>
                <h3 className='mt-2 text-2xl font-bold text-jpv-brand-deep'>Understand Your Audience</h3>
                <p className='mt-2 max-w-xl text-sm leading-6 text-jpv-muted'>Clarify who you serve, what they need and how your experience creates value.</p>
              </div>
              <button className='jpv-button-primary min-h-11 shrink-0'>Open lesson</button>
            </div>
          </div>

          <div id='resources' className='rounded-jpv-panel bg-jpv-sunshine p-7 text-jpv-brand-deep sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em]'>Resources</p>
            <h3 className='mt-3 text-2xl font-bold'>Your course toolkit</h3>
            <p className='mt-3 text-sm leading-6 text-jpv-muted'>Worksheets, practical templates and lesson downloads will live together in one clear place.</p>
            <button className='jpv-button-secondary mt-6 min-h-11'>View example resources</button>
          </div>
        </section>
      </main>

      <footer className='mt-16 border-t border-jpv-border bg-jpv-canvas px-6 py-8'>
        <div className='mx-auto flex max-w-6xl flex-col justify-between gap-3 text-sm text-jpv-muted sm:flex-row'>
          <p className='font-semibold text-jpv-brand-deep'>JPV Bootcamp Course Prototype</p>
          <p>Static demonstration — no live account, course or payment data</p>
        </div>
      </footer>
    </div>
  )
}
