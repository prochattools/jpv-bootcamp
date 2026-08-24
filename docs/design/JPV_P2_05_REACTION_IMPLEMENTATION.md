# JPV P2-05 Reaction Implementation

Status: **BLOCKED_PENDING_SCHEMA_AUTHORIZATION**

P2-05 cannot safely activate member reactions against the current Payload architecture. The existing reaction collection is a historical migration/provenance model, not an active member-owned reaction contract. Per the P2-05 safety rule, implementation stopped before adding services, routes, mutations, or schema changes.

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

## Required schema decision before implementation

An authorized schema design review must choose one of these safe approaches:

### Recommended: additive active collection

Retain `payload_space_reactions` as historical migration evidence and create a separate active collection, for example `payload_engagement_reactions`, with:

- required `member` relationship to `payload_members`;
- `reactionType`: `helpful`, `insightful`, or `celebrate`;
- `targetKind`: `space_post`, `space_comment`, or `lesson_comment`;
- exactly one target relationship: `targetPost`, `targetSpaceComment`, or `targetLessonComment`;
- server timestamps and optional migration/source metadata;
- a database check enforcing target-shape exclusivity;
- target-specific unique indexes enforcing one active reaction per member and target, independent of reaction type;
- indexes supporting target counts and member-owned lookup/removal.

This avoids rewriting historical `like`, `bookmark`, and `survey_vote` rows or changing the meaning of existing leaderboard/bookmark projections.

### Alternative: normalize the existing table

Only after an approved data contract and populated-row preflight could the existing collection be altered. That would require a reversible mapping for legacy rows, separation of bookmark/survey semantics, a lesson-comment target extension, new one-reaction uniqueness, and compatibility updates to every legacy reader. This is higher risk and is not authorized by P2-05.

## Required migration plan — future only

No migration was created or run. An approved future migration packet must contain:

1. Read-only inventory of existing reaction rows, target resolution, actor resolution, and duplicate groups.
2. Decision whether historical rows remain projection-only or are converted into active rows.
3. Additive active collection/table DDL and target foreign keys.
4. Check constraints and target-specific unique indexes.
5. Rollback preflight proving active rows are preserved and no destructive legacy rewrite occurs.
6. Generated Payload types and collection registration only after schema approval.
7. Data-access tests covering counts, add, remove, change, duplicate rejection, hidden targets, and unauthorized targets.

The migration must remain staging-only until separately authorized. It must not be inferred from this document.

## Future runtime and security model

After schema approval, implementation should use a dedicated service boundary rather than direct collection writes:

- derive `memberId` exclusively from the authenticated portal session;
- resolve target access through `evaluatePayloadSpaceAccess` or `evaluatePayloadLessonAccess`;
- require published/visible target state;
- validate that the target belongs to the requested course/space/lesson;
- perform add, remove, and change as idempotent server-owned operations;
- return counts and the current member reaction as a projection;
- reject browser-supplied actor IDs, arbitrary target collections, hidden targets, and direct public collection writes;
- write audit events for active mutations;
- keep counts server-derived and indexed by target.

The existing P2-04 UI remains the presentation boundary. Its reaction control is disabled without an approved handler, so the current application does not expose a misleading mutation path.

## Deferred and explicitly out of scope

- No reaction collection changes.
- No migration creation or execution.
- No reaction API route or server action.
- No reaction persistence or client-side optimistic mutation.
- No comments, threaded replies, bookmarks, sharing, or notifications.
- No changes to historical leaderboard/bookmark behavior.
- No staging, production, database, or infrastructure actions.

## Validation evidence

The architecture preflight confirmed the mismatch using the source files listed above. Existing P2-03 and P2-04 contracts remain the governing UX and service boundaries. P2-05 implementation validation cannot truthfully be reported until schema authorization and migration planning are complete.

## Required authorization to resume

Approve one active reaction storage strategy, its migration/data disposition, and the target/index contract. Until that approval exists, P2-05 remains blocked at the schema boundary and the disabled P2-04 presentation is the correct runtime state.
