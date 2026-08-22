'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

type LessonItem = {
  id: string | number
  title: string
  slug: string | null
  summary: string | null
  estimatedDuration: string | null
  previewLesson: boolean
  lockState: 'available' | 'locked' | 'coming_soon'
  completed: boolean
}

type ModuleItem = {
  id: string | number
  title: string
  description: string | null
  lessons: LessonItem[]
}

type CourseModuleAccordionProps = {
  modules: ModuleItem[]
  courseSlug: string
  allowed: boolean
}

function lessonBadge(lesson: LessonItem) {
  if (lesson.completed) {
    return <span className='rounded-full bg-jpv-brand/10 px-3 py-1 text-xs font-semibold text-jpv-brand-deep'>Complete</span>
  }
  if (lesson.lockState === 'locked') {
    return <span className='rounded-full bg-jpv-danger-surface px-3 py-1 text-xs font-semibold text-jpv-danger-ink'>Locked</span>
  }
  if (lesson.lockState === 'coming_soon') {
    return <span className='rounded-full bg-jpv-surface-strong px-3 py-1 text-xs font-semibold text-jpv-muted'>Coming soon</span>
  }
  if (lesson.previewLesson) {
    return <span className='rounded-full bg-jpv-brand/10 px-3 py-1 text-xs font-semibold text-jpv-brand-deep'>Preview</span>
  }
  return null
}

export function CourseModuleAccordion({ modules, courseSlug, allowed }: CourseModuleAccordionProps) {
  const defaultOpen = modules.length > 0 ? [String(modules[0].id)] : []

  return (
    <AccordionPrimitive.Root className='space-y-4' defaultValue={defaultOpen} type='multiple'>
      {modules.map((module, moduleIndex) => {
        const completedCount = module.lessons.filter((l) => l.completed).length
        return (
          <AccordionPrimitive.Item
            className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas shadow-sm overflow-hidden'
            key={module.id}
            value={String(module.id)}
          >
            <AccordionPrimitive.Header asChild>
              <div>
                <AccordionPrimitive.Trigger className='flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-jpv-surface [&[data-state=open]>svg]:rotate-180'>
                  <div className='min-w-0'>
                    <p className='text-[0.6875rem] font-extrabold uppercase tracking-wider text-jpv-muted'>
                      Module {moduleIndex + 1}
                    </p>
                    <h2 className='mt-1 text-lg font-semibold text-jpv-ink'>{module.title}</h2>
                  </div>
                  <div className='flex shrink-0 items-center gap-3'>
                    <span className='rounded-full bg-jpv-surface-strong px-3 py-1 text-xs font-semibold text-jpv-muted'>
                      {completedCount}/{module.lessons.length} lessons
                    </span>
                    <ChevronDown aria-hidden='true' className='h-5 w-5 shrink-0 text-jpv-muted transition-transform duration-200' />
                  </div>
                </AccordionPrimitive.Trigger>
              </div>
            </AccordionPrimitive.Header>

            <AccordionPrimitive.Content className='overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'>
              <div className='border-t border-jpv-border'>
                {module.description ? (
                  <p className='px-6 pt-4 text-sm leading-6 text-jpv-muted'>{module.description}</p>
                ) : null}
                <ol className='divide-y divide-jpv-border'>
                  {module.lessons.map((lesson, lessonIndex) => (
                    <li className='flex items-center justify-between gap-4 px-6 py-4' key={lesson.id}>
                      <div className='min-w-0'>
                        <p className='text-xs font-medium text-jpv-muted'>Lesson {lessonIndex + 1}</p>
                        <h3 className='mt-1 font-semibold text-jpv-ink'>{lesson.title}</h3>
                        {lesson.summary ? <p className='mt-1 text-sm text-jpv-muted'>{lesson.summary}</p> : null}
                        {lesson.estimatedDuration ? (
                          <p className='mt-1 text-xs font-medium text-jpv-muted'>{lesson.estimatedDuration}</p>
                        ) : null}
                      </div>

                      <div className='flex shrink-0 items-center gap-3'>
                        {lessonBadge(lesson)}
                        {allowed && lesson.slug ? (
                          <Link className='jpv-button-primary' href={`/portal/courses/${courseSlug}/lessons/${lesson.slug}`}>
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        )
      })}
    </AccordionPrimitive.Root>
  )
}
