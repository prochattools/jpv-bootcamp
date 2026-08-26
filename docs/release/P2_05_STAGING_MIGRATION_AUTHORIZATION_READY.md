# JPV P2-05 Staging Migration Authorization Readiness

Status: **READY FOR AUTHORIZATION — execution remains blocked pending operational inputs**

Prepared: 2026-08-24

This document prepares the approval record for migration 37. It does not authorize or execute a migration, deploy an application, change a database, create reaction records, or affect production.

## Approved execution identity

| Field | Required value | Current evidence |
| --- | --- | --- |
| Expected SHA | e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d | Local HEAD and origin feature tip match |
| Branch | feature/course-branding-and-preview | Verified |
| Environment | staging | Runner allow-list |
| Database target | jpvbootcamp-staging | Runner target ID |
| Database name | jpvbootcamp | Guarded staging database |
| Database host/port | 10.0.2.4:5433 | Guarded staging network target |
| Schema | jpvbootcamp_staging | Guarded staging schema |
| Migration | 20260824_120000_engagement_reactions | Canonical migration 37 |
| Confirmation | apply_engagement_reactions_to_jpvbootcamp_staging | Exact runner requirement |

## Required authorization inputs

| Input | Why it is required | Authoritative origin/provider | Current state |
| --- | --- | --- | --- |
| operatorId | Identifies the person executing the guarded database change and binds the audit record to an accountable operator. | Authorized release/database operator through the project’s change-control channel. | Missing |
| backupEvidenceId | Proves that the approved staging backup or recovery evidence exists before the mutation. | Database owner or backup operator, using the approved backup/evidence system. | Missing |
| maintenanceWindowId | Confirms the staging change is scheduled inside an approved change window. | Release/change-management owner. | Missing |
| rollbackOwner | Names the accountable person responsible for rollback decisions and forward-repair coordination. | Release owner or database change owner. | Missing |
| Protected staging DATABASE_URL | Provides runtime access to the exact staging database while keeping credentials out of source control and logs. | Protected staging environment secret, supplied through the approved CI/operator execution environment. | Missing from this execution environment |

Values must not be inferred from test fixtures, old approvals, documentation examples, or production credentials. The DATABASE_URL value must never be written into this document.

## Authorization packet to complete

~~~text
operatorId: <provided by authorized release/database operator>
backupEvidenceId: <provided by database backup operator>
maintenanceWindowId: <provided by change-management owner>
rollbackOwner: <provided by release/database owner>

expectedCommit: e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d
environment: staging
databaseTarget: jpvbootcamp-staging
targetId: jpvbootcamp-staging
databaseName: jpvbootcamp
databaseHost: 10.0.2.4
databasePort: 5433
schema: jpvbootcamp_staging
migration: 20260824_120000_engagement_reactions
expectedMigrations: 20260824_120000_engagement_reactions

confirmation: apply_engagement_reactions_to_jpvbootcamp_staging
~~~

## Technical readiness assessment

### Migration execution

The guarded runner is ready once the operational inputs exist. It:

- requires the exact feature branch and full expected SHA;
- rejects production markers and mismatched staging host/database/schema identity;
- requires migration 37 to be the sole pending batch after the verified 36-migration state;
- requires the exact migration name and confirmation string;
- performs pre-apply and post-apply state checks;
- reports an uncertain outcome instead of automatically retrying or rolling back.

The migration itself is additive, does not backfill or mutate payload_space_reactions, and has a populated-table rollback guard.

### Deployment pipeline

The preview workflow has separate operations for validation, read-only migration planning, and manual staging deployment. The deploy operation does not bypass the migration authorization gate. Application startup independently requires the migration preflight to pass, so migration 37 must be applied and verified before deployment.

### Rollback

Rollback planning is read-only and requires separate authorization. An empty active reaction table may be removed only through the guarded down migration. If active rows exist, the down migration refuses to delete them; the write path must be disabled and a forward repair reviewed. The legacy payload_space_reactions table is never rewritten or dropped.

### Production boundary

The approved runner and workflow are restricted to the feature branch and staging target. Production and main are outside this packet. This document does not authorize any production migration, deployment, provider mutation, billing action, member action, or branch advancement.

## Pre-execution sequence after authorization

1. Confirm all five operational inputs above through the protected channel.
2. Run a fresh read-only migration plan at the exact expected SHA.
3. Confirm the plan reports 36 applied, migration 37 as the sole pending batch, healthy Prisma state, and zero anomalies.
4. Apply only migration 37 with the exact confirmation string.
5. Verify post-apply state is 37/37 and record rollback readiness.
6. Obtain separate staging deployment authorization, deploy the exact SHA, and verify health and running SHA.
7. Perform authenticated reaction validation and write the staging evidence document.

## Decision

**BLOCKED**

The technical path is prepared, but authorization cannot be completed until the five operational inputs are supplied through their authoritative protected sources.

## Evidence sources

- docs/release/P2_05_STAGING_AUTHORIZATION_PACKET.md
- docs/release/P2_05_REACTION_STAGING_RELEASE_CHECKLIST.md
- src/migrations/20260824_120000_engagement_reactions.ts
- scripts/release/runStagingPayloadMigration.ts
- scripts/release/start-staging.sh
- .github/workflows/deploy-preview.yml
- scripts/p2_05_reaction_migration_safety.test.ts
- scripts/release/runStagingPayloadMigration.test.ts
