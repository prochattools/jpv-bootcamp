import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { RELEASE_TEST_MANIFEST } from './release/releaseTestManifest'

function commandOf(id: string): string | undefined {
  const entry = RELEASE_TEST_MANIFEST.find((item) => item.id === id)
  if (!entry) return undefined
  return [entry.command.executable, ...entry.command.args].join(' ')
}

function main(): void {
  const previewReadiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
  const roadmap = readFileSync('docs/client/ROADMAP_PROGRESS_STATUS.md', 'utf8')
  const operatorHandoff = readFileSync('docs/client/OPERATOR_HANDOFF_SUMMARY.md', 'utf8')
  const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8')
  const migrationRunbook = readFileSync('docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md', 'utf8')
  const providerRunbook = readFileSync('docs/release/PROVIDER_VERIFICATION_RUNBOOK.md', 'utf8')
  const goNoGoChecklist = readFileSync('docs/release/GO_NO_GO_CHECKLIST.md', 'utf8')
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }

  assert.match(architecture, /Canonical `\/portal` account, course, community, partner, support, and billing experience/)
  assert.match(architecture, /\| Admin CMS \| Payload \|/)

  const combined = [previewReadiness, roadmap, operatorHandoff, architecture].join('\n')

  assert.match(combined, /feature\/course-branding-and-preview/)
  assert.match(combined, /\/portal/)
  assert.match(combined, /\/admin/)
  const removedMemberNamespace = new RegExp(`/${'learn'}(?:/|\\b)`)
  assert.doesNotMatch(combined, removedMemberNamespace)

  assert.equal(commandOf('member.portal-mvp'), 'pnpm exec tsx scripts/member_portal_mvp.test.ts')
  assert.equal(commandOf('routes.no-legacy-learn-namespace'), 'pnpm exec tsx scripts/no_legacy_learn_namespace.test.ts')
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.id === 'evidence.core-go-live-readiness'))
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.command.args.join(' ') === 'exec tsx scripts/core_go_live_readiness.test.ts'))
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.id === 'evidence.migration-preflight'))
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.id === 'evidence.staging-smoke-manifest'))
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.id === 'evidence.release-evidence-generator'))

  assert.equal(packageJson.scripts?.['staging:migration-preflight'], 'tsx scripts/release/stagingMigrationPreflight.ts')
  assert.equal(packageJson.scripts?.['staging:smoke-plan'], 'tsx scripts/release/printStagingSmokePlan.ts')
  assert.equal(packageJson.scripts?.['release:evidence:dry-run'], 'tsx scripts/release/buildReleaseEvidence.ts')

  assert.match(migrationRunbook, /Support Requests Migration Runbook/)
  assert.match(migrationRunbook, /pnpm staging:migration-preflight/)
  assert.match(migrationRunbook, /\.\/node_modules\/\.bin\/prisma migrate deploy --schema=prisma\/system\.prisma/)
  assert.match(migrationRunbook, /Primary rollback strategy:\s+restore-based/i)
  assert.match(providerRunbook, /Provider Verification Runbook/)
  assert.match(providerRunbook, /pnpm staging:smoke-plan/)
  assert.match(providerRunbook, /Provider verification is documented but unexecuted\./)
  assert.match(goNoGoChecklist, /Default decision state: `NO-GO`/)
  assert.match(goNoGoChecklist, /pnpm staging:migration-preflight/)
  assert.match(goNoGoChecklist, /pnpm staging:smoke-plan/)
  assert.match(goNoGoChecklist, /pnpm release:evidence:dry-run/)
  assert.match(goNoGoChecklist, /migration applied \| pending until executed/i)
  assert.match(goNoGoChecklist, /provider verification \| pending until executed/i)
  assert.match(goNoGoChecklist, /staging smoke \| pending until executed/i)

  for (const doc of [previewReadiness, roadmap, operatorHandoff]) {
    assert.match(doc, /Migrations applied:\s*`?No`?|No migrations have been applied/i)
    assert.match(doc, /support-request migration remains unapplied|support_requests.*remain unapplied|support-request migration application/i)
    assert.match(doc, /programme remains preview-only|programme content is still blocked|representative programme content/i)
    assert.match(doc, /Provider\/email .*pending|provider\/email .*not executed|provider\/email verification/i)
    assert.match(doc, /staging smoke .*pending|staging smoke .*not executed/i)
    assert.match(doc, /go\/no-go/i)
  }

  assert.match(previewReadiness, /NOT READY FOR CONTROLLED STAGING RELEASE PROCESS/)
  assert.match(previewReadiness, /M2-01.*post-core/i)
  assert.match(previewReadiness, /pnpm test:release.*120\/120/i)
  assert.match(previewReadiness, /pnpm test:e2e.*56\/56/i)
  assert.match(previewReadiness, /pnpm test:release:full/)
  assert.match(previewReadiness, /pnpm staging:static-preflight/)
  assert.match(previewReadiness, /REPOSITORY READY FOR CONTROLLED STAGING OPERATIONS/)
  assert.match(previewReadiness, /pnpm staging:migration-preflight/)
  assert.match(previewReadiness, /pnpm staging:smoke-plan/)
  assert.match(previewReadiness, /pnpm release:evidence:dry-run/)
  assert.match(previewReadiness, /2 moderate/)
  assert.doesNotMatch(previewReadiness, /READY FOR PRODUCTION|production-ready|go-live complete/i)

  assert.match(roadmap, /Core go-live implementation and deterministic local validation are complete/i)
  assert.match(roadmap, /not ready for the controlled staging release process/i)
  assert.match(roadmap, /M0-01 through M0-09/)
  assert.match(roadmap, /M1-01 through M1-06/)
  assert.match(roadmap, /M2-01.*deferred post-core/i)

  assert.match(operatorHandoff, /Last validated readiness baseline: `af6de62 docs: record core go-live readiness`/)
  assert.match(operatorHandoff, /Deterministic non-browser release gate: `pnpm test:release` \(`120\/120`\)/)
  assert.match(operatorHandoff, /Launch browser E2E: `pnpm test:e2e` \(`56\/56`\)/)
  assert.match(operatorHandoff, /M2-01.*deferred post-core/i)
  assert.match(operatorHandoff, /pnpm staging:migration-preflight/)
  assert.match(operatorHandoff, /pnpm staging:smoke-plan/)
  assert.match(operatorHandoff, /pnpm release:evidence:dry-run/)

  console.log('core_go_live_readiness.test.ts passed')
}

main()
