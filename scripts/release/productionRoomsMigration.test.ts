import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import {
	buildMigrationPayload,
	buildRemoteScheduleCommand,
	extractRoomsMigrationUpSql,
	validateImmutableRoomsMigration,
} from './productionRoomsMigration.mts'
import {
	PRODUCTION_ROOMS_BACKUP_EVIDENCE_ID,
	PRODUCTION_ROOMS_BACKUP_SHA256,
	PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
	PRODUCTION_ROOMS_MIGRATION,
	PRODUCTION_ROOMS_MIGRATION_APPLY_CONFIRMATION,
	PRODUCTION_ROOMS_MIGRATION_SOURCE_SHA256,
	PRODUCTION_ROOMS_TARGET,
} from './productionRoomsMigrationConstants'

const migrationSource = readFileSync('src/migrations/20260830_090000_member_portal_rooms.ts', 'utf8')
const controlSource = readFileSync('scripts/release/productionRoomsMigration.mts', 'utf8')
const runnerSource = readFileSync('scripts/release/productionRoomsMigrationRunner.mjs', 'utf8')
const workflowSource = readFileSync('.github/workflows/production-rooms-migration.yml', 'utf8')

const migration = validateImmutableRoomsMigration()
assert.equal(
	createHash('sha256').update(migrationSource).digest('hex'),
	PRODUCTION_ROOMS_MIGRATION_SOURCE_SHA256,
)
assert.equal(migration.sourceSha256, PRODUCTION_ROOMS_MIGRATION_SOURCE_SHA256)
assert.equal(extractRoomsMigrationUpSql(migrationSource), migration.migrationSql)
assert.doesNotMatch(migration.migrationSql, /\$\{schema\}/)
assert.match(migration.migrationSql, /payload_room_categories/)
assert.match(migration.migrationSql, /payload_room_access/)
assert.match(migration.migrationSql, /payload_portal_nav_items/)
assert.doesNotMatch(migration.migrationSql, /DROP\s+(?:TABLE|COLUMN|TYPE)|DELETE\s+FROM|TRUNCATE/i)

const payload = buildMigrationPayload('apply', 'production', {
	operatorId: 'operator-1',
	backupEvidenceId: PRODUCTION_ROOMS_BACKUP_EVIDENCE_ID,
	backupSha256: PRODUCTION_ROOMS_BACKUP_SHA256,
	rehearsalEvidenceId: 'rehearsal-20260830-1',
	rollbackOwner: 'rollback-owner-1',
	maintenanceWindowId: 'maintenance-1',
})
assert.equal(payload.migration, PRODUCTION_ROOMS_MIGRATION)
assert.equal(payload.historicalBaselineSha256, PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256)
assert.equal(payload.registeredPayloadMigrations.length, 53)
assert.equal(payload.registeredPayloadMigrations.at(-1), PRODUCTION_ROOMS_MIGRATION)
assert.equal(payload.targetOrigin, PRODUCTION_ROOMS_TARGET.origin)
assert.equal(payload.applicationId, PRODUCTION_ROOMS_TARGET.dokployApplicationId)
assert.equal(payload.applicationName, PRODUCTION_ROOMS_TARGET.dokploySlug)
assert.equal(PRODUCTION_ROOMS_TARGET.role, 'jpvbootcamp_production_app')

process.env.EXPECTED_PRODUCTION_SHA = '89b3ff16563c902db88734c4f512375f47b4e70b'
const command = buildRemoteScheduleCommand(payload, 'apply-test')
assert.match(command, /ROOMS_MIGRATION_TARGET=production/)
assert.match(command, /JPV_ROOMS_REMOTE_START/)
assert.match(command, /ROOMS_MIGRATION_PAYLOAD_B64=/)
assert.match(command, /\/app\/scripts\/release\/productionRoomsMigrationRunner\.mjs/)
assert.match(command, /sha256sum/)
assert.doesNotMatch(command, /postgres(?:ql)?:\/\//i)
assert.doesNotMatch(command, /DATABASE_URL=/i)
assert.doesNotMatch(command, /(?:PASSWORD|SECRET|API_KEY)=/i)

assert.match(runnerSource, /DEPLOYMENT_ENV !== EXPECTED_PRODUCTION\.deploymentEnv/)
assert.match(runnerSource, /role: 'jpvbootcamp_production_app'/)
assert.match(runnerSource, /jpvbootcamp_staging/)
assert.match(runnerSource, /jpvbootcamp_legacy/)
assert.match(runnerSource, /historicalBaselineMatches/)
assert.match(runnerSource, /compatibility_navigation_restore_failed/)
assert.match(runnerSource, /critical_integrity_changed/)
assert.match(controlSource, /deployment\.allByType\?id=/)
assert.match(controlSource, /deployment\.readLogs\?deploymentId=.*&tail=10000/)
assert.match(controlSource, /scheduleType: 'server'/)
assert.match(controlSource, /sudo -n docker exec/)
assert.match(controlSource, /server\.all/)
assert.match(controlSource, /serverType === serverType/)
assert.match(controlSource, /serverStatus === serverStatus/)
assert.match(controlSource, /Rooms deploy server candidates/)
assert.match(controlSource, /Rooms server inventory/)
assert.match(controlSource, /schedule\.list\?id=.*serverId.*scheduleType=server/)

assert.match(workflowSource, /workflow_dispatch:/)
assert.doesNotMatch(workflowSource, /^\s*push:/m)
assert.match(workflowSource, /plan-rooms-production-migration/)
assert.match(workflowSource, /apply-rooms-production-migration-to-jpvbootcamp/)
assert.match(workflowSource, /finalize-rooms-production-navigation/)
assert.match(workflowSource, /root-domain-image-publish/)
assert.match(workflowSource, /I_2Vukga3cc3ZhaG-mUzU/)
assert.match(workflowSource, /clients-jpv-bootcamp-app-tp9xrk/)
assert.match(workflowSource, /10\.0\.2\.4/)
assert.match(workflowSource, /jpvbootcamp/)
assert.match(workflowSource, /PRODUCTION_DATABASE_ROLE: jpvbootcamp_production_app/)
assert.match(workflowSource, /ROOMS_SOURCE_BRANCH: feature\/member-portal-rooms/)
assert.match(workflowSource, /git ls-remote origin "refs\/heads\/\$ROOMS_SOURCE_BRANCH"/)
assert.match(workflowSource, /20260830_090000_member_portal_rooms/)
assert.equal(PRODUCTION_ROOMS_MIGRATION_APPLY_CONFIRMATION, 'apply-rooms-production-migration-to-jpvbootcamp')

console.log('productionRoomsMigration.test.ts passed')
