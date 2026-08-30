import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/deploy-preview.yml', 'utf8')
const runner = readFileSync('scripts/release/runRoomsStagingPayloadMigration.ts', 'utf8')
const rollbackRunner = readFileSync('scripts/release/prepareRoomsStagingRollback.ts', 'utf8')
const rollbackStart = workflow.indexOf('  prepare-rooms-staging-rollback:')
const jobStart = workflow.indexOf('  apply-rooms-migration:')
const jobEnd = workflow.indexOf('  redeploy-staging-candidate:', jobStart)
const applyJob = workflow.slice(jobStart, jobEnd)
const rollbackJob = workflow.slice(rollbackStart)
const redeployStart = workflow.indexOf('  redeploy-staging-candidate:')
const acceptanceStart = workflow.indexOf('  a6-authenticated-acceptance:', redeployStart)
const redeployJob = workflow.slice(redeployStart, acceptanceStart)

assert.ok(jobStart >= 0 && jobEnd > jobStart, 'Rooms migration workflow job must exist as a bounded job')
assert.ok(rollbackStart >= 0, 'Rooms rollback-preparation workflow job must exist')
assert.ok(redeployStart >= 0 && acceptanceStart > redeployStart, 'no-build candidate redeploy job must exist')

for (const required of [
  "inputs.operation == 'prepare-rooms-staging-rollback'",
  'environment: staging-migration-plan',
  'PLAN_READY_FOR_DISPATCH',
  'SOLO_OPERATOR_MODE',
  'DATABASE_URL',
  'TAILSCALE_OAUTH_CLIENT_ID',
  'TAILSCALE_OAUTH_SECRET',
  'DEPLOY_SSH_HOST',
  'DEPLOY_SSH_USER',
  '100.71.47.24',
  '10.0.2.4',
  '5433',
  'jpvbootcamp_staging',
  'jpvbootcamp',
  'prepare-rooms-staging-rollback-to-jpvbootcamp-staging',
  'scripts/release/prepareRoomsStagingRollback.ts',
  './node_modules/.bin/tsx',
  'staging-rooms-rollback-${{ github.run_id }}',
]) {
  assert.match(rollbackJob, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing rollback-preparation control: ${required}`)
}

for (const required of [
  "inputs.operation == 'apply-rooms-migration'",
  'environment: staging-migration-plan',
  'PLAN_READY_FOR_DISPATCH',
  'SOLO_OPERATOR_MODE',
  'ROOMS_MIGRATION_APPROVED',
  'ROOMS_MIGRATION_ROLLBACK_READY',
  'DATABASE_URL',
  'PAYLOAD_SECRET',
  'TAILSCALE_OAUTH_CLIENT_ID',
  'TAILSCALE_OAUTH_SECRET',
  'tailscale/github-action@',
  '10.0.2.4',
  '5433',
  'jpvbootcamp_staging',
  'jpvbootcamp',
  '20260830_090000_member_portal_rooms',
  'apply-rooms-migration-to-jpvbootcamp-staging',
  'scripts/release/runRoomsStagingPayloadMigration.ts',
  'scripts/release/releaseTestManifest.ts',
  './node_modules/.bin/tsx scripts/release/runRoomsStagingPayloadMigration.ts',
  'postApply.missingPayloadMigrations.length !== 0',
  'staging-rooms-migration-${{ github.run_id }}',
]) {
  assert.match(applyJob, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing apply control: ${required}`)
}

for (const required of [
  "inputs.operation == 'redeploy-staging-candidate'",
  'environment: staging-deploy',
  'docker buildx imagetools inspect',
  'ghcr.io/${{ github.repository }}:${EXPECTED_SHA}',
  'clients-jpv-bootcamp-preview-wjfqfd',
  'bZllV93NqsPZAFCsqDskb',
  'https://dokploy.prochat.tools/api/application.update',
  'https://dokploy.prochat.tools/api/application.deploy',
  'EXPECTED_DEPLOYMENT_SHA',
  'staging.jpvbootcamp.com',
]) {
  assert.match(redeployJob, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing redeploy control: ${required}`)
}

assert.match(runner, /ROOMS_STAGING_MIGRATION = '20260830_090000_member_portal_rooms'/)
assert.match(runner, /ROOMS_STAGING_PAYLOAD_MIGRATE_ARGS = \['\.\/node_modules\/\.bin\/payload', 'migrate'\]/)
assert.match(runner, /migration_command_outcome_uncertain/)
assert.match(runner, /candidate_not_in_approved_source/)
assert.match(runner, /postApplyBlockers/)
assert.match(rollbackRunner, /backup_preparation_outcome_uncertain/)
assert.match(rollbackRunner, /backup_directory_not_protected/)
assert.match(rollbackRunner, /staging_database_identity_mismatch/)
assert.match(rollbackRunner, /restore_test_failed/)
assert.match(rollbackRunner, /pg_dump --format=custom/)
assert.match(rollbackRunner, /pg_restore --exit-on-error/)
assert.doesNotMatch(rollbackRunner, /jpvbootcamp_production|jpvbootcamp\.com/i)
const resultValidationIndex = applyJob.indexOf('if ! node - "$RAW_RESULT"')
const artifactCopyIndex = applyJob.indexOf('cp "$RAW_RESULT" rooms-staging-migration-result.json')
assert.ok(resultValidationIndex >= 0 && artifactCopyIndex > resultValidationIndex, 'raw result must be validated before artifact copy')
assert.doesNotMatch(applyJob, /https?:\/\/jpvbootcamp\.com/i)
assert.doesNotMatch(rollbackJob, /application\.deploy|application\.update|migrate:deploy|jpvbootcamp_production/i)
assert.doesNotMatch(applyJob, /application\.deploy|application\.update/i)
assert.doesNotMatch(applyJob, /migrate:deploy|production database|jpvbootcamp_production/i)
assert.doesNotMatch(redeployJob, /payload migrate|migrate:deploy|production database|jpvbootcamp_production/i)

console.log('rooms_staging_release_controls.test.ts passed')
