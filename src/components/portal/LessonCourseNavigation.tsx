import Link from 'next/link'
import { Check, Circle } from 'lucide-react'

type LessonNavigationModule = {
  id: string
  title: string
  lessons: Array<{
    id: string
    title: string
    slug: string | null
    completed: boolean
  }>
}

type LessonCourseNavigationProps = {
  courseSlug: string
  currentLessonSlug: string
  modules: LessonNavigationModule[]
}

function lessonHref(courseSlug: string, lessonSlug: string): string {
  return `/portal/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`
}

export function LessonCourseNavigation({ courseSlug, currentLessonSlug, modules }: LessonCourseNavigationProps) {
  return (
    <aside aria-label='Course navigation' className='order-first self-start lg:order-last lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto'>
      <div className='rounded-jpv-panel border border-jpv-border bg-jpv-surface p-4 shadow-jpv-card sm:p-5'>
        <p className='jpv-eyebrow'>Learning path</p>
        <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>Lessons</h2>

        <nav className='mt-5 space-y-4' aria-label='Lessons in this course'>
          {modules.map((module) => (
            <section key={module.id}>
              <h3 className='border-b border-jpv-border pb-2 text-sm font-semibold text-jpv-ink'>{module.title}</h3>
              <ol className='mt-2 space-y-1'>
                {module.lessons.map((lesson) => {
                  const isCurrent = lesson.slug === currentLessonSlug
                  const className = `flex min-h-10 items-start gap-2 rounded-lg px-2 py-2 text-sm transition ${
                    isCurrent ? 'bg-jpv-brand/10 font-semibold text-jpv-brand-deep ring-1 ring-inset ring-jpv-brand/20' : 'text-jpv-muted hover:bg-jpv-canvas hover:text-jpv-ink'
                  }`
                  const icon = lesson.completed ? <Check aria-hidden='true' className='mt-0.5 h-4 w-4 shrink-0 text-jpv-brand-deep' /> : <Circle aria-hidden='true' className='mt-0.5 h-4 w-4 shrink-0 text-jpv-muted' />

                  return (
                    <li key={lesson.id}>
                      {lesson.slug ? (
                        <Link aria-current={isCurrent ? 'page' : undefined} className={className} href={lessonHref(courseSlug, lesson.slug)}>
                          {icon}
                          <span className='min-w-0 leading-5'>{lesson.title}</span>
                        </Link>
                      ) : (
                        <span className={className}>
                          {icon}
                          <span className='min-w-0 leading-5'>{lesson.title}</span>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </nav>
      </div>
    </aside>
  )
}
