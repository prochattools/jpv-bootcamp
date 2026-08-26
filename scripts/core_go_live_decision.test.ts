import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/CORE_GO_LIVE_DECISION.md', 'utf8')
  const readiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
  const handoff = readFileSync('docs/client/OPERATOR_HANDOFF_SUMMARY.md', 'utf8')

  assert.match(decision, /Decision ID: `core-go-live`/)
  assert.match(decision, /Current status: `NO-GO`/)
  assert.match(decision, /programme-content-publication/)
  assert.match(decision, /table-plan-to-free/)
  assert.match(decision, /account-column-rename/)
  assert.match(decision, /staging-migration-approval/)
  assert.match(decision, /provider-verification/)
  assert.match(decision, /staging-smoke/)
  assert.match(decision, /rollback-readiness/)
  assert.match(decision, /Repository simulation alone cannot produce GO/i)
  assert.match(readiness, /NO-GO/i)
  assert.match(handoff, /Formal go\/no-go review/)
  assert.match(readiness, /M2-01 remains post-core/i)
  assert.doesNotMatch(decision, /Current status: `GO`/)

  console.log('core_go_live_decision.test.ts passed')
}

main()

