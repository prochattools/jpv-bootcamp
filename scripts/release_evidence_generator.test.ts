import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildReleaseEvidenceMarkdown } from './release/buildReleaseEvidence'

function main(): void {
  const first = buildReleaseEvidenceMarkdown()
  const second = buildReleaseEvidenceMarkdown()

  assert.equal(first, second)
  assert.match(first, /# Release Evidence Summary/)
  assert.match(first, /Repository readiness outcome: `STAGING MIGRATION COMPLETE`/)
  assert.match(first, /Browser source-level declarations \(static\):/)
  assert.doesNotMatch(first, /Browser test count:/)
  assert.match(first, /not equivalent to Playwright project-expanded collected runs/)
  assert.match(first, /188 collected; 148 passed; 40 skipped; four staging-only spec files not collected/)
  assert.match(first, /run `31215369413` at reviewed code checkpoint `9e068cc8b0a5ec9573732fee3a78bed9995787a6` returned `plan_ok`/)
  assert.match(first, /28 Payload migrations applied/)
  assert.match(first, /20260804_050000_member_account_action_reservations` solely missing/)
  assert.match(first, /Prisma healthy/)
  assert.match(first, /zero unexpected, duplicate, or malformed Payload migration evidence/)
  assert.match(first, /fresh guarded read-only pre-apply plan must return `plan_ok` at the eventual final CI-green SHA/)
  assert.match(first, /current candidate is not claimed as deployed/)
  assert.match(first, /Formal staging sign-off: pending external action/)
  assert.match(first, /Support schema migration state: covered by the healthy expected Prisma history and sole-missing-Payload result/)
  assert.match(first, /live support-flow smoke remains pending after exact-SHA deployment/)
  assert.match(first, /Programme content approval: pending/)
  assert.match(first, /Migration 29 is not claimed as applied/)
  assert.match(first, /No current-candidate staging deployment is claimed\./)
  assert.match(first, /No provider verification is claimed as complete\./)
  assert.match(first, /No formal staging acceptance is claimed while external sign-off is pending\./)
  assert.match(first, /No production migration or deployment is claimed\./)
  assert.match(first, /Launch-scope repository implementation is complete; migration 29 apply, exact-SHA staging deployment, smoke, and external acceptance remain pending\./)
  assert.doesNotMatch(first, /Migration preflight: documented, read-only, pending operator execution/)
  assert.doesNotMatch(first, /Support migration target state: unverified/)
  assert.doesNotMatch(first, /Account-action hardening is implemented locally/)
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
