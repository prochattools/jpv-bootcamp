import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { DECISION_MANIFEST } from './release/decisionManifest'
import { validateDecisionManifest } from './release/runDecisionReadiness'

function main(): void {
  validateDecisionManifest()

  const ids = DECISION_MANIFEST.map((entry) => entry.id)
  assert.equal(new Set(ids).size, ids.length, 'decision IDs must be unique')
  assert.equal(DECISION_MANIFEST.length, 8, 'every remaining blocker plus rollback and go/no-go must be represented exactly once')

  for (const entry of DECISION_MANIFEST) {
    assert.equal(existsSync(entry.filePath), true, `${entry.filePath} must exist`)
    assert.ok(entry.ownerRole.trim(), `${entry.id} must have an owner role`)
    assert.ok(entry.approverRole.trim(), `${entry.id} must have an approver role`)
    assert.ok(entry.rollbackOwnerRole.trim(), `${entry.id} must have a rollback owner role`)
    assert.ok(entry.allowedStatuses.includes(entry.defaultStatus), `${entry.id} default status must be allowlisted`)
    assert.ok(entry.requiredEvidence.length > 0, `${entry.id} must declare required evidence`)
  }

  console.log('decision_manifest.test.ts passed')
}

main()

