import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'
import {
  REGISTERED_PAYLOAD_MIGRATIONS,
  REGISTERED_PRISMA_MIGRATIONS,
} from './buildStagingMigrationStatus'
import {
  PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
  PRODUCTION_ROOMS_PROTECTED_ORDERING_ANOMALIES,
} from './productionRoomsMigrationConstants'
import {
  PRODUCTION_MIGRATION_PREFLIGHT_CONTROL,
  buildPreflightRunIdentity,
  buildRemoteVerifierBundle,
  buildServerScript,
  selectCorrelatedDeploymentId,
  validateProductionMigrationStatusReport,
  validateStaticProductionTargetContract,
} from './productionMigrationStatusControl.mts'

const workflow = readFileSync('.github/workflows/production-info-forum-migration.yml', 'utf8')
const controller = readFileSync('scripts/release/productionMigrationStatusControl.mts', 'utf8')
const remoteEntry = readFileSync('scripts/release/productionMigrationStatusRemoteEntry.ts', 'utf8')
const verifier = readFileSync('scripts/release/verifyProductionMigrationStatus.ts', 'utf8')

validateStaticProductionTargetContract()

assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.controlBranch, 'codex/production-migration-preflight-20260907')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.candidateSha, '8b1f459fed358776fda791553ef225cc9f03b2ae')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha, 'f93ffac7dd299c39d8daf242d6a436272cc79188')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.origin, 'https://jpvbootcamp.com')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApplicationId, 'I_2Vukga3cc3ZhaG-mUzU')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokploySlug, 'clients-jpv-bootcamp-app-tp9xrk')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databaseHost, '10.0.2.4')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databasePort, '5433')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.database, 'jpvbootcamp')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.schema, 'jpvbootcamp')
assert.equal(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databaseRole, 'jpvbootcamp_production_app')
assert.deepEqual(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.migrationRegistryPaths, [
  'prisma/migrations',
  'src/migrations',
  'src/lib/payloadMigrationRegistry.ts',
])

assert.equal(ENVIRONMENT_TOPOLOGY.production.origin, PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.origin)
assert.equal(ENVIRONMENT_TOPOLOGY.production.dokployApplicationId, PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApplicationId)

assert.match(workflow, /Guarded Production Info Forum Consolidation/)
assert.match(workflow, /environment: root-domain-image-publish/)
assert.match(workflow, /run_migration_status_preflight:/)
assert.match(workflow, /if: inputs\.run_migration_status_preflight != 'yes'/)
assert.match(workflow, /if: inputs\.run_migration_status_preflight == 'yes'/)
assert.match(workflow, /codex\/production-migration-preflight-20260907/)
assert.match(workflow, /8b1f459fed358776fda791553ef225cc9f03b2ae/)
assert.match(workflow, /f93ffac7dd299c39d8daf242d6a436272cc79188/)
assert.match(workflow, /pnpm install --frozen-lockfile/)
assert.match(workflow, /productionMigrationStatusControl\.mts/)
assert.match(workflow, /production:info-forum:control/)
assert.doesNotMatch(workflow, /productionRoomsMigration|migrate deploy|\bseed\b|\bbackfill\b/i)

assert.match(controller, /\/application\.one\?/)
assert.match(controller, /schedule\.create/)
assert.match(controller, /schedule\.runManually/)
assert.match(controller, /schedule\.delete/)
assert.match(controller, /migration_registry_differs_from_serving_image/)
assert.match(controller, /remote_control_branch_moved/)
assert.doesNotMatch(controller, /process\.env\.DATABASE_URL|DATABASE_URL\s*=/)

assert.match(verifier, /BEGIN TRANSACTION READ ONLY/)
assert.match(verifier, /ROLLBACK/)
assert.match(verifier, /method: 'GET'/)
assert.doesNotMatch(verifier, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\s+/i)
assert.doesNotMatch(verifier, /\bprisma\s+migrate\b|\bmigrate\s+deploy\b|\b(?:db|payload):(?:reset|seed|cleanup|init)\b/i)
assert.doesNotMatch(remoteEntry, /DATABASE_URL|password|secret/i)

const bundle = buildRemoteVerifierBundle()
assert.ok(bundle.bytes.length > 0)
assert.match(bundle.sha256, /^[0-9a-f]{64}$/)
assert.match(bundle.gzipBase64, /^[A-Za-z0-9+/]+={0,2}$/)

const runIdentity = buildPreflightRunIdentity({
  GITHUB_RUN_ID: '34119571332',
  GITHUB_RUN_ATTEMPT: '2',
  EXPECTED_SOURCE_SHA: '1234567890abcdef1234567890abcdef12345678',
})
assert.deepEqual(runIdentity, {
  scheduleName: 'jpv-production-migration-read-only-34119571332-a2-1234567890ab',
  logMarker: 'JPV_PRODUCTION_MIGRATION_PREFLIGHT_RUN_34119571332-a2-1234567890ab_START',
})
assert.throws(() => buildPreflightRunIdentity({
  GITHUB_RUN_ID: '34119571332',
  GITHUB_RUN_ATTEMPT: '0',
  EXPECTED_SOURCE_SHA: '1234567890abcdef1234567890abcdef12345678',
}), /github_run_attempt_invalid/)

const baselineDeploymentIds = new Set(['deployment-old'])
assert.equal(
  selectCorrelatedDeploymentId(
    baselineDeploymentIds,
    { deploymentId: 'deployment-new' },
    { deployments: [{ deploymentId: 'deployment-old' }, { deploymentId: 'deployment-new' }] },
  ),
  'deployment-new',
)
assert.equal(
  selectCorrelatedDeploymentId(
    baselineDeploymentIds,
    {},
    { deployments: [{ deploymentId: 'deployment-old' }] },
  ),
  null,
)
assert.throws(
  () => selectCorrelatedDeploymentId(
    baselineDeploymentIds,
    { deploymentId: 'deployment-new-a' },
    { deployments: [{ deploymentId: 'deployment-new-b' }] },
  ),
  /schedule_run_deployment_ambiguous/,
)

const serverScript = buildServerScript(bundle, runIdentity.logMarker)
assert.match(serverScript, /clients-jpv-bootcamp-app-tp9xrk/)
assert.match(serverScript, /ghcr\.io\/prochattools\/jpv-bootcamp:f93ffac7dd299c39d8daf242d6a436272cc79188/)
assert.match(serverScript, /container_count/)
assert.match(serverScript, /docker inspect/)
assert.match(serverScript, /sha256sum/)
assert.match(serverScript, /JPV_PRODUCTION_MIGRATION_PREFLIGHT_RUN_34119571332-a2-1234567890ab_START/)
assert.match(serverScript, /DEPLOYMENT_ENV=production/)
assert.match(serverScript, /EXPECTED_DEPLOYMENT_SHA='f93ffac7dd299c39d8daf242d6a436272cc79188'/)
assert.match(serverScript, /--mode=production-read-only/)
assert.match(serverScript, /--expected-schema=jpvbootcamp/)
assert.match(serverScript, /--acknowledge-read-only/)
assert.doesNotMatch(serverScript, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\s+/i)
assert.doesNotMatch(serverScript, /migrate deploy|\bseed\b|\bbackfill\b|stripe|billing|application\.deploy/i)
assert.throws(
  () => buildServerScript(bundle, 'JPV_PRODUCTION_MIGRATION_PREFLIGHT_REMOTE_START'),
  /preflight_log_marker_invalid/,
)

const validReport = {
  result: 'VERIFIED',
  mode: 'production-read-only',
  target: {
    origin: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.origin,
    database: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.database,
    schema: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.schema,
    role: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databaseRole,
  },
  deployedRevision: {
    expectedSha: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha,
    observedCommitSha: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha,
    observedImageTag: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha,
    source: 'deployment-health',
  },
  migrationLedger: {
    payload: {
      expected: [...REGISTERED_PAYLOAD_MIGRATIONS],
      applied: [...REGISTERED_PAYLOAD_MIGRATIONS],
      pending: [],
      unexpected: [],
      duplicate: [],
      malformedRows: 0,
      orderingAnomalies: [...PRODUCTION_ROOMS_PROTECTED_ORDERING_ANOMALIES],
      historicalBaseline: {
        expectedSha256: PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
        observedSha256: PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
        matches: true,
      },
    },
    prisma: {
      expected: [...REGISTERED_PRISMA_MIGRATIONS],
      pending: [],
      unexpected: [],
      duplicate: [],
      statuses: REGISTERED_PRISMA_MIGRATIONS.map((name) => ({ name, status: 'applied' })),
    },
  },
  rollbackReadiness: {
    mutationPerformed: false,
    readOnlyTransaction: true,
    action: 'none',
    note: 'synthetic control test',
  },
  blockers: [],
}

assert.equal(validateProductionMigrationStatusReport(validReport), validReport)
assert.throws(() => validateProductionMigrationStatusReport({
  ...validReport,
  deployedRevision: {
    ...validReport.deployedRevision,
    observedCommitSha: '0000000000000000000000000000000000000000',
  },
}), /migration_status_revision_mismatch/)
assert.throws(() => validateProductionMigrationStatusReport({
  ...validReport,
  migrationLedger: {
    ...validReport.migrationLedger,
    payload: {
      ...validReport.migrationLedger.payload,
      pending: [REGISTERED_PAYLOAD_MIGRATIONS.at(-1)],
    },
  },
}), /payload_migration_status_mismatch/)
assert.throws(() => validateProductionMigrationStatusReport({
  ...validReport,
  rollbackReadiness: {
    ...validReport.rollbackReadiness,
    mutationPerformed: true,
  },
}), /migration_status_read_only_contract_mismatch/)

console.log('productionMigrationStatusControl.test.ts passed')
