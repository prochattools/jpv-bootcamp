import assert from 'node:assert/strict'

import {
  LAUNCH_CRITICAL_TEST_MANIFEST,
  buildLaunchCriticalTestManifestReport,
  validateLaunchCriticalTestManifest,
} from './launchCriticalTestManifest'

const packageScripts = {
  'test:payload-member-billing': 'tsx scripts/payload_member_billing_overview.test.ts',
  'test:payload-member-billing-portal': 'tsx scripts/payload_member_billing_portal.test.ts',
  'test:payload-course': 'tsx scripts/payload_entitlement_evaluator.test.ts',
  'test:e2e': 'tsx scripts/e2e/runBrowserTests.ts',
  'test:release': 'tsx scripts/release/runReleaseTests.ts',
  'test:release:full': 'pnpm test:release && pnpm test:e2e',
  'staging:static-preflight': 'pnpm toolchain:check',
  'staging:migration-preflight': 'tsx scripts/release/stagingMigrationPreflight.ts',
  'staging:migration-rehearsal': 'tsx scripts/release/migrationRehearsal.ts',
  'staging:migration-rehearsal:evidence': 'tsx scripts/release/buildMigrationRehearsalEvidence.ts',
  'staging:decision-readiness': 'tsx scripts/release/runDecisionReadiness.ts',
  'staging:provider-simulation': 'tsx scripts/release/providerSimulation.ts',
  'staging:smoke-plan': 'tsx scripts/release/printStagingSmokePlan.ts',
  'staging:smoke-simulated': 'tsx scripts/release/simulatedStagingSmoke.ts',
  'release:evidence:dry-run': 'tsx scripts/release/buildReleaseEvidence.ts',
}

function run(): void {
  const errors = validateLaunchCriticalTestManifest(LAUNCH_CRITICAL_TEST_MANIFEST, packageScripts)
  assert.deepEqual(errors, [])

  const liveReport = buildLaunchCriticalTestManifestReport()
  assert.equal(liveReport.ok, true)

  const report = buildLaunchCriticalTestManifestReport(LAUNCH_CRITICAL_TEST_MANIFEST, packageScripts)
  assert.equal(report.ok, true)
  assert.match(report.output, /LAUNCH CRITICAL TEST MANIFEST/)
  assert.match(report.output, /BILLING - Billing suite/)
  assert.match(report.output, /FRONTEND - Frontend suite/)
  assert.match(report.output, /pnpm test:e2e/)

  const missingScriptPackages = { ...packageScripts }
  delete missingScriptPackages['test:e2e']
  const missingScriptErrors = validateLaunchCriticalTestManifest(LAUNCH_CRITICAL_TEST_MANIFEST, missingScriptPackages)
  assert(missingScriptErrors.some((error) => error === 'missing_package_script:test:e2e'))
}

run()

console.log('launch critical test manifest tests passed')
