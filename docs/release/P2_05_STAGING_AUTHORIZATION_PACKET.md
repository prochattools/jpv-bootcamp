# JPV P2-05 Staging Authorization Packet

Status: **TEMPLATE ONLY — BLOCKED pending operator authorization**
Prepared: 2026-08-24
Scope: authorization preparation for migration 37 in staging. This document does not authorize or execute a migration, deployment, database write, or production action.

## Authorization packet

The following fields must be completed through the approved protected operator channel. Do not commit secrets or paste the protected DATABASE_URL into this document.

~~~text
operatorId: <required>
backupEvidenceId: <required>
maintenanceWindowId: <required>
rollbackOwner: <required>

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

The protected staging DATABASE_URL is an execution-time secret. Its availability must be verified in the approved protected environment without recording its value.

## Input availability audit

| Input | Current state |
| --- | --- |
| operatorId | Missing |
| backupEvidenceId | Missing |
| maintenanceWindowId | Missing |
| rollbackOwner | Missing |
| Protected staging DATABASE_URL | Not available in the current execution environment |
| Expected commit binding | Verified: e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d is the local and origin feature tip |
| Environment binding | Verified: staging |
| Database target binding | Verified: jpvbootcamp-staging / jpvbootcamp |
| Schema binding | Verified: jpvbootcamp_staging |
| Migration binding | Verified: 20260824_120000_engagement_reactions |
| Confirmation binding | Exact required value recorded above |

## Release-boundary validation

The reviewed runner and workflow enforce the following controls:

- The required branch is feature/course-branding-and-preview; the runner rejects another branch.
- The expected commit must be a full SHA and must match the checked-out HEAD.
- The environment, target ID, hostname, database, and schema are checked against the approved staging constants.
- Production hostname/database markers are rejected.
- The runner requires a pre-apply state with the verified 36 migrations applied and migration 37 as the sole pending batch.
- The runner requires operator identity, backup evidence, maintenance window, rollback owner, expected migration list, and the exact confirmation string before database execution.
- The read-only migration-plan operation is separate from apply and does not mutate the database.
- The deployment workflow separates validation, read-only migration planning, and manual preview deployment. A push gate cannot bypass migration approval.
- Rollback planning is read-only and rollback execution requires separate authorization.
- The migration down path refuses to remove a populated active reaction table and never rewrites the legacy payload_space_reactions table.

## Approval separation

This packet is not approval to:

- execute migration 37;
- deploy the application;
- apply or roll back any other migration;
- modify members, subscriptions, billing, content, or provider data;
- create reaction records;
- touch production or main.

Migration authorization, deployment authorization, and rollback authorization remain separate decisions.

## Decision

**BLOCKED**

The packet template and boundary checks are prepared, but execution cannot be authorized until all required operational inputs are supplied through the approved protected channel.

## Source evidence

- docs/release/P2_05_REACTION_STAGING_RELEASE_CHECKLIST.md
- src/migrations/20260824_120000_engagement_reactions.ts
- scripts/release/runStagingPayloadMigration.ts
- .github/workflows/deploy-preview.yml
- scripts/p2_05_reaction_migration_safety.test.ts
- scripts/release/runStagingPayloadMigration.test.ts
