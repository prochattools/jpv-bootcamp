import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/PROVIDER_VERIFICATION_APPROVAL.md', 'utf8')
  const providerRunbook = readFileSync('docs/release/PROVIDER_VERIFICATION_RUNBOOK.md', 'utf8')

  assert.match(decision, /Decision ID: `provider-verification`/)
  assert.match(decision, /Current status: `UNEXECUTED`/)
  assert.match(decision, /repository simulation is not accepted as live provider evidence/i)
  assert.match(decision, /## Approval record/)
  assert.match(providerRunbook, /Provider verification is documented but unexecuted\./)
  assert.doesNotMatch(decision, /https?:\/\//)
  assert.doesNotMatch(decision, /fake-pass|simulated pass/i)

  console.log('provider_verification_approval.test.ts passed')
}

main()

