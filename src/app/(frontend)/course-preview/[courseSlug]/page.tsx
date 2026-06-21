import Link from 'next/link'

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
  completed: 'bg-[#d9c897] text-[#153f2e]',
  current: 'border border-[#c1a960] bg-[#fffaf0] text-[#153f2e]',
  available: 'border border-[#153f2e]/10 bg-white text-[#52645b]',
  locked: 'border border-[#153f2e]/10 bg-[#f0eee8] text-[#87918c]',
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
  const { courseSlug } = await params

  return (
    <div className='min-h-screen bg-[#f4f1e9] text-[#14261d]'>
      <div className='border-b border-[#193f2f]/10 bg-[#10281f] px-5 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#d7c99c]'>
        Visual prototype only — no live member, course or billing data
      </div>

      <header className='border-b border-[#193f2f]/10 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10'>
          <Link href='/course-preview' className='flex items-center gap-3 text-inherit no-underline'>
            <img
              src='/images/jpv-logo.jpg'
              alt='JPV • Jesus Property Venture logo'
              className='h-11 w-11 rounded-xl object-cover'
            />
            <div>
              <p className='text-lg font-bold tracking-tight text-[#153f2e]'>JPV Bootcamp</p>
              <p className='text-xs font-medium uppercase tracking-[0.16em] text-[#8a7450]'>Learning Portal</p>
            </div>
          </Link>
          <Link href='/course-preview' className='rounded-full border border-[#153f2e]/15 px-4 py-2 text-sm font-bold text-[#153f2e] no-underline'>
            Back to courses
          </Link>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-[28px] bg-[#153f2e] text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)]'>
          <div className='grid lg:grid-cols-[1.25fr_0.75fr]'>
            <div className='p-8 sm:p-10 lg:p-14'>
              <div className='flex flex-wrap items-center gap-3'>
                <span className='rounded-full bg-[#d9c897] px-3 py-1 text-xs font-extrabold tracking-[0.15em] text-[#153f2e]'>PRO</span>
                <span className='rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-[#d7e1dc]'>9 lessons</span>
                <span className='rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-[#d7e1dc]'>3h 20m</span>
              </div>
              <p className='mt-8 text-sm font-bold uppercase tracking-[0.2em] text-[#d9c897]'>Course overview</p>
              <h1 className='mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>JPV Foundations</h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
                A practical learning path designed to help members build clarity, shape a valuable offer and move forward with a focused action plan.
              </p>
              <div className='mt-9 flex flex-wrap gap-4'>
                <Link href={`/course-preview/${courseSlug}/how-to-use-the-programme`} className='rounded-full bg-[#d9c897] px-6 py-3 text-sm font-bold text-[#153f2e] no-underline'>
                  Continue course
                </Link>
                <button className='rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white'>Download course guide</button>
              </div>
            </div>

            <div className='border-t border-white/10 bg-[#0f3425] p-8 lg:border-l lg:border-t-0 lg:p-10'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-[#d9c897]'>Your progress</p>
              <div className='mt-6 flex items-end justify-between'>
                <div>
                  <p className='text-5xl font-bold'>36%</p>
                  <p className='mt-2 text-sm text-[#b9c8c0]'>3 of 9 lessons viewed</p>
                </div>
                <div className='flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-[#d9c897] text-sm font-bold'>3 / 9</div>
              </div>
              <div className='mt-8 h-2 overflow-hidden rounded-full bg-white/10'>
                <div className='h-full w-[36%] rounded-full bg-[#d9c897]' />
              </div>
              <div className='mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5'>
                <p className='text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb2a8]'>Next lesson</p>
                <p className='mt-2 font-bold'>How to Use the Programme</p>
                <p className='mt-1 text-sm text-[#b9c8c0]'>11 minutes</p>
              </div>
            </div>
          </div>
        </section>

        <section className='mt-14 grid gap-8 lg:grid-cols-[1fr_330px]'>
          <div>
            <div className='flex items-end justify-between gap-4'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Curriculum</p>
                <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>Course structure</h2>
              </div>
              <span className='text-sm font-semibold text-[#68766f]'>3 modules</span>
            </div>

            <div className='mt-7 space-y-5'>
              {modules.map((module, moduleIndex) => (
                <article key={module.title} className='overflow-hidden rounded-[22px] border border-[#153f2e]/10 bg-white shadow-[0_14px_40px_rgba(31,52,43,0.06)]'>
                  <div className='border-b border-[#153f2e]/8 bg-[#fbfaf6] px-6 py-5 sm:px-7'>
                    <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
                      <div>
                        <p className='text-xs font-bold uppercase tracking-[0.17em] text-[#8a7450]'>Module {moduleIndex + 1}</p>
                        <h3 className='mt-1 text-xl font-bold text-[#153f2e]'>{module.title}</h3>
                        <p className='mt-2 text-sm text-[#6d7b74]'>{module.description}</p>
                      </div>
                      <span className='shrink-0 rounded-full bg-[#ece8dc] px-3 py-2 text-xs font-bold text-[#5e6c65]'>{module.lessons.length} lessons</span>
                    </div>
                  </div>

                  <div className='divide-y divide-[#153f2e]/8'>
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.title} className='flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center sm:px-7'>
                        <div className='flex items-center gap-4'>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${lesson.state === 'completed' ? 'bg-[#d9c897] text-[#153f2e]' : 'bg-[#edf0eb] text-[#617068]'}`}>
                            {lesson.state === 'completed' ? '✓' : lessonIndex + 1}
                          </span>
                          <div>
                            <p className='font-semibold text-[#153f2e]'>{lesson.title}</p>
                            <p className='mt-1 text-xs text-[#78847e]'>{lesson.duration}</p>
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
            <div className='rounded-[22px] bg-[#d8c999] p-7 text-[#153f2e]'>
              <p className='text-xs font-bold uppercase tracking-[0.18em]'>Course outcome</p>
              <h3 className='mt-3 text-2xl font-bold'>Move forward with clarity</h3>
              <p className='mt-3 text-sm leading-6 text-[#43594f]'>By the end of this course, members should understand their audience, offer and next practical step.</p>
            </div>

            <div className='rounded-[22px] border border-[#153f2e]/10 bg-white p-7'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-[#8a7450]'>Included</p>
              <ul className='mt-5 space-y-3 text-sm text-[#5e6c65]'>
                <li className='flex gap-3'><span>✓</span><span>9 structured lessons</span></li>
                <li className='flex gap-3'><span>✓</span><span>Video and written learning</span></li>
                <li className='flex gap-3'><span>✓</span><span>Downloadable worksheets</span></li>
                <li className='flex gap-3'><span>✓</span><span>Simple progress overview</span></li>
              </ul>
            </div>

            <div className='rounded-[22px] border border-dashed border-[#153f2e]/20 bg-[#fbfaf6] p-7'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-[#8a7450]'>Prototype note</p>
              <p className='mt-3 text-sm leading-6 text-[#68766f]'>This screen uses static demonstration content. No member permissions, progress or live course records are connected.</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
