import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const document = await readFile('docs/design/JPV_ENGAGEMENT_ARCHITECTURE_CONTRACT_V1.md', 'utf8')

for (const heading of [
  '## UX requirements',
  '### Reactions',
  'The v1 target policy is explicit:',
  '### Comments',
  '#### Current comment capabilities',
  '### Bookmarks',
  '### Sharing',
  '## Current repository findings',
  '## Proposed future data model',
  '## Permissions model',
  '## API and service boundaries',
  '## Performance and indexing',
  '## Future-only migration plan',
  '## Risks and decisions still required',
  '## Comparable-system research and applicable patterns',
]) {
  assert.ok(document.includes(heading), `engagement contract must contain ${heading}`)
}

assert.match(document, /No migration is authorized in this phase/)
assert.match(document, /does not implement reaction buttons, comment mutations, bookmarks, sharing, notifications/)
assert.match(document, /payload_space_reactions/)
assert.match(document, /payload_space_comments/)
assert.match(document, /payload_lesson_comments/)
assert.match(document, /Course-linked community posts/)
assert.match(document, /Lesson discussions/)
assert.match(document, /Announcements/)
assert.match(document, /lesson_comment/)
assert.match(document, /Fluent Community/)
assert.match(document, /Circle/)
assert.match(document, /Canvas Basics Guide/)
assert.match(document, /Payload access control/)

  console.log('p2_03_engagement_architecture_contract: PASS')
}

void main()
