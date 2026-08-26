import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8')
}

function includes(sourceText: string, expected: string, file: string): void {
  assert.ok(sourceText.includes(expected), `${file} must contain ${expected}`)
}

async function main(): Promise<void> {
  const coursePage = await source('src/app/(frontend)/portal/courses/[courseSlug]/page.tsx')
  const accordion = await source('src/components/portal/CourseModuleAccordion.tsx')
  const lessonPage = await source('src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx')
  const lessonVideo = await source('src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/LessonVideoPlayer.tsx')
  const managedVideo = await source('src/components/portal/ManagedBunnyVideoPlayer.tsx')
  const richText = await source('src/components/portal/LegacyLessonRichText.tsx')

includes(coursePage, "aria-labelledby='course-overview-heading'", 'course page')
includes(coursePage, "role='progressbar'", 'course page')
includes(coursePage, 'Continue learning', 'course page')
includes(coursePage, "aria-labelledby='course-curriculum-heading'", 'course page')
includes(coursePage, 'continueHref={continueHref}', 'course page')

includes(accordion, 'continueHref?: string | null', 'course accordion')
includes(accordion, "min-h-11", 'course accordion')
includes(accordion, 'data-next-lesson', 'course accordion')
assert.match(accordion, />\s*Open\s*<\/Link>/, 'course accordion must preserve the Open lesson action')

includes(lessonPage, "aria-label='Learning path'", 'lesson page')
includes(lessonPage, "id='lesson-heading'", 'lesson page')
includes(lessonPage, "id='lesson-content-heading'", 'lesson page')
includes(lessonPage, "id='lesson-progress-heading'", 'lesson page')
includes(lessonPage, "id='lesson-discussion'", 'lesson page')
includes(lessonPage, "aria-label='Lesson navigation'", 'lesson page')
assert.ok(!lessonPage.includes('bg-emerald-50'), 'lesson page should use the JPV status tokens')

includes(lessonVideo, "containerClassName='mx-auto max-w-4xl'", 'lesson video player')
includes(managedVideo, 'containerClassName?: string', 'managed video player')
includes(managedVideo, 'aspect-video', 'managed video player')
includes(richText, 'max-w-4xl', 'lesson rich text')
includes(richText, 'text-jpv-ink', 'lesson rich text')
assert.ok(!richText.includes('text-neutral-800'), 'lesson rich text should consume JPV ink token')

  console.log('p2_01_course_learning_hierarchy: PASS')
}

void main()
