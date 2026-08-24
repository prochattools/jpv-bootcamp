# JPV P2-05 Reaction Architecture Decision Package

Status: **FINALIZED FOR APPROVAL — P2-05 remains blocked pending implementation authorization**
Date: 2026-08-24
Scope: architecture and migration decision only

## Decision boundary

This document converts the P2-05 schema blocker into an explicit approval decision. It is not an implementation authorization.

No collection, schema, migration, API, UI, release gate, staging environment, database, or production state is changed by this package. The frozen staging launch-readiness baseline remains untouched.

## Executive recommendation

Approve an **additive active reaction model** in a new `payload_engagement_reactions` collection. Keep `payload_space_reactions` unchanged as historical migration/provenance data and preserve its existing readers for legacy likes, bookmarks, and survey votes.

The active contract should support one member-owned reaction per target, with the v1 vocabulary `helpful`, `insightful`, and `celebrate`, over:

- course posts and announcements represented by `payload_space_posts`;
- community comments represented by `payload_space_comments`;
- lesson discussions represented by `payload_lesson_comments`.

Legacy rows should remain projection-only at first. No automatic backfill should be included in the first active-reaction migration. Historical conversion requires a separate data-disposition approval after a read-only inventory proves actor and target resolution.

This option resolves the blocker with the smallest compatibility surface. Altering `payload_space_reactions` would change the meaning of historical rows, affect direct legacy readers, and require a higher-risk data conversion.

## Evidence and current mismatch

The current blocker document and source inspection establish the following:

| Requirement | Existing `payload_space_reactions` state | Decision impact |
| --- | --- | --- |
| Required active member owner | `actorMember` is nullable | Not safe for active ownership or removal. |
| v1 reaction vocabulary | `like`, `bookmark`, `survey_vote` | Bookmark and survey vote are not the v1 reaction contract. |
| Lesson discussion target | No lesson-comment relationship or target kind | Requires a new target contract. |
| One reaction per member/target | Unique indexes include `reactionType` | A member can hold multiple reaction types for one target. |
| Add/change/remove behavior | No member service or mutation path | Runtime behavior does not exist. |
| Server-owned visibility/counts | No active projection service | Counts could not yet be safely exposed. |
| Compatibility | `leaderboard.ts` reads legacy likes/bookmarks directly | Rewriting the table risks historical behavior and migration evidence. |

Relevant evidence remains in `docs/design/JPV_P2_05_REACTION_IMPLEMENTATION.md`, `src/collections/community/Community.ts`, `src/migrations/20260817_193300_space_reactions.ts`, `src/lib/payloadCourse/leaderboard.ts`, and the existing community/lesson access services.

## A. Target active reaction model

### Collection and ownership

Proposed collection: `payload_engagement_reactions`.

The collection is an operational store for current member engagement, not a replacement for the legacy import/provenance table. Direct browser writes remain closed. The runtime service is the only member-facing mutation boundary; Payload collection access remains administrative or service-controlled, following the existing `adminOnlyCollectionAccess` pattern.

### Proposed fields

| Field | Type and rule | Purpose |
| --- | --- | --- |
| `member` | required relationship to `payload_members`, indexed | Canonical active member owner. It must be derived from the authenticated portal session. |
| `reactionType` | required select: `helpful`, `insightful`, `celebrate`, indexed | The approved v1 reaction vocabulary. |
| `targetKind` | required select: `space_post`, `space_comment`, `lesson_comment`, indexed | Identifies which target relationship is authoritative. |
| `targetPost` | optional relationship to `payload_space_posts`, indexed | Course post or announcement target. |
| `targetSpaceComment` | optional relationship to `payload_space_comments`, indexed | Community comment target. |
| `targetLessonComment` | optional relationship to `payload_lesson_comments`, indexed | Lesson discussion target. |
| `metadata` | server-owned JSON, hidden from member input | Non-authoritative provenance or operational diagnostics only. |
| `createdAt` / `updatedAt` | server timestamps | Current active-reaction lifecycle. |

The implementation must enforce exactly one target relationship and make it agree with `targetKind`:

- `space_post` requires `targetPost` and forbids both comment fields;
- `space_comment` requires `targetSpaceComment` and forbids both other target fields;
- `lesson_comment` requires `targetLessonComment` and forbids both other target fields.

The active collection should not carry legacy `like`, `bookmark`, or `survey_vote` semantics. If provenance is needed later, it must be an explicit source field with no effect on active reaction behavior.

### Uniqueness and indexes

The database contract should provide:

1. A target-shape check constraint enforcing the one-target rule.
2. Target-specific partial unique indexes enforcing one row per `(member, target)` independent of `reactionType`:
   - member + `targetPost`;
   - member + `targetSpaceComment`;
   - member + `targetLessonComment`.
3. Lookup indexes for each target relationship and for member-owned reactions.
4. An index supporting target counts without accepting client-provided counts.

Changing a reaction type updates the existing member/target row inside one transaction. It must not create a second reaction row.

### Deletion behavior

The recommended relational behavior is:

- target deletion cascades the active reaction because the reaction has no independent meaning without its target;
- member deletion is handled by the approved member-retention/privacy policy and must not silently orphan a required `member` relation;
- any member deletion cascade or anonymization behavior must be specified and tested before the migration is authorized.

This member-deletion policy is an approval point, not an assumption to encode during implementation.

## B. Migration and data strategy

### Recommended additive sequence

1. Perform a read-only inventory of legacy rows: actor resolution, target resolution, legacy type, duplicate groups, orphan targets, and source timestamps.
2. Freeze `payload_space_reactions` as historical/provenance storage. Do not rewrite its columns, constraints, indexes, or existing readers.
3. Add the active collection and its database constraints in a new migration only after the model and deletion policy are approved.
4. Register the new collection, regenerate Payload types, and add source-level migration metadata.
5. Start with **new active reactions only**. Do not backfill legacy rows into the active table in the first migration.
6. Add a separate read-only historical projection only if the product later requires old reactions to appear in the new UI.
7. Add runtime/service tests before any staging migration authorization.
8. If staging execution is later authorized, apply only the new additive migration and verify the exact schema, indexes, and empty active-table baseline.

### Legacy data disposition

The default recommendation is **preserve, do not convert**:

- legacy `like` rows remain available to the existing leaderboard/provenance readers;
- legacy `bookmark` rows remain separate from the v1 reaction vocabulary;
- legacy survey votes remain survey data, not active reactions;
- unresolved actors, orphan targets, and duplicate legacy rows remain documented exceptions rather than being guessed into the active contract.

A future backfill may be proposed only with a row-level mapping, duplicate policy, target-resolution report, and separate authorization. It is not part of P2-05 unblocking.

### Rollback considerations

- Application rollback must precede any schema rollback if active code has started writing the new table.
- The active migration must refuse destructive down behavior when active rows exist, consistent with the existing populated-table rollback guard.
- The legacy table must never be dropped or rewritten as part of active-reaction rollback.
- If the new table is empty, a separately authorized down migration may remove only the new table and its indexes.
- If active rows exist, rollback means disabling the active write path and preserving the table for a reviewed forward repair; it is not an instruction to delete engagement data.

## C. Security and abuse-prevention model

### Authorization

- Create, change, and remove require an authenticated active member.
- The member ID is derived from the authenticated portal session; browser-supplied actor IDs are rejected.
- The member must satisfy the same account, enrollment, and access checks used by the relevant target surface.
- Direct public Payload collection create/update/delete remains denied.
- Administrative access is for controlled operations and review, not for impersonating a member through the member endpoint.

### Target visibility

- Space posts and announcements require `evaluatePayloadSpaceAccess`, a published/visible post, and a post belonging to the requested space.
- Community comments require a visible comment whose parent post is visible and accessible in the same space.
- Lesson comments require `evaluatePayloadLessonAccess`, a visible comment, and a comment belonging to the requested lesson.
- Hidden, moderated, orphaned, cross-space, and cross-lesson targets are rejected for both mutation and member-facing projection.

### Mutation behavior

- Add, change, and remove are idempotent service operations.
- Add/change uses a transaction or equivalent conflict-safe upsert guarded by the unique indexes.
- Remove can affect only the authenticated member's row, unless a separately audited administrative moderation operation is approved.
- Counts and the current member reaction are server-derived from visible targets; client-supplied counts are ignored.
- Active mutations write the existing audit/security event pattern.

### Abuse prevention

The service should use a bounded rate limit consistent with the existing community/lesson posting controls, reject unknown reaction types and targets, and handle concurrent duplicate requests without returning a false success. Notifications, sharing, bookmarks, and other engagement behaviors remain outside this decision.

## D. Compatibility impact

| Area | Expected impact under additive design | Required guard |
| --- | --- | --- |
| Community posts/comments | Existing read, moderation, and posting behavior remains unchanged | New reaction service must reuse existing space/visibility checks. |
| Lesson discussions | Existing discussion behavior remains unchanged | New lesson-comment target must reuse `evaluatePayloadLessonAccess`. |
| Legacy leaderboard/bookmarks | No behavior change | Leave `payload_space_reactions` and `leaderboard.ts` untouched. |
| Payload admin | One additional operational collection | Keep member-facing writes closed and document admin handling. |
| Existing APIs | No existing endpoint contract changes | Add a bounded service/API surface only after approval. |
| Release gates | Existing gates should remain unchanged and green | Add focused P2-05 tests; do not weaken or rewrite release assertions. |
| Staging baseline | No change from this package | Any later migration or deployment requires its own explicit task and evidence. |
| Production | No impact and no authorization | Production remains explicitly unauthorized. |

### Risk assessment

| Risk | Level | Mitigation |
| --- | --- | --- |
| Legacy data compatibility | Low with additive storage; high if normalized in place | Preserve legacy table and readers. |
| Constraint/index correctness | Medium | Add target-shape checks, partial unique indexes, and concurrency tests. |
| Access-control leakage | Medium-high | Reuse target access services and test hidden/cross-scope targets. |
| Migration rollback | Medium | Empty-table down guard and application-first rollback. |
| Performance/counts | Medium | Target/member indexes and server-side bounded projections. |
| Product scope expansion | Low if controlled | Keep bookmarks, sharing, notifications, and backfill deferred. |

Overall estimated risk: **Medium** for the recommended additive implementation, with **Medium-high migration and security validation risk** until the focused tests and staging-only schema verification are complete. The in-place normalization alternative is **High risk** and is not recommended.

## Final implementation contract

The following is the normative contract for the next implementation goal. It resolves the architecture questions in this package; it does not authorize code or database changes.

### Data model contract

- Collection: `payload_engagement_reactions`.
- Required owner: `member` relationship to `payload_members`; the value is derived from the authenticated session and is never accepted as authoritative browser input.
- Reaction vocabulary: `helpful`, `insightful`, `celebrate`.
- Target vocabulary: `space_post`, `space_comment`, `lesson_comment`.
- Exactly one target relationship is required and must match `targetKind`.
- One active row is allowed per `(member, targetKind, targetId)`, independent of reaction type.
- Selecting a different type updates the existing row; selecting the current type removes it.
- `metadata` is server-owned and optional; it cannot influence ownership, visibility, counts, or authorization.
- `createdAt` and `updatedAt` are server-controlled timestamps.
- Target-specific foreign keys and partial unique indexes are required, together with the target-shape check constraint.

### Lifecycle contract

| Event | Required behavior |
| --- | --- |
| Create | Authenticate the member, re-evaluate target access and visibility, validate the allowlisted type/target, then insert idempotently. |
| Change | In one transaction, update the member’s existing target row to the new type; never create a second row. |
| Remove | Delete only the authenticated member’s active row for that target and return an idempotent success when no row exists. |
| Deactivated member | A deactivated member cannot mutate or view member-scoped reaction state. Existing active rows remain countable only where the target is visible and the product privacy policy permits aggregate counts. |
| Hard-deleted member | The controlled member-deletion workflow cascades active reaction rows. Audit history is retained without restoring the deleted member or exposing private identity data. |
| Moderated/hidden content | Reactions remain stored while content is temporarily hidden but are excluded from member projections and counts. Restoration makes them eligible again after normal access checks. |
| Hard-deleted content | The target foreign key cascades active reactions. No orphan reaction row is retained. |
| Deleted reaction | Member removal is a hard delete of the active row; the audit event records the action without retaining unnecessary reaction content. |
| Administrative removal | A moderator/admin cannot impersonate a member. A separately audited moderation operation may remove a reaction only if an approved moderation tool and policy exist. |

The hard-delete behavior above is the default contract and must be covered by migration and service tests before execution. The audit record is not a second reaction store.

### Permission contract

- Create/change/remove: authenticated, active, eligible member with access to the target’s course/space/lesson and a visible target.
- View current member state: the same authenticated member, for their own eligible targets.
- View aggregate counts: any viewer permitted to view the target; private or members-only targets never expose counts outside the target access boundary. Counts exclude hidden/deleted targets and are server-derived.
- Moderator/admin read: existing controlled administrative access for review and diagnostics; no implicit member impersonation.
- Moderator/admin delete: not part of the member API; only a future audited moderation operation may perform it.
- Public collection writes: denied. The browser cannot choose `member`, collection IDs, target collections, or counts.

### API boundary contract

Use a domain service behind thin same-application server actions:

- `getReactionSummary(target)` returns visible counts, the current member’s reaction when authenticated, and capability flags;
- `setReaction(target, reactionType)` creates or changes the authenticated member’s reaction;
- `removeReaction(target)` removes the authenticated member’s reaction.

Server actions are the primary browser boundary because the current member portal is a same-application Next.js surface. A dedicated API route is not required for v1; it may be added later only for an approved non-browser consumer. Direct Payload REST/collection mutations are not allowed.

Validation is layered:

1. The server action validates input shape and allowlisted enum values.
2. The domain service derives the member, evaluates target access, checks visibility and scope, applies rate limits, and performs the idempotent mutation.
3. Database constraints enforce target shape, foreign keys, and uniqueness under concurrency.

Errors return typed, non-sensitive results: `unauthenticated`, `ineligible`, `target_not_found`, `target_inaccessible`, `target_hidden`, `invalid_reaction`, `rate_limited`, or `conflict`. Do not reveal whether an inaccessible target exists. Revalidation is limited to the affected course/community route.

### Migration contract

A new additive migration is required for the active collection. It must not alter the existing `payload_space_reactions` table or its readers. The first migration creates an empty active table; it does not backfill legacy rows.

Staging migration procedure, future authorization required:

1. Confirm the approved commit and clean migration diff.
2. Capture a sanitized pre-migration schema and legacy row-disposition snapshot.
3. Verify staging identity and schema boundary.
4. Apply only the new additive migration through the existing guarded runner.
5. Verify table, foreign keys, target checks, indexes, and zero active rows.
6. Run focused service/schema tests and the unchanged release gate.
7. Record the exact migration result and stop before any production action.

Production migration procedure, future-only and separately authorized:

1. Approve a production change window, backup/restore evidence, operator, rollback owner, and monitoring plan.
2. Promote the exact tested artifact; do not rebuild or hand-edit migration SQL.
3. Verify production database identity and migration preconditions before execution.
4. Apply the same additive migration once, verify constraints/indexes, and keep the active write path disabled until application verification passes.
5. Enable the feature only after application health, authorization, counts, and rollback checks pass.
6. Record post-migration evidence and retain the legacy table unchanged.

No staging or production migration is authorized by this document.

### Rollback contract

- Before active writes: roll back the application artifact; the empty active table may be removed only through a separately approved down migration.
- After active writes: roll back the application write path first and preserve the active table; do not delete user engagement as a rollback shortcut.
- If the active table is empty after a verified write-path shutdown, a guarded down migration may remove only the new table and indexes.
- If active rows exist, recovery is forward-compatible repair or reviewed data export/reconciliation, not destructive rollback.
- The legacy `payload_space_reactions` table and its migration history are never part of this rollback.

## Recommended decision

Approve the following bounded architecture:

1. Create a new `payload_engagement_reactions` active collection.
2. Support `helpful`, `insightful`, and `celebrate`.
3. Support `space_post`, `space_comment`, and `lesson_comment` targets with exactly one target relationship per row.
4. Enforce one active reaction per member/target, independent of reaction type.
5. Preserve `payload_space_reactions` and its legacy readers unchanged.
6. Do not backfill legacy rows in the initial migration.
7. Implement member mutations only through a server-side service that reuses existing access checks, audit events, and rate-limit patterns.

This finalizes the architecture contract and unblocks preparation of an implementation task without authorizing implementation, migration execution, staging deployment, or production work.

## Required approval points

Explicit approval is required for each item below before implementation begins:

1. The active collection name, fields, reaction vocabulary, target vocabulary, and uniqueness contract.
2. The decision to preserve legacy rows without initial backfill.
3. Member-deletion behavior for required active reaction ownership.
4. The staging-only migration execution and verification scope.
5. The member service/API boundary, rate limit, audit event, and count-projection contract.
6. The later UI activation scope, separately from this schema decision.

Until these approvals are recorded, P2-05 remains blocked at the authorization boundary. The contract is finalized for review; it is not self-approving.

## Implementation checklist after approval

- [ ] Record product/engineering approval for this exact contract.
- [ ] Add `payload_engagement_reactions` collection config with fail-closed collection access.
- [ ] Add the additive migration, target-shape checks, foreign keys, and target-specific unique indexes.
- [ ] Register the migration and regenerate Payload types.
- [ ] Implement the reaction domain service and thin server actions.
- [ ] Implement access, visibility, ownership, idempotency, rate limits, and audit events.
- [ ] Add read projections for counts, viewer reaction, and capability flags.
- [ ] Add focused unit/contract tests for every lifecycle, permission, target, and concurrency rule.
- [ ] Connect the existing P2-04 presentation only after service and security tests pass.
- [ ] Run typecheck, focused P2-05 tests, community/lesson regression tests, documentation checks, and the unchanged release gate.
- [ ] Obtain separate staging migration/deployment authorization and capture fresh evidence.

## Migration checklist

- [ ] Read-only legacy inventory completed and sanitized.
- [ ] Legacy actor, target, duplicate, orphan, and source-time dispositions documented.
- [ ] No-backfill decision recorded for the initial active migration.
- [ ] Active table starts empty and is independent of legacy readers.
- [ ] Target-shape check and all three target-specific uniqueness indexes verified.
- [ ] Foreign-key deletion behavior verified for target and member deletion workflows.
- [ ] Migration runner registry and generated types agree.
- [ ] Staging-only rehearsal/authorization recorded before any apply operation.
- [ ] Rollback preflight proves legacy preservation and active-row safety.
- [ ] Production procedure remains future-only and separately authorized.

## Security checklist

- [ ] Member identity comes only from the authenticated portal session.
- [ ] Public Payload writes and direct browser collection mutations remain denied.
- [ ] Space, community-comment, and lesson-comment access evaluators are reused.
- [ ] Hidden, pending-review, deleted, cross-scope, and orphan targets fail closed.
- [ ] Counts are server-derived and do not disclose inaccessible content.
- [ ] One-member/one-target uniqueness is enforced under concurrent requests.
- [ ] Add/change/remove operations are idempotent and rate-limited.
- [ ] Moderator/admin operations cannot impersonate a member.
- [ ] Active mutations emit the existing audit/security events.
- [ ] Error responses do not reveal inaccessible-target existence or private identity data.

## Architecture finalization validation

The finalization task is complete only when the following evidence is recorded:

- documentation consistency checks pass;
- the architecture/preflight check passes;
- existing UX/architecture tests pass;
- the release gate remains unchanged and green;
- the staged diff contains documentation only;
- no Payload collection, migration, API, UI, database, staging, or production state changed.

## Exact implementation steps after approval

These are the next steps only after the approvals above; none are performed by this package:

1. Add the approved active collection config and additive migration.
2. Generate Payload types and verify the migration registry/import map.
3. Add the reaction service for list/current, add/change, and remove operations.
4. Enforce authenticated member ownership, target visibility, target scope, idempotency, rate limits, and audit events.
5. Add focused tests for schema constraints, duplicate/concurrent writes, target access, hidden targets, ownership, removal, and counts.
6. Add the smallest approved API/server-action boundary and connect the existing P2-04 presentation only after service tests pass.
7. Run typecheck, focused P2-05 tests, existing community/lesson regression tests, documentation checks, and the unchanged release gate.
8. If separately authorized, perform staging-only migration and deployment verification with fresh evidence. Do not infer production authorization from staging success.

## Explicit non-actions and final status

This package makes no code, schema, migration, UI, release-gate, staging, database, or production changes. The current P2-04 reaction presentation remains disabled until an approved service exists, which prevents a misleading mutation path.

**Decision status: APPROVAL REQUIRED.**
**P2-05 status: BLOCKED_PENDING_SCHEMA_AUTHORIZATION.**
**Production: NOT AUTHORIZED.**
