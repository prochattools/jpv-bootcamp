import assert from 'node:assert/strict'

import type { PayloadCourseWriteAPI } from '../src/lib/payloadCourse/accessService'
import { markMemberLessonComplete } from '../src/lib/payloadCourse/memberPortal'
import { decodeHtmlEntities, isHiddenLegacyWelcomeLesson } from '../src/lib/payloadCourse/curriculum'

async function run(): Promise<void> {
  assert.equal(decodeHtmlEntities('Lesson 1 - Biblical Foundation &amp; Mindset'), 'Lesson 1 - Biblical Foundation & Mindset')
  assert.equal(
    isHiddenLegacyWelcomeLesson({
      courseSlug: 'propertytraining_uk',
      moduleTitle: 'Welcome',
      lessonSlug: 'lesson-2-welcome-to-the-course',
      lessonTitle: 'Lesson 2 - Welcome to the Course',
    }),
    true
  )
  assert.equal(
    isHiddenLegacyWelcomeLesson({
      courseSlug: 'propertytraining_uk',
      moduleTitle: 'Module 1 - New Beginnings',
      lessonSlug: 'lesson-1-biblical-foundation',
      lessonTitle: 'Lesson 1 - Biblical Foundation &amp; Mindset',
    }),
    false
  )

  const queries: Array<{ text: string; values?: readonly unknown[] }> = []
  const payload = {
    db: {
      pool: {
        async query(args: { text: string; values?: readonly unknown[] }) {
          queries.push(args)
          return {
            rows: [
              {
                id: 501,
                display_name: '42:Financing Your Investment',
                member_id: 42,
                lesson_id: 314,
                status: 'completed',
                started_at: '2026-09-01T00:00:00.000Z',
                completed_at: '2026-09-01T00:00:00.000Z',
                percent_complete: 100,
                last_position_seconds: 0,
                metadata: null,
                created_at: '2026-09-01T00:00:00.000Z',
                updated_at: '2026-09-01T00:00:00.000Z',
              },
            ],
          }
        },
      },
    },
  } as unknown as PayloadCourseWriteAPI

  const result = await markMemberLessonComplete(payload, 42, 314, 'Financing Your Investment')

  assert.equal(result.id, 501)
  assert.equal(result.status, 'completed')
  assert.equal(result.percentComplete, 100)
  assert.equal(queries.length, 1)
  assert.match(queries[0]?.text ?? '', /ON CONFLICT \("member_id", "lesson_id"\)/)
  assert.deepEqual(queries[0]?.values?.slice(0, 3), ['42:Financing Your Investment', 42, 314])

  console.log('payload_lesson_completion_and_curriculum.test.ts passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
