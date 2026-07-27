import Link from 'next/link'
import { notFound } from 'next/navigation'

import { jpvBrand } from '@/lib/brand/jpvDesignSystem'

import {
  PAYLOAD_COURSE_PROTOTYPE_BANNER,
  PAYLOAD_COURSE_PROTOTYPE_ENABLED,
} from '@/lib/payloadCoursePrototype'

const modules = [
  {
    title: 'Start Here',
    description: 'Understand the learning path and set a clear objective.',
    lessons: [
      { title: 'Welcome to JPV', duration: '8 min', state: 'completed' },
      { title: 'Define Your Goal', duration: '14 min', state: 'completed' },
      { title: 'How to Use the Programme', duration: '11 min', state: 'current' },
    ],
  },
  {
    title: 'Build Your Offer',
    description: 'Turn your experience into a clear and valuable outcome.',
    lessons: [
      { title: 'Understand Your Audience', duration: '18 min', state: 'available' },
      { title: 'Define the Outcome', duration: '16 min', state: 'available' },
      { title: 'Shape the Offer', duration: '22 min', state: 'locked' },
    ],
  },
  {
    title: 'Put It Into Practice',
    description: 'Validate the idea and create a simple action plan.',
    lessons: [
      { title: 'Validate the Offer', duration: '20 min', state: 'locked' },
      { title: 'Create the Action Plan', duration: '24 min', state: 'locked' },
      { title: 'Next Steps', duration: '10 min', state: 'locked' },
    ],
  },
]

const stateStyles: Record<string, string> = {
  completed: 'bg-jpv-sunshine text-jpv-brand-deep',
  current: 'border border-jpv-sunshine bg-jpv-canvas text-jpv-brand-deep',
  available: 'border border-jpv-border bg-jpv-canvas text-jpv-muted',
  locked: 'border border-jpv-border bg-jpv-surface text-jpv-muted',
}

const stateLabel: Record<string, string> = {
  completed: 'Completed',
  current: 'Continue',
  available: 'Available',
  locked: 'Locked',
}

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>
}) {
  if (!PAYLOAD_COURSE_PROTOTYPE_ENABLED) {
    notFound()
  }

  const { courseSlug } = await params

  return (
    <div className='min-h-screen bg-jpv-surface text-jpv-ink'>
      <div className='border-b border-jpv-border bg-jpv-brand-deep px-5 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-jpv-sunshine'>
        {PAYLOAD_COURSE_PROTOTYPE_BANNER}
      </div>

      <header className='border-b border-jpv-border bg-jpv-canvas/90 backdrop-blur'>
        <div className='mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10'>
          <Link href='/course-preview' className='flex items-center gap-3 text-inherit no-underline'>
            <img
              src={jpvBrand.logoPath}
              alt={jpvBrand.logoAlt}
              className='h-11 w-11 rounded-xl object-cover'
            />
            <div>
              <p className='text-lg font-bold tracking-tight text-jpv-brand-deep'>JPV Bootcamp</p>
              <p className='text-xs font-medium uppercase tracking-[0.16em] text-jpv-sunshine-ink'>Learning Portal</p>
            </div>
          </Link>
          <Link href='/course-preview' className='inline-flex min-h-11 items-center rounded-full border border-jpv-border px-4 py-2 text-sm font-bold text-jpv-brand-deep no-underline'>
            Back to courses
          </Link>
        </div>
      </header>

      <main className='mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-jpv-panel bg-jpv-brand-deep text-jpv-canvas shadow-jpv-card'>
          <div className='grid lg:grid-cols-[1.25fr_0.75fr]'>
            <div className='p-8 sm:p-10 lg:p-14'>
              <div className='flex flex-wrap items-center gap-3'>
                <span className='rounded-full bg-jpv-sunshine px-3 py-1 text-xs font-extrabold tracking-[0.15em] text-jpv-brand-deep'>PRO</span>
                <span className='rounded-full border border-jpv-canvas/20 px-3 py-1 text-xs font-semibold text-jpv-inverse-muted'>9 lessons</span>
                <span className='rounded-full border border-jpv-canvas/20 px-3 py-1 text-xs font-semibold text-jpv-inverse-muted'>3h 20m</span>
              </div>
              <p className='mt-8 text-sm font-bold uppercase tracking-[0.2em] text-jpv-sunshine'>Course overview</p>
              <h1 className='mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>JPV Foundations</h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-jpv-inverse-muted sm:text-lg'>
                A practical learning path designed to help members build clarity, shape a valuable offer and move forward with a focused action plan.
              </p>
              <div className='mt-9 flex flex-wrap gap-4'>
                <Link href={`/course-preview/${courseSlug}/how-to-use-the-programme`} className='rounded-full bg-jpv-sunshine px-6 py-3 text-sm font-bold text-jpv-brand-deep no-underline'>
                  Continue course
                </Link>
                <button className='jpv-button-secondary min-h-11'>Download course guide</button>
              </div>
            </div>

            <div className='border-t border-jpv-canvas/10 bg-jpv-brand-hover p-8 lg:border-l lg:border-t-0 lg:p-10'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine'>Your progress</p>
              <div className='mt-6 flex items-end justify-between'>
                <div>
                  <p className='text-5xl font-bold'>36%</p>
                  <p className='mt-2 text-sm text-jpv-inverse-muted'>3 of 9 lessons viewed</p>
                </div>
                <div className='flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-jpv-sunshine text-sm font-bold'>3 / 9</div>
              </div>
              <div className='mt-8 h-2 overflow-hidden rounded-full bg-jpv-canvas/10'>
                <div className='h-full w-[36%] rounded-full bg-jpv-sunshine' />
              </div>
              <div className='mt-8 rounded-2xl border border-jpv-canvas/10 bg-jpv-canvas/[0.04] p-5'>
                <p className='text-xs font-semibold uppercase tracking-[0.16em] text-jpv-inverse-muted'>Next lesson</p>
                <p className='mt-2 font-bold'>How to Use the Programme</p>
                <p className='mt-1 text-sm text-jpv-inverse-muted'>11 minutes</p>
              </div>
            </div>
          </div>
        </section>

        <section className='mt-14 grid gap-8 lg:grid-cols-[1fr_330px]'>
          <div>
            <div className='flex items-end justify-between gap-4'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-jpv-sunshine-ink'>Curriculum</p>
                <h2 className='mt-2 text-3xl font-bold tracking-tight text-jpv-brand-deep'>Course structure</h2>
              </div>
              <span className='text-sm font-semibold text-jpv-muted'>3 modules</span>
            </div>

            <div className='mt-7 space-y-5'>
              {modules.map((module, moduleIndex) => (
                <article key={module.title} className='overflow-hidden rounded-jpv-card border border-jpv-border bg-jpv-canvas shadow-jpv-card'>
                  <div className='border-b border-jpv-border bg-jpv-canvas px-6 py-5 sm:px-7'>
                    <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
                      <div>
                        <p className='text-xs font-bold uppercase tracking-[0.17em] text-jpv-sunshine-ink'>Module {moduleIndex + 1}</p>
                        <h3 className='mt-1 text-xl font-bold text-jpv-brand-deep'>{module.title}</h3>
                        <p className='mt-2 text-sm text-jpv-muted'>{module.description}</p>
                      </div>
                      <span className='shrink-0 rounded-full bg-jpv-surface-strong px-3 py-2 text-xs font-bold text-jpv-muted'>{module.lessons.length} lessons</span>
                    </div>
                  </div>

                  <div className='divide-y divide-[var(--jpv-brand-deep)]/8'>
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.title} className='flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center sm:px-7'>
                        <div className='flex items-center gap-4'>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${lesson.state === 'completed' ? 'bg-jpv-sunshine text-jpv-brand-deep' : 'bg-jpv-surface-strong text-jpv-muted'}`}>
                            {lesson.state === 'completed' ? '✓' : lessonIndex + 1}
                          </span>
                          <div>
                            <p className='font-semibold text-jpv-brand-deep'>{lesson.title}</p>
                            <p className='mt-1 text-xs text-jpv-muted'>{lesson.duration}</p>
                          </div>
                        </div>
                        <span className={`self-start rounded-full px-3 py-2 text-xs font-bold sm:self-auto ${stateStyles[lesson.state]}`}>
                          {stateLabel[lesson.state]}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className='space-y-6'>
            <div className='rounded-jpv-card bg-jpv-sunshine p-7 text-jpv-brand-deep'>
              <p className='text-xs font-bold uppercase tracking-[0.18em]'>Course outcome</p>
              <h3 className='mt-3 text-2xl font-bold'>Move forward with clarity</h3>
              <p className='mt-3 text-sm leading-6 text-jpv-muted'>By the end of this course, members should understand their audience, offer and next practical step.</p>
            </div>

            <div className='rounded-jpv-card border border-jpv-border bg-jpv-canvas p-7'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine-ink'>Included</p>
              <ul className='mt-5 space-y-3 text-sm text-jpv-muted'>
                <li className='flex gap-3'><span>✓</span><span>9 structured lessons</span></li>
                <li className='flex gap-3'><span>✓</span><span>Video and written learning</span></li>
                <li className='flex gap-3'><span>✓</span><span>Downloadable worksheets</span></li>
                <li className='flex gap-3'><span>✓</span><span>Simple progress overview</span></li>
              </ul>
            </div>

            <div className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-7'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-jpv-sunshine-ink'>Prototype note</p>
              <p className='mt-3 text-sm leading-6 text-jpv-muted'>This screen uses static demonstration content. No member permissions, progress or live course records are connected.</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
