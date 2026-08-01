import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildReleaseEvidenceMarkdown } from './release/buildReleaseEvidence'

function main(): void {
  const first = buildReleaseEvidenceMarkdown()
  const second = buildReleaseEvidenceMarkdown()

  assert.equal(first, second)
  assert.match(first, /# Release Evidence Summary/)
  assert.match(first, /Repository readiness outcome: `STAGING IMPLEMENTATION AND ACCEPTANCE COMPLETE`/)
  assert.match(first, /Go\/No-Go checklist: present, default state remains `NO-GO`/)
  assert.match(first, /Support migration: unapplied/)
  assert.match(first, /Programme content approval: pending/)
  assert.match(first, /No provider verification is claimed as complete\./)
  assert.match(first, /No staging smoke is claimed as passed\./)
  assert.match(first, /No production-live status is claimed\./)
  assert.doesNotMatch(first, /Provider verification:\s*complete/i)
  assert.doesNotMatch(first, /Staging smoke:\s*passed/i)
  assert.doesNotMatch(first, /Repository readiness outcome: `READY FOR PRODUCTION`/i)
  assert.doesNotMatch(first, /sk_live_|sk_test_|pk_live_|pk_test_|whsec_|postgresql:\/\//i)

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['release:evidence:dry-run'],
    'tsx scripts/release/buildReleaseEvidence.ts',
  )

  console.log('release_evidence_generator.test.ts passed')
}

main()
