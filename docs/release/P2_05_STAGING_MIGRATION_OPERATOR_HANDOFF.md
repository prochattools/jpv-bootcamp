# JPV P2-05 Staging Migration Operator Handoff

> **HISTORICAL / NON-OPERATIVE — 2026-09-06.** This handoff targets the old
> 2026-08-24 migration-37 candidate. It is not valid for current staging. See
> `REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md` before preparing any
> replacement operator handoff.

Status: **WAITING FOR OPERATOR AUTHORIZATION**

Prepared: 2026-08-24
Scope: final handoff before the controlled staging migration. This document does not authorize or execute migration 37, deployment, database changes, or production actions.

## Migration identity

| Field | Required value |
| --- | --- |
| Migration | 20260824_120000_engagement_reactions |
| Target | jpvbootcamp-staging |
| Database | jpvbootcamp |
| Schema | jpvbootcamp_staging |
| Environment | staging |
| Branch | feature/course-branding-and-preview |
| Expected SHA | e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d |
| Required confirmation | apply_engagement_reactions_to_jpvbootcamp_staging |

## Required approval fields

These values must come from the authoritative operational owners. They must not be inferred from test fixtures, old documents, or production credentials.

| Field | Meaning | Required provider | Current state |
| --- | --- | --- | --- |
| operatorId | Person authorizing and executing the guarded migration. | Authorized release/database operator. | Missing |
| backupEvidenceId | Reference proving staging backup/recovery readiness before mutation. | Database or backup operator. | Missing |
| maintenanceWindowId | Reference to the approved execution window. | Release/change-management owner. | Missing |
| rollbackOwner | Person accountable for rollback decisions and forward repair. | Release or database change owner. | Missing |
| Protected staging DATABASE_URL | Runtime connection to the exact staging database; the secret value must never be exposed in source or logs. | Protected staging execution environment. | Available only inside the protected environment; not supplied to this operator session |

## Authorization record to complete

~~~text
operatorId: <required>
backupEvidenceId: <required>
maintenanceWindowId: <required>
rollbackOwner: <required>

expectedCommit: e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d
environment: staging
targetId: jpvbootcamp-staging
databaseName: jpvbootcamp
schema: jpvbootcamp_staging
migration: 20260824_120000_engagement_reactions
expectedMigrations: 20260824_120000_engagement_reactions

confirmation: apply_engagement_reactions_to_jpvbootcamp_staging
~~~

The DATABASE_URL must be injected through the approved protected execution environment and must not be copied into this handoff.

## Execution sequence after authorization

1. Confirm all approval fields and the protected staging connection are available.
2. Confirm the branch and exact SHA still match the approved identity.
3. Run the fresh read-only migration plan.
4. Confirm the target is jpvbootcamp_staging and migration 37 is the only pending migration.
5. Apply only 20260824_120000_engagement_reactions with the exact confirmation string.
6. Verify the resulting schema state is 37/37 and record the execution timestamp and rollback readiness.
7. Obtain separate staging deployment authorization.
8. Deploy SHA e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d.
9. Verify health, application startup, and schema preflight.
10. Run authenticated create/change/remove/count checks, unauthorized-mutation checks, course/community/discussion regression checks, and responsive validation.
11. Record all evidence in docs/release/P2_05_REACTION_STAGING_VALIDATION.md.

## Safety gates

- Do not proceed if any approval field is blank.
- Do not proceed if the read-only plan reports an unexpected, duplicate, malformed, unhealthy, or additional migration.
- Do not use a database URL whose host, database, or schema does not match the approved staging target.
- Do not deploy before migration 37 and schema preflight pass.
- Rollback planning is read-only and rollback execution requires separate authorization.
- Never modify payload_space_reactions.
- Production, main, billing, member data, and provider data are outside this handoff.

## Current decision

**WAITING FOR OPERATOR AUTHORIZATION**

## Evidence sources

- docs/release/P2_05_STAGING_MIGRATION_AUTHORIZATION_READY.md
- docs/release/P2_05_STAGING_AUTHORIZATION_PACKET.md
- docs/release/P2_05_REACTION_STAGING_RELEASE_CHECKLIST.md
- src/migrations/20260824_120000_engagement_reactions.ts
- scripts/release/runStagingPayloadMigration.ts
- .github/workflows/deploy-preview.yml
