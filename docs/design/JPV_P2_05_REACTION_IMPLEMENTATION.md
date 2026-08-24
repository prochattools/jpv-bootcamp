# JPV P2-05 Reaction Implementation

Status: **IMPLEMENTATION_IN_PROGRESS — STAGING_MIGRATION_PENDING**

P2-05 is being implemented against the approved additive architecture. The existing reaction collection remains a historical migration/provenance model and is unchanged. This document records implementation evidence; staging migration and deployment are still pending and production remains unauthorized.

## Preflight decision

The current `payload_space_reactions` collection does **not** safely support the approved P2-03 contract:

| Contract requirement | Current state | Result |
| --- | --- | --- |
| Required authenticated reacting member | `actorMember` is nullable | Cannot prove ownership for every active row. |
| Active reaction vocabulary | `like`, `bookmark`, `survey_vote` | Does not match v1 `helpful`, `insightful`, `celebrate`; bookmark and survey rows are different concepts. |
| Course posts and announcements | `targetKind=post` with `targetPost` | Structurally possible for existing post rows, but no active service or visibility projection exists. |
| Community comments | `targetKind=comment` with `targetComment` | Structurally possible for existing rows, but legacy uniqueness and ownership semantics are insufficient. |
| Lesson discussions | No lesson-comment relationship or target kind | Requires schema extension. |
| One active reaction per member/target | Partial unique indexes include `reactionType` | A member can retain multiple reaction types for one target, contrary to the contract. |
| Change/remove reaction | No member service or mutation path exists | Must be introduced behind an approved active schema. |
| Server-owned counts | No reaction projection or read service exists | Must be introduced with target access checks. |

## Evidence inspected

- `src/collections/community/Community.ts` — `PayloadSpaceReactions` is admin-only and defines nullable `actorMember`, legacy reaction types, `post`/`comment`/`survey_option` targets, and legacy provenance fields.
- `src/migrations/20260817_193300_space_reactions.ts` — creates the same legacy table, partial per-type uniqueness indexes, and rollback protection when populated.
- `scripts/migration/postMigration29ForwardSqlDraft.ts` — preserves the same preparation-only legacy DDL and explicitly treats populated reaction rows as rollback-sensitive.
- `src/lib/payloadCourse/leaderboard.ts` — reads legacy `like` and `bookmark` rows directly for unrelated historical leaderboard/bookmark behavior; this is not an active reaction service.
- `src/lib/payloadCourse/communityDiscussion.ts` and `src/lib/payloadCourse/lessonDiscussion.ts` — provide target visibility and comment access patterns, but no reaction mutation or projection.
- `docs/design/JPV_ENGAGEMENT_ARCHITECTURE_CONTRACT_V1.md` — requires canonical member ownership, target-specific access, one active reaction per target, and future lesson-comment target support.

## Implemented schema decision

### Active collection

Retain `payload_space_reactions` as historical migration evidence and create a separate active collection, for example `payload_engagement_reactions`, with:

- required `member` relationship to `payload_members`;
- `reactionType`: `helpful`, `insightful`, or `celebrate`;
- `targetKind`: `space_post`, `space_comment`, or `lesson_comment`;
- exactly one target relationship: `targetPost`, `targetSpaceComment`, or `targetLessonComment`;
- server timestamps and optional migration/source metadata;
- a database check enforcing target-shape exclusivity;
- target-specific unique indexes enforcing one active reaction per member and target, independent of reaction type;
- indexes supporting target counts and member-owned lookup/removal.

Implemented in `src/collections/community/EngagementReactions.ts`. This avoids rewriting historical `like`, `bookmark`, and `survey_vote` rows or changing the meaning of existing leaderboard/bookmark projections.

### Rejected alternative: normalize the existing table

Only after an approved data contract and populated-row preflight could the existing collection be altered. That would require a reversible mapping for legacy rows, separation of bookmark/survey semantics, a lesson-comment target extension, new one-reaction uniqueness, and compatibility updates to every legacy reader. This is higher risk and is not authorized by P2-05.

## Migration implementation record

Migration name: `20260824_120000_engagement_reactions`

Affected active collection: `payload_engagement_reactions` only. The migration does not alter `payload_space_reactions` and contains no backfill.

The migration contains:

1. Additive active collection/table DDL and target foreign keys.
2. Target-shape check and target-specific one-reaction unique indexes.
3. Locked-document relationship metadata for the new collection.
4. A down guard that refuses rollback when active rows exist.
5. No legacy row insert, update, or delete.

Local migration safety evidence: `scripts/p2_05_reaction_migration_safety.test.ts` passes. The migration has not yet been applied to staging in this evidence record.

The migration must remain staging-only until separately authorized. It must not be inferred from this document.

## Runtime and security model

The implemented service boundary is `src/lib/payloadCourse/reactions.ts` and the server action is `src/app/(frontend)/portal/reaction-actions.ts`:

- derive `memberId` exclusively from the authenticated portal session;
- resolve target access through `evaluatePayloadSpaceAccess` or `evaluatePayloadLessonAccess`;
- require published/visible target state;
- validate that the target belongs to the requested course/space/lesson;
- perform add, remove, and change as idempotent server-owned operations;
- return counts and the current member reaction as a projection;
- reject browser-supplied actor IDs, arbitrary target collections, hidden targets, and direct public collection writes;
- write audit events for active mutations;
- keep counts server-derived and indexed by target.

The existing P2-04 UI remains the presentation boundary. It is now connected only for community posts and lesson-discussion comments. Community-comment reactions, bookmarks, sharing, notifications, and other engagement controls remain outside this implementation scope.

## Deferred and explicitly out of scope

- No changes to `payload_space_reactions`.
- No legacy backfill or historical conversion.
- No direct Payload collection writes from the browser.
- No comments, threaded replies, bookmarks, sharing, or notifications.
- No changes to historical leaderboard/bookmark behavior.
- No production migration, deployment, or data action.

## Local validation evidence

The implementation currently has the following local evidence:

- `pnpm exec vitest run src/__tests__/reactions.test.ts`: 5/5 passed.
- `pnpm exec tsx scripts/p2_05_reaction_migration_safety.test.ts`: PASS.
- Payload types regenerated after collection registration.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm test:release`: PASS, 164/164; the approved migration-order fixture was extended for migration 37.
- `pnpm exec tsx scripts/release/runStagingPayloadMigration.test.ts`: PASS, 151/151.
- Documentation is locally reconciled; staging migration apply evidence remains pending until the guarded staging procedure is run.

Staging read-only evidence captured after the implementation commit:

- Workflow: `deploy-preview.yml`, run `32712482183` (`read-only-migration-plan`).
- Exact branch/SHA: `feature/course-branding-and-preview` / `fb68a41721ea5c343d2b967f262083110a7de877`.
- Target boundary: staging `jpvbootcamp_staging` / `jpvbootcamp` only.
- Sanitized artifact result: `plan_blocked` with `applied_count_mismatch` and `pending_migration_mismatch` because the source registry now contains migration 37 while staging remains at the verified 36-migration state.
- Sanitized staging evidence: `appliedPayloadCount=36`, `prismaHealthy=true`, `unexpectedPayloadCount=0`, `duplicatePayloadCount=0`, and `malformedPayloadCount=0`.
- No migration command, active reaction write, production operation, or deployment was performed by this run.

The next staging apply remains blocked until a fresh authorization packet supplies the exact operator, backup evidence, maintenance window, rollback owner, and protected `DATABASE_URL` through the approved staging execution path.

## Staging and rollback record

Staging migration procedure, still pending:

1. Confirm the exact implementation commit and staging-only database/schema boundary.
2. Capture sanitized pre-migration migration state.
3. Apply only `20260824_120000_engagement_reactions` through the guarded staging runner.
4. Verify the new table, foreign keys, check constraint, indexes, and zero active rows before member use.
5. Run staging authenticated add, switch, remove, count, and unauthorized-mutation checks.

Rollback procedure:

- Before active writes, roll back the application and remove the empty active table only through the guarded down migration.
- After active writes, disable the write path and preserve active rows for forward repair; do not delete engagement data as a rollback shortcut.
- Never roll back or rewrite `payload_space_reactions`.

Changed files:

- `src/collections/community/EngagementReactions.ts`
- `src/collections/community/index.ts`
- `src/migrations/20260824_120000_engagement_reactions.ts`
- `src/migrations/index.ts`
- `src/lib/payloadMigrationRegistry.ts`
- `src/lib/payloadCourse/accessService.ts`
- `src/lib/payloadCourse/reactions.ts`
- `src/app/(frontend)/portal/reaction-actions.ts`
- `src/components/community/EngagementPresentation.tsx`
- community post and lesson page reaction wiring
- `src/payload-types.ts` (generated)
- `src/__tests__/reactions.test.ts`
- `scripts/p2_05_reaction_migration_safety.test.ts`

Current status: implementation is local and staging migration is pending. No staging or production write has occurred in this record. Production remains **NOT AUTHORIZED**.
