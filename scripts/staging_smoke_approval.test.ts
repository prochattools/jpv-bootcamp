import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/STAGING_SMOKE_APPROVAL.md', 'utf8')
  const smokeTemplate = readFileSync('docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md', 'utf8')

  assert.match(decision, /Decision ID: `staging-smoke`/)
  assert.match(decision, /Current status: `UNEXECUTED`/)
  assert.match(decision, /Local simulated smoke is not accepted as staging evidence/i)
  assert.match(decision, /## Approval record/)
  assert.match(smokeTemplate, /Staging Smoke Evidence Template/)
  assert.doesNotMatch(decision, /https?:\/\//)
  assert.doesNotMatch(decision, /approved screenshot/i)

  console.log('staging_smoke_approval.test.ts passed')
}

main()

