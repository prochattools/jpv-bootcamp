import Link from 'next/link'

const courseLessons = [
  {
    module: 'Start Here',
    lessons: [
      { slug: 'welcome-to-jpv', title: 'Welcome to JPV', duration: '8 min', state: 'completed' },
      { slug: 'define-your-goal', title: 'Define Your Goal', duration: '14 min', state: 'completed' },
      { slug: 'how-to-use-the-programme', title: 'How to Use the Programme', duration: '11 min', state: 'current' },
    ],
  },
  {
    module: 'Build Your Offer',
    lessons: [
      { slug: 'understand-your-audience', title: 'Understand Your Audience', duration: '18 min', state: 'available' },
      { slug: 'define-the-outcome', title: 'Define the Outcome', duration: '16 min', state: 'available' },
      { slug: 'shape-the-offer', title: 'Shape the Offer', duration: '22 min', state: 'locked' },
    ],
  },
  {
    module: 'Put It Into Practice',
    lessons: [
      { slug: 'validate-the-offer', title: 'Validate the Offer', duration: '20 min', state: 'locked' },
      { slug: 'create-the-action-plan', title: 'Create the Action Plan', duration: '24 min', state: 'locked' },
      { slug: 'next-steps', title: 'Next Steps', duration: '10 min', state: 'locked' },
    ],
  },
]

const lessonContent: Record<string, { title: string; summary: string; content: string; video?: string }> = {
  'welcome-to-jpv': {
    title: 'Welcome to JPV',
    summary: 'Get started with JPV Bootcamp and understand what you\'ll learn.',
    content: `<p>Welcome to the JPV Bootcamp, a comprehensive learning experience designed to help you build a successful offer.</p>
      <p>In this lesson, you'll get an overview of the entire program and understand the structure of the bootcamp.</p>
      <p>We've designed this course to be practical and actionable. Each module builds on the previous one, giving you the tools and frameworks you need to succeed.</p>`,
    video: 'dQw4w9WgXcQ',
  },
  'define-your-goal': {
    title: 'Define Your Goal',
    summary: 'Learn how to set clear, achievable goals for your learning journey.',
    content: `<p>Setting clear goals is the foundation of any successful learning experience.</p>
      <p>In this lesson, you'll learn how to define meaningful goals that will guide your journey through the bootcamp.</p>
      <p>Take time to reflect on what you want to achieve and how it aligns with your overall vision.</p>`,
    video: 'dQw4w9WgXcQ',
  },
  'how-to-use-the-programme': {
    title: 'How to Use the Programme',
    summary: 'Navigate the bootcamp structure and get the most out of your learning experience.',
    content: `<p>This lesson walks you through how to use the JPV Bootcamp platform effectively.</p>
      <p>You'll learn about the structure of each module and lesson, how to track your progress, and how to access resources.</p>
      <p>Remember, learning is a journey. Take your time with each lesson and revisit topics as needed.</p>`,
    video: 'dQw4w9WgXcQ',
  },
  'understand-your-audience': {
    title: 'Understand Your Audience',
    summary: 'Deep dive into knowing your ideal customer profile.',
    content: `<p>Understanding your audience is critical to building a successful offer.</p>
      <p>This lesson covers frameworks for identifying, researching, and understanding your target market.</p>
      <p>You'll walk away with clarity on who your ideal customer is and what they truly need.</p>`,
  },
  'define-the-outcome': {
    title: 'Define the Outcome',
    summary: 'Shape the transformation your offer provides.',
    content: `<p>Every great offer delivers a clear transformation or outcome.</p>
      <p>In this lesson, you'll learn how to articulate the specific outcome your offer delivers.</p>
      <p>Clarity on outcomes makes your offer more compelling to potential customers.</p>`,
  },
  'shape-the-offer': {
    title: 'Shape the Offer',
    summary: 'Package your expertise into a compelling offer.',
    content: `<p>This lesson shows you how to take your expertise and package it into a clear, compelling offer.</p>
      <p>You'll learn about pricing models, delivery formats, and how to communicate your offer's value.</p>
      <p>This is where your vision becomes a tangible product or service.</p>`,
  },
  'validate-the-offer': {
    title: 'Validate the Offer',
    summary: 'Test your offer with real market feedback.',
    content: `<p>Before launching, you need to validate your offer with real people.</p>
      <p>This lesson covers validation techniques and how to gather meaningful feedback.</p>
      <p>Validation reduces risk and ensures your offer resonates with your market.</p>`,
  },
  'create-the-action-plan': {
    title: 'Create the Action Plan',
    summary: 'Build a concrete roadmap to launch your offer.',
    content: `<p>With a validated offer, it's time to create a detailed action plan.</p>
      <p>This lesson helps you break down your launch into manageable steps.</p>
      <p>A good action plan keeps you focused and accountable as you move forward.</p>`,
  },
  'next-steps': {
    title: 'Next Steps',
    summary: 'Your path forward after the bootcamp.',
    content: `<p>Congratulations on completing the JPV Bootcamp!</p>
      <p>This final lesson outlines your path forward and how to continue your growth.</p>
      <p>You now have the tools, frameworks, and clarity to build and scale your offer.</p>`,
  },
}

const stateStyles: Record<string, string> = {
  completed: 'bg-[#d9c897] text-[#153f2e]',
  current: 'border border-[#c1a960] bg-[#fffaf0] text-[#153f2e]',
  available: 'border border-[#153f2e]/10 bg-white text-[#52645b]',
  locked: 'border border-[#153f2e]/10 bg-[#f0eee8] text-[#87918c]',
}

const stateLabel: Record<string, string> = {
  completed: '✓ Completed',
  current: 'Watching',
  available: 'Available',
  locked: 'Locked',
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
}) {
  const { courseSlug, lessonSlug } = await params
  const lesson = lessonContent[lessonSlug] || lessonContent['welcome-to-jpv']

  let currentModuleIndex = 0
  let currentLessonIndex = 0
  for (let mi = 0; mi < courseLessons.length; mi++) {
    for (let li = 0; li < courseLessons[mi].lessons.length; li++) {
      if (courseLessons[mi].lessons[li].slug === lessonSlug) {
        currentModuleIndex = mi
        currentLessonIndex = li
        break
      }
    }
  }

  const currentModule = courseLessons[currentModuleIndex]
  const currentModuleLessons = currentModule.lessons
  const allLessons = courseLessons.flatMap((m) => m.lessons)
  const currentLessonGlobalIndex = allLessons.findIndex((l) => l.slug === lessonSlug)
  const prevLesson = currentLessonGlobalIndex > 0 ? allLessons[currentLessonGlobalIndex - 1] : null
  const nextLesson = currentLessonGlobalIndex < allLessons.length - 1 ? allLessons[currentLessonGlobalIndex + 1] : null

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

      <div className='mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[1fr_320px] lg:px-10'>
        <main className='min-h-screen'>
          <div className='mb-8'>
            <Link href={`/course-preview/${courseSlug}`} className='text-sm font-semibold text-[#8a7450] no-underline hover:text-[#153f2e]'>
              ← Back to course
            </Link>
          </div>

          <section className='mb-12 rounded-2xl bg-[#153f2e] p-8 text-white sm:p-10'>
            <p className='text-xs font-bold uppercase tracking-[0.2em] text-[#d9c897]'>{currentModule.module}</p>
            <h1 className='mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>{lesson.title}</h1>
            <p className='mt-5 text-base leading-7 text-[#d5e0da] sm:text-lg'>{lesson.summary}</p>
          </section>

          {lesson.video && (
            <section className='mb-12 aspect-video overflow-hidden rounded-2xl bg-black shadow-lg'>
              <iframe
                width='100%'
                height='100%'
                src={`https://www.youtube-nocookie.com/embed/${lesson.video}`}
                title={lesson.title}
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                allowFullScreen
              />
            </section>
          )}

          <section className='prose prose-sm max-w-none text-[#14261d]'>
            <div dangerouslySetInnerHTML={{ __html: lesson.content }} className='space-y-4 leading-7 [&_p]:mb-4' />
          </section>

          <div className='mt-16 flex flex-col gap-6 border-t border-[#193f2f]/10 pt-8 sm:flex-row'>
            {prevLesson ? (
              <Link href={`/course-preview/${courseSlug}/${prevLesson.slug}`} className='flex-1 rounded-2xl border border-[#193f2f]/15 px-6 py-4 text-left no-underline hover:bg-white/50'>
                <p className='text-xs font-bold uppercase tracking-[0.1em] text-[#8a7450]'>← Previous lesson</p>
                <p className='mt-2 font-bold text-[#153f2e]'>{prevLesson.title}</p>
              </Link>
            ) : (
              <div />
            )}
            {nextLesson ? (
              <Link href={`/course-preview/${courseSlug}/${nextLesson.slug}`} className='flex-1 rounded-2xl border border-[#193f2f]/15 px-6 py-4 text-right no-underline hover:bg-white/50'>
                <p className='text-xs font-bold uppercase tracking-[0.1em] text-[#8a7450]'>Next lesson →</p>
                <p className='mt-2 font-bold text-[#153f2e]'>{nextLesson.title}</p>
              </Link>
            ) : (
              <div />
            )}
          </div>

          <div className='mt-12 rounded-2xl bg-[#fffaf0] p-6 text-center sm:p-8'>
            <p className='text-sm text-[#8a7450]'>Course complete? Return to the dashboard or explore other courses.</p>
            <Link href='/course-preview' className='mt-4 inline-block rounded-full bg-[#153f2e] px-6 py-3 font-bold text-white no-underline'>
              Explore all courses
            </Link>
          </div>
        </main>

        <aside className='rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:h-fit'>
          <p className='text-xs font-bold uppercase tracking-[0.1em] text-[#8a7450]'>Course curriculum</p>
          <div className='mt-6 space-y-6'>
            {courseLessons.map((module, moduleIdx) => (
              <div key={module.module}>
                <p className='text-xs font-bold uppercase tracking-[0.1em] text-[#8a7450]'>{module.module}</p>
                <div className='mt-3 space-y-2'>
                  {module.lessons.map((l) => (
                    <Link
                      key={l.slug}
                      href={`/course-preview/${courseSlug}/${l.slug}`}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium no-underline ${
                        l.slug === lessonSlug ? 'bg-[#153f2e] text-white' : stateStyles[l.state]
                      }`}
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <span className='flex-1 text-left'>{l.title}</span>
                        {l.state === 'locked' && <span className='text-xs'>🔒</span>}
                        {l.state === 'completed' && <span className='text-xs'>✓</span>}
                      </div>
                      <div className='mt-1 text-xs opacity-75'>{l.duration}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className='mt-8 border-t border-[#193f2f]/10 pt-6'>
            <p className='text-xs font-bold uppercase tracking-[0.1em] text-[#8a7450]'>Lesson progress</p>
            <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#e8e5dd]'>
              <div
                className='h-full bg-[#d9c897]'
                style={{ width: `${((currentLessonGlobalIndex + 1) / allLessons.length) * 100}%` }}
              />
            </div>
            <p className='mt-2 text-xs text-[#8a7450]'>
              {currentLessonGlobalIndex + 1} of {allLessons.length} lessons
            </p>
          </div>

          <button className='mt-6 w-full rounded-full border border-[#193f2e] px-4 py-3 text-sm font-bold text-[#153f2e] hover:bg-[#f0eee8]'>
            Mark as complete
          </button>
        </aside>
      </div>
    </div>
  )
}
