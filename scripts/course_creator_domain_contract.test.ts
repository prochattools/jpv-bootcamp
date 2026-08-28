import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const [actions, courseCommands, moduleCommands, lessonCommands, persistence, policy, contract] = await Promise.all([
    readFile('src/lib/portalAdmin/courseAdminActions.ts', 'utf8'),
    readFile('src/lib/courseAdmin/courseCommands.ts', 'utf8'),
    readFile('src/lib/courseAdmin/moduleCommands.ts', 'utf8'),
    readFile('src/lib/courseAdmin/lessonCommands.ts', 'utf8'),
    readFile('src/lib/courseAdmin/persistence.ts', 'utf8'),
    readFile('src/lib/courseAdmin/policy.ts', 'utf8'),
    readFile('docs/architecture/JPV_COURSE_CREATOR_DOMAIN_CONTRACT.md', 'utf8'),
  ])

  assert.match(actions, /^'use server'/)
  assert.match(actions, /requirePortalAdmin/)
  assert.match(actions, /revalidatePath/)
  for (const forbidden of [
    /createAuditEvent/,
    /plainTextToLexical/,
    /findCourseById/,
    /findModulesForCourse/,
    /findLessonsForModule/,
    /payload\.find\(/,
  ]) {
    assert.doesNotMatch(actions, forbidden, `transport should not own ${forbidden}`)
  }

  assert.match(courseCommands, /createAuditEvent/)
  assert.match(courseCommands, /findModulesForCourse/)
  assert.match(moduleCommands, /reorderRecords/)
  assert.match(moduleCommands, /findCourseForModule/)
  assert.match(lessonCommands, /plainTextToLexical/)
  assert.match(lessonCommands, /findCourseForLesson/)
  assert.match(lessonCommands, /payload_lesson_progress/)
  assert.match(persistence, /relationshipId/)
  assert.match(persistence, /\.\.\.context\.access/)
  assert.match(persistence, /overrideLock: true/)
  assert.match(persistence, /Reorder failed and was rolled back\./)
  assert.match(policy, /Deletion requires explicit confirmation\./)
  assert.match(policy, /Duplicate .* ID in order list\./)

  assert.match(contract, /A4 COURSE \/ CREATOR DOMAIN CONVERGENCE COMPLETE/)
  assert.match(contract, /\*\*Starting A3 HEAD:\*\* `876b127145f0c190fb4dfc253cd6eedb2a724d8d`/)
  assert.match(contract, /No member authorization, provider, database, migration, schema, billing,\s+notification, media-storage, or production-runtime behavior is in A4 scope\./)
  assert.match(contract, /A5 is not started by this contract\./)

  console.log('course creator domain contract tests passed')
}

void main()
