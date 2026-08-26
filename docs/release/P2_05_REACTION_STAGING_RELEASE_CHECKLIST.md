# JPV P2-05 Reaction System — Staging Release Checklist

Status: **BLOCKED — preparation complete; staging migration not authorized**
Prepared: 2026-08-24
Scope: staging preparation only. This document does not authorize a migration, deployment, production action, or member-data change.

## 1. Release identity and boundary

| Item | Required value | Evidence/status |
| --- | --- | --- |
| Branch | feature/course-branding-and-preview | Verified current branch |
| Expected commit SHA | e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d | Verified local HEAD and origin feature tip |
| Target environment | staging | Required runner value |
| Staging origin | https://preview.jpvbootcamp.com | Canonical staging lane |
| Target ID | jpvbootcamp-staging | Required runner value |
| Database host | 10.0.2.4 | Guarded staging target |
| Database port | 5433 | Guarded staging target |
| Database | jpvbootcamp | Required runner value |
| Schema | jpvbootcamp_staging | Required runner value |
| Production | Not authorized | Explicit hard stop |

The expected SHA is the current feature-branch tip. The last fresh staging read-only migration evidence was captured against an earlier implementation SHA and is historical; it does not prove that migration 37 has been applied.

## 2. Migration package review

Migration: 20260824_120000_engagement_reactions (migration 37)
Active table: payload_engagement_reactions

### Confirmed properties

- The up migration is additive: it creates the new reaction enum types, active table, foreign keys, check constraint, indexes, and Payload locked-document relation metadata.
- It does not alter, rewrite, backfill, delete, or rename payload_space_reactions.
- It does not insert or update member, community, lesson, billing, or provider data.
- Target-shape validation requires exactly one matching target relation for space_post, space_comment, or lesson_comment.
- Target-specific partial unique indexes enforce one active row per member/target independent of reaction type, preventing duplicate active reactions.
- Foreign keys cascade reaction rows when their target is hard-deleted; member deletion behavior remains governed by the approved member-retention workflow.
- Existing community and lesson access checks remain in the application service layer; the migration does not change their data or access rules.
- Local migration safety and runner contract tests pass.

### Rollback procedure

1. Stop or disable the active reaction write path through the reviewed application rollback process.
2. Obtain separate rollback authorization; the migration authorization does not authorize rollback.
3. Run the read-only rollback plan and verify that migration 37 is the highest applied batch.
4. If the active table is empty, the guarded down migration may remove only the new reaction objects.
5. If active rows exist, the down migration refuses to run. Preserve the table and active rows for a reviewed forward repair; do not delete engagement data as a rollback shortcut.
6. Never roll back, rewrite, or drop payload_space_reactions.

The rollback guard is implemented in src/migrations/20260824_120000_engagement_reactions.ts; the read-only rollback planning path is pnpm staging:payload-migration-rollback-plan.

## 3. Migration execution path

The guarded local runner exists:

~~~text
pnpm staging:payload-migration-plan
pnpm staging:payload-migration-apply
pnpm staging:payload-migration-rollback-plan
~~~

The apply path requires all of the following before it can reach the database:

- exact feature branch and expected 40-character SHA;
- staging environment, target ID, hostname, database, and schema identity;
- clean guarded migration paths;
- pre-apply evidence showing the verified 36-migration state and migration 37 as the sole pending batch;
- protected staging DATABASE_URL;
- the complete operator authorization packet below;
- exact confirmation string apply_engagement_reactions_to_jpvbootcamp_staging.

The runner records pre-apply and post-apply state and returns an uncertain-outcome result if the migration command does not complete cleanly. It does not automatically retry or execute a rollback.

## 4. Deployment and validation requirements

### Deployment workflow

.github/workflows/deploy-preview.yml supports:

- push-gate type check, build, deterministic release tests, and browser E2E;
- manual read-only-migration-plan for staging-only migration evidence;
- manual deploy-preview for the feature branch after separate deployment authorization.

The workflow validates the feature branch, current remote tip, staging origin, Dokploy target, staging schema, database host, and database name. The deployment operation is not part of this preparation package and must not be inferred from migration approval.

### Health checks

The repository defines application health/build identity checks and the preview workflow runs build and release validation before browser validation. After an authorized staging deployment, verify the health endpoint and exact running SHA before any authenticated acceptance claim.

### Browser validation

The defined browser gate is pnpm test:e2e. The post-migration staging acceptance must additionally cover:

- authenticated member add, switch, and remove operations;
- count and viewer-state updates;
- rejection of unauthenticated and cross-member mutation attempts;
- community feed and lesson discussion readability;
- responsive behavior at the project’s approved viewport set;
- no regression in existing portal surfaces.

No authenticated staging reaction validation has been recorded yet. Screenshots or browser artifacts must be linked here only after a real staging run.

## 5. Required operator approval packet

This is a fill-in template, not an approval. Values must be supplied through the approved protected operator channel; secrets must not be committed or pasted into repository documentation.

~~~text
operatorId: <required>
backupEvidenceId: <required>
maintenanceWindowId: <required>
rollbackOwner: <required>

expectedCommit: e6a628ef20af77c8d9c8b6c3f612b81aa8fc201d
environment: staging
targetId: jpvbootcamp-staging
expectedHostname: 10.0.2.4
expectedDatabase: jpvbootcamp
expectedSchema: jpvbootcamp_staging
expectedMigrations: 20260824_120000_engagement_reactions

confirmation: apply_engagement_reactions_to_jpvbootcamp_staging
~~~

The protected staging DATABASE_URL is required at execution time but must not be recorded in this file.

## 6. Pre-apply checklist

- [x] Correct feature branch confirmed.
- [x] Expected SHA confirmed locally and on origin.
- [x] Migration 37 reviewed as additive and isolated from legacy reactions.
- [x] Duplicate-data risk addressed by target-shape checks and target-specific unique indexes.
- [x] Legacy reaction data is not backfilled or mutated.
- [x] Existing community and lesson behavior remains outside the migration’s data scope.
- [x] Guarded apply and rollback-plan paths exist.
- [x] Staging deployment and browser validation requirements are defined.
- [ ] Operator ID supplied.
- [ ] Backup evidence ID supplied.
- [ ] Maintenance window ID supplied.
- [ ] Rollback owner supplied.
- [ ] Protected staging DATABASE_URL available through the approved execution environment.
- [ ] Fresh read-only staging plan returns plan_ok for the expected 36-applied / migration-37-pending state at the exact expected SHA.
- [ ] Migration 37 applied to staging.
- [ ] Post-apply schema and zero-row baseline verified.
- [ ] Exact-SHA staging deployment separately authorized and verified.
- [ ] Authenticated browser acceptance completed.

## 7. Decision

**BLOCKED**

The release package is prepared, but the staging migration is not ready to execute because the required operator authorization packet and protected staging database access are not available. No migration, deployment, or production action is authorized by this document.

## Source evidence

- docs/design/JPV_P2_05_REACTION_ARCHITECTURE_DECISION_PACKAGE.md
- docs/design/JPV_P2_05_REACTION_IMPLEMENTATION.md
- src/migrations/20260824_120000_engagement_reactions.ts
- scripts/release/runStagingPayloadMigration.ts
- .github/workflows/deploy-preview.yml
- scripts/p2_05_reaction_migration_safety.test.ts
- scripts/release/runStagingPayloadMigration.test.ts
