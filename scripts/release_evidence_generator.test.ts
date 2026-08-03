import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildReleaseEvidenceMarkdown } from './release/buildReleaseEvidence'

function main(): void {
  const first = buildReleaseEvidenceMarkdown()
  const second = buildReleaseEvidenceMarkdown()

  assert.equal(first, second)
  assert.match(first, /# Release Evidence Summary/)
  assert.match(first, /Repository readiness outcome: `STAGING HARDENING REMEDIATION REQUIRED`/)
  assert.match(first, /Browser source-level declarations \(static\):/)
  assert.doesNotMatch(first, /Browser test count:/)
  assert.match(first, /not equivalent to Playwright project-expanded collected runs/)
  assert.match(first, /188 collected; 148 passed; 40 skipped; four staging-only spec files not collected/)
  assert.match(first, /Automated staging validation: passed for the exact deployed feature SHA/)
  assert.match(first, /Formal staging sign-off: pending external action/)
  assert.match(first, /Support migration target state: unverified; authorized read-only evidence required/)
  assert.match(first, /Programme content approval: pending/)
  assert.match(first, /No provider verification is claimed as complete\./)
  assert.match(first, /No formal staging acceptance is claimed while external sign-off is pending\./)
  assert.match(first, /The open account-action hardening requirement is not hidden by green functional tests\./)
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
