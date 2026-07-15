import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/ROLLBACK_READINESS_APPROVAL.md', 'utf8')
  const checklist = readFileSync('docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md', 'utf8')

  assert.match(decision, /Decision ID: `rollback-readiness`/)
  assert.match(decision, /Current status: `DOCUMENTED_BUT_INCOMPLETE`/)
  assert.match(decision, /Repository rehearsal evidence and external rollback evidence remain separate/i)
  assert.match(checklist, /Repository-only status: `Documented but incomplete`/)
  assert.match(decision, /Rollback owner role: `Rollback owner`/)

  console.log('rollback_readiness_approval.test.ts passed')
}

main()

