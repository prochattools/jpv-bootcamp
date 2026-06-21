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
    title: 'VIP Mastermind',
    description: 'Advanced implementation sessions, private resources and focused support.',
    badge: 'VIP',
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
  return (
    <div className='min-h-screen bg-[#f4f1e9] text-[#14261d]'>
      <div className='border-b border-[#193f2f]/10 bg-[#10281f] px-5 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#d7c99c]'>
        Visual prototype only — not connected to the live portal, members or billing
      </div>

      <header className='border-b border-[#193f2f]/10 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10'>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-full bg-[#153f2e] text-sm font-bold tracking-wide text-[#f4eac6]'>
              JPV
            </div>
            <div>
              <p className='text-lg font-bold tracking-tight text-[#153f2e]'>JPV Bootcamp</p>
              <p className='text-xs font-medium uppercase tracking-[0.16em] text-[#8a7450]'>Learning Portal</p>
            </div>
          </div>

          <nav className='hidden items-center gap-8 text-sm font-semibold text-[#355246] md:flex'>
            <a className='text-[#153f2e]' href='#courses'>My courses</a>
            <a href='#curriculum'>Curriculum</a>
            <a href='#resources'>Resources</a>
          </nav>

          <div className='flex items-center gap-3'>
            <div className='hidden text-right sm:block'>
              <p className='text-sm font-semibold'>Demo Member</p>
              <p className='text-xs text-[#6f7f77]'>Pro access preview</p>
            </div>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-[#d9c897] text-sm font-bold text-[#153f2e]'>DM</div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14'>
        <section className='overflow-hidden rounded-[28px] bg-[#153f2e] text-white shadow-[0_24px_70px_rgba(20,55,40,0.18)]'>
          <div className='grid lg:grid-cols-[1.3fr_0.7fr]'>
            <div className='p-8 sm:p-10 lg:p-14'>
              <span className='inline-flex rounded-full border border-[#e2d5aa]/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e6d9b1]'>
                Continue learning
              </span>
              <h1 className='mt-7 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                Build with clarity. Learn at your own pace.
              </h1>
              <p className='mt-5 max-w-2xl text-base leading-7 text-[#d5e0da] sm:text-lg'>
                A focused course experience for JPV members, with simple modules, clear progress and practical next steps.
              </p>
              <div className='mt-9 flex flex-wrap gap-4'>
                <button className='rounded-full bg-[#d9c897] px-6 py-3 text-sm font-bold text-[#153f2e] shadow-sm'>
                  Continue JPV Foundations
                </button>
                <button className='rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white'>
                  View curriculum
                </button>
              </div>
            </div>

            <div className='border-t border-white/10 bg-[#0f3425] p-8 lg:border-l lg:border-t-0 lg:p-10'>
              <p className='text-xs font-bold uppercase tracking-[0.18em] text-[#d9c897]'>Your current path</p>
              <div className='mt-6 space-y-4'>
                {modulePreview.map((module) => (
                  <div key={module.label} className={`rounded-2xl border p-4 ${module.active ? 'border-[#d9c897] bg-white/8' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className='flex items-center justify-between gap-4'>
                      <div>
                        <p className='text-xs uppercase tracking-[0.14em] text-[#aabdb3]'>{module.label}</p>
                        <p className='mt-1 font-semibold'>{module.title}</p>
                      </div>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${module.complete ? 'bg-[#d9c897] text-[#153f2e]' : module.active ? 'border border-[#d9c897] text-[#d9c897]' : 'border border-white/15 text-white/45'}`}>
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
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Course library</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight text-[#153f2e]'>My courses</h2>
              <p className='mt-2 text-[#64736c]'>A visual preview of how available and restricted courses could appear.</p>
            </div>
            <div className='rounded-full border border-[#153f2e]/10 bg-white px-4 py-2 text-sm font-semibold text-[#51645b]'>
              3 courses shown
            </div>
          </div>

          <div className='mt-8 grid gap-6 lg:grid-cols-3'>
            {courses.map((course) => (
              <article key={course.title} className={`group overflow-hidden rounded-[24px] border bg-white shadow-[0_16px_45px_rgba(31,52,43,0.08)] transition-transform duration-200 hover:-translate-y-1 ${course.featured ? 'border-[#b7a56f]' : 'border-[#153f2e]/10'}`}>
                <div className={`relative h-44 overflow-hidden ${course.locked ? 'bg-[#4d514d]' : course.featured ? 'bg-[#214e3a]' : 'bg-[#cfbf90]'}`}>
                  <div className='absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_32%),radial-gradient(circle_at_80%_70%,white_0,transparent_28%)]' />
                  <div className='absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold tracking-[0.16em] text-[#153f2e]'>
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
                    <h3 className='text-xl font-bold tracking-tight text-[#153f2e]'>{course.title}</h3>
                    {course.featured && <span className='text-lg text-[#a58d4e]'>★</span>}
                  </div>
                  <p className='mt-3 min-h-[72px] text-sm leading-6 text-[#68766f]'>{course.description}</p>

                  <div className='mt-5 flex items-center gap-4 text-xs font-semibold text-[#66766e]'>
                    <span>{course.lessons} lessons</span>
                    <span className='h-1 w-1 rounded-full bg-[#9cab9f]' />
                    <span>{course.duration}</span>
                  </div>

                  <div className='mt-6'>
                    <div className='flex items-center justify-between text-xs font-semibold'>
                      <span className='text-[#53675d]'>Progress</span>
                      <span className='text-[#153f2e]'>{course.progress}%</span>
                    </div>
                    <div className='mt-2 h-2 overflow-hidden rounded-full bg-[#e9e7df]'>
                      <div className='h-full rounded-full bg-[#9d864b]' style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>

                  <button className={`mt-6 w-full rounded-full px-5 py-3 text-sm font-bold ${course.locked ? 'border border-[#153f2e]/15 bg-[#f4f1e9] text-[#59665f]' : 'bg-[#153f2e] text-white'}`}>
                    {course.state}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id='curriculum' className='mt-14 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]'>
          <div className='rounded-[24px] border border-[#153f2e]/10 bg-white p-7 shadow-[0_14px_40px_rgba(31,52,43,0.06)] sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#8a7450]'>Next lesson</p>
            <div className='mt-5 flex flex-col justify-between gap-6 sm:flex-row sm:items-center'>
              <div>
                <p className='text-sm font-semibold text-[#708078]'>Module 2 · Lesson 1</p>
                <h3 className='mt-2 text-2xl font-bold text-[#153f2e]'>Understand Your Audience</h3>
                <p className='mt-2 max-w-xl text-sm leading-6 text-[#68766f]'>Clarify who you serve, what they need and how your experience creates value.</p>
              </div>
              <button className='shrink-0 rounded-full bg-[#d9c897] px-6 py-3 text-sm font-bold text-[#153f2e]'>Open lesson</button>
            </div>
          </div>

          <div id='resources' className='rounded-[24px] bg-[#d8c999] p-7 text-[#153f2e] sm:p-8'>
            <p className='text-xs font-bold uppercase tracking-[0.2em]'>Resources</p>
            <h3 className='mt-3 text-2xl font-bold'>Your course toolkit</h3>
            <p className='mt-3 text-sm leading-6 text-[#43594f]'>Worksheets, practical templates and lesson downloads will live together in one clear place.</p>
            <button className='mt-6 rounded-full border border-[#153f2e]/20 bg-white/40 px-5 py-3 text-sm font-bold'>View example resources</button>
          </div>
        </section>
      </main>

      <footer className='mt-16 border-t border-[#153f2e]/10 bg-white px-6 py-8'>
        <div className='mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm text-[#68766f] sm:flex-row'>
          <p className='font-semibold text-[#153f2e]'>JPV Bootcamp Course Prototype</p>
          <p>Static demonstration — no live account, course or payment data</p>
        </div>
      </footer>
    </div>
  )
}
