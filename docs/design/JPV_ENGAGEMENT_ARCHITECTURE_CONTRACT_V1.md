# JPV Bootcamp Engagement Architecture Contract v1

Date: 2026-08-24
Status: architecture contract only; implementation not authorized
Scope: Phase 2.3 Engagement Architecture Foundation

## Decision summary

JPV should add engagement as a set of explicit, member-owned service contracts over existing learning and community objects. The UI must not write directly to Payload collections. Each mutation must resolve the member, re-evaluate access to the target, enforce idempotency and rate limits, record an audit event where appropriate, and return a projection shaped for the current surface.

This document is a design contract, not a schema or migration authorization. It does not implement reaction buttons, comment mutations, bookmarks, sharing, notifications, or follower systems.

## Current repository findings

The current Payload model already contains the following relevant collections:

| Existing collection | Current role | Contract finding |
| --- | --- | --- |
| `payload_members` | Canonical member identity | Required actor owner for all member engagement. Never trust a client-supplied actor ID. |
| `payload_spaces` | Community container and access boundary | Primary access context for community posts, comments, files, and future engagement. |
| `payload_space_memberships` | Space membership, role, and status | Must be checked together with the existing entitlement/access evaluator. |
| `payload_space_posts` | Community post and moderation state | Reaction, bookmark, share, and comment targets may reference this object. |
| `payload_space_comments` | Community comments and moderation state | Currently has post and author relationships but no parent relationship. Threading is not yet available in the community projection. |
| `payload_space_reactions` | Existing likes/bookmarks/survey-vote projection | Historical/forward storage exists, but the active product contract is not approved. It currently combines different concepts and permits nullable actors. |
| `payload_lessons` | Course learning object | Lesson engagement is a separate target family and must not be forced into a space-only target model. |
| `payload_lesson_comments` | Lesson comments with optional `parent` | Existing lesson discussion proves the intended parent-comment pattern, but its contract is separate from community comments. |
| `payload_audit_events` | Security and operational audit trail | Use for moderation, ownership-sensitive changes, and security-relevant share actions. |

The existing `payload_space_reactions` migration contains `like`, `bookmark`, and `survey_vote`, plus post/comment/survey-option target columns and uniqueness indexes keyed by actor, type, and target. That is useful migration evidence, but it is not sufficient proof of the desired member-facing contract: it does not express the proposed reaction vocabulary, it conflates bookmarks with reactions, and its nullable actor field is incompatible with a member-owned action unless legacy rows are explicitly separated.

## UX requirements

### Shared requirements

- Every control must state what object it affects and whether the action is complete, pending, or unavailable.
- The current member’s state must be returned with the target projection so the UI does not infer ownership from counts.
- Counts are aggregate context only; they must never reveal private members or private-space activity.
- Hidden, pending, deleted, locked, and inaccessible targets must not leak body, author, reaction, or bookmark information.
- Optimistic UI is optional and must have an explicit rollback state. The first implementation should prefer confirmed server responses.
- Keyboard focus, touch targets, disabled states, errors, and retry behavior must follow the JPV design authority.
- No engagement control is shown where the member cannot perform the corresponding action.

### Reactions

Reactions are lightweight acknowledgement, not a discussion substitute. The first approved vocabulary should be deliberately small:

- `helpful` — this advanced my understanding;
- `insightful` — this added a useful perspective;
- `celebrate` — this recognizes progress or a milestone.

The product should allow at most one active reaction per member per target. Selecting another type changes the existing reaction; selecting the active type again removes it. A target may display aggregate counts for supported types and the current member’s selected type. Reaction changes are idempotent and must not create duplicate rows.

The v1 target policy is explicit:

| Content surface | Payload target | Reaction policy |
| --- | --- | --- |
| Course-linked community posts | `payload_space_posts` in a space linked to `payload_courses` | Supported when the post is published, visible, and the member can access the space. |
| Lesson discussions | `payload_lesson_comments` attached to an accessible lesson | Supported for visible root discussion comments only in v1; reacting to the lesson article itself is deferred until a lesson-target contract is approved. |
| Community comments | `payload_space_comments` | Supported for visible comments on accessible posts. |
| Announcements | `payload_space_posts` with `postType=announcement` | Uses the post reaction policy; no special public visibility or notification behavior is implied. |

Lesson comments and community comments remain distinct target families even though both are “comments” in the UX. A future service projection may present them consistently, but it must preserve their collection-specific access and moderation rules.

### Comments

Comments remain member-authored, access-scoped content. A comment belongs to one community post and one canonical member. The member-facing service, not the collection endpoint, owns creation, edit, delete, moderation transitions, rate limiting, and projection.

#### Current comment capabilities

Current capabilities are intentionally asymmetric:

- Community posts support member-facing creation of posts and flat comments through the existing service layer. Community comments currently have no parent relationship, so the member projection is a flat list. Moderation supports visible, pending-review, hidden, and deleted states; general member edit/delete behavior is not an approved active contract.
- Lesson discussions support member-facing creation and replies through `payload_lesson_comments.parent`. The current lesson service validates same-lesson parents, rejects hidden parents, applies access checks and rate limits, and renders a bounded recursive presentation. This is evidence for a future pattern, not permission to change community collections in this phase.
- Both surfaces retain canonical author identity and historical/source timestamps where available. Neither surface may expose a hidden or pending comment through a member engagement projection.

The proposed community threading model is bounded: a root comment may have direct replies, but the active UI should not create unbounded reply depth. The future schema should use an optional self-relationship (`parent`) with a same-post invariant and a service-enforced maximum depth of two levels. The implementation may preserve deeper historical relationships as migration evidence, but it must not expose arbitrary depth without a deliberate UX and performance review.

Comments are ordered by a stable server rule: pinned/moderator-highlighted content first only when explicitly supported, then oldest-first for learning discussion or newest-first for activity feed views. The ordering must be named by the surface; there is no implicit “best” ranking in v1.

### Bookmarks

Bookmarks are private member saves, not reactions. V1 bookmarkable objects are:

- published community posts the member can read;
- published lessons the member can access.

Comments are not bookmarkable in v1 because saving a comment without its parent discussion creates poor retrieval context. A bookmark is owned by exactly one member, has one target, is idempotent, is not visible to other members, does not affect public counts, and can be removed without changing the target. Retrieval is member-scoped, paginated, and ordered by most recently saved. The existing bookmark-like reaction rows must be treated as historical input and reconciled deliberately before any active bookmark UI is enabled.

### Sharing

V1 sharing is internal-link sharing only. A member may copy or send a canonical JPV route for a target they can access. Opening the link always re-evaluates access; a copied URL is not an entitlement, token, or public disclosure mechanism.

External/public sharing is not approved for private or members-only community content. If public sharing is later requested, it requires an explicit visibility model, expiring or revocable share token design, comment visibility rules, abuse controls, analytics/privacy review, and a separate release decision. V1 tracking is limited to privacy-preserving operational audit when a share action is actually introduced; no recipient graph or social distribution model is proposed.

## Proposed future data model

These are proposals for a later implementation/migration plan only.

### Reaction record

Prefer a normalized reaction record with:

| Field | Requirement |
| --- | --- |
| `member` | Required relationship to `payload_members`; derived from the authenticated session. |
| `targetKind` | Explicit target discriminator: `space_post`, `space_comment`, or `lesson_comment`. |
| `targetPost` / `targetSpaceComment` / `targetLessonComment` | Exactly one target relationship according to `targetKind`; a polymorphic target is acceptable only if its access and indexing behavior are proven. |
| `reactionType` | Active v1 vocabulary: `helpful`, `insightful`, or `celebrate`. Historical types remain migration-only. |
| `createdAt` / `updatedAt` | Server timestamps for idempotency and audit support. |
| `source` / `metadata` | Optional migration provenance; never client-controlled for active writes. |

The uniqueness contract is `(member, targetKind, targetId)` for one active reaction per target. If the existing table is reused, the future migration must normalize its nullable actor/target semantics, add the lesson-comment target shape, separate bookmark and survey-vote legacy rows, and replace the current per-type uniqueness with the active one-reaction invariant. A new collection is acceptable only if the migration review shows that modifying the existing historical table would make provenance or rollback less safe.

### Community comment record

Extend the existing community comment model only through an approved future migration:

- required `post` relationship;
- required canonical `author` relationship;
- optional self-relation `parent`;
- required rich-text `body`;
- moderation status using the existing visible/pending-review/hidden/deleted vocabulary;
- created/updated timestamps and optional source timestamp/provenance;
- indexes for `post`, `parent`, `author`, moderation status, and creation order.

The service must reject a parent from another post, a hidden/deleted parent, and depth beyond the approved limit. Historical orphan or unresolved parent records must remain reviewable rather than silently becoming unrelated visible comments.

### Bookmark record

Use a separate member-owned bookmark model rather than extending the reaction type enum:

- required `member` relationship;
- explicit `targetKind` of `space_post` or `lesson`;
- one target relationship according to the discriminator;
- server timestamps;
- unique `(member, targetKind, targetId)` constraint;
- member-scoped read access and admin-only operational access;
- no public aggregate count and no cross-member visibility.

This separation prevents bookmark retrieval/privacy semantics from being confused with reaction counts and preserves the meaning of legacy `bookmark` rows during reconciliation.

### Share intent

Do not add a share record until internal sharing is approved for implementation. If tracking is required later, model a privacy-minimized `shareEvent` with actor, target, channel, and timestamp, with no recipient list by default. A share event must never grant access or reveal the target to an unauthorized viewer.

## Permissions model

| Operation | Member | Moderator/admin | System/migration |
| --- | --- | --- | --- |
| Read visible target | Existing target access only | Existing administrative access | Controlled operational access |
| Add/change/remove own reaction | Allowed when target is visible and member is eligible | Same member rules unless an explicit admin tool is approved | Migration-only provenance path |
| Add own bookmark | Allowed for accessible published posts/lessons | Same member rules; no impersonation | Migration-only reconciliation |
| Create comment/reply | Allowed when the community post or lesson discussion is open, member is eligible, and rate limit passes | Allowed through same service or explicit moderation tool | Migration-only import path |
| Edit/delete own comment | Allowed under an explicit time/content policy | Moderation action through admin service | Never silently rewrite source evidence |
| Hide/delete another member’s content | No | Moderator/admin according to space role and audit policy | Controlled reconciliation only |
| Internal share/copy link | Only if target access allows it | Same or broader only if approved | Not applicable |
| External/public share | Not approved in v1 | Not approved in v1 | Not applicable |

Collection access remains fail-closed. Public collection writes stay closed. Server actions call domain services that perform access evaluation, target validation, idempotency, rate limiting, mutation, and audit in a deliberate order.

## API and service boundaries

Future member-facing services should be separate from Payload collection configuration:

- `engagementReactionService`: get summary, set/change, remove;
- `engagementCommentService`: list projection, create, reply, edit, delete, report/moderate boundary;
- `engagementBookmarkService`: list, save, remove;
- `engagementShareService`: resolve approved internal link/share intent only.

Each service accepts a canonical `memberId` from the authenticated session and a target identifier. It must not accept an actor/member identifier from the browser as authority. The UI consumes projections such as `countByType`, `viewerReaction`, `viewerBookmarked`, `canReact`, `canBookmark`, `canComment`, `canShare`, and an explicit target context (`coursePost`, `lessonDiscussion`, `comment`, or `announcement`).

Server actions should remain thin adapters. They validate form/input shape, call one service, revalidate the affected route, and return or redirect with a typed result. They must not duplicate Payload queries or bypass existing `evaluatePayloadSpaceAccess`/lesson access logic.

## Moderation and visibility

The existing moderation states remain the canonical visibility vocabulary:

- `visible`: eligible for member projection when the target is accessible;
- `pending_review`: hidden from ordinary members until approved;
- `hidden`: not projected to ordinary members;
- `deleted`: retained as audit/history state but not rendered.

Reaction and bookmark projections must be derived only from visible targets. Counts must not include hidden/deleted content unless an administrator explicitly requests a moderation view. Reports, moderation decisions, and ownership-sensitive changes require existing audit-event patterns. Rate limits should be applied per member and target action, with safe retry behavior and no duplicate side effects.

## Performance and indexing

Future implementation must use bounded, projection-oriented queries:

- paginate feed posts and comments instead of returning an unbounded collection;
- query comments by `post` plus moderation state and stable creation order;
- query replies by `parent` plus creation order;
- query reactions by target and by member/target uniqueness;
- query bookmarks by member and recent timestamp;
- keep Payload relationship depth at the minimum needed for the projection;
- select only fields needed by the member surface;
- avoid N+1 member, space, and target lookups through request-level deduplication or batched reads;
- use compound indexes when the filter and sort pattern is stable and evidence shows the query is hot.

Payload’s official guidance supports indexes for frequently queried/sorted fields, minimum relationship depth, selected fields, and bounded pagination. These are design inputs, not permission to add indexes now.

## Future-only migration plan

No migration is authorized in this phase. When implementation is approved, the sequence should be:

1. Freeze and inventory existing reaction/bookmark rows, including legacy IDs, null actors, target shape, and unresolved targets.
2. Decide whether `payload_space_reactions` is normalized in place or preserved as historical projection with a new active collection.
3. Define and test the active reaction vocabulary, one-reaction uniqueness, target constraints, and bookmark separation in a migration contract test.
4. Add the community comment parent relationship only after same-post, depth, orphan, moderation, and rollback behavior are specified.
5. Backfill or project data in staging-only rehearsal mode; never silently convert unresolved or private records.
6. Add service-layer read paths behind feature flags while existing UI remains unchanged.
7. Run duplicate/idempotency, access, moderation, pagination, and rollback tests.
8. Enable one feature at a time: comments/threading first, bookmarks next, reactions next, internal sharing last.
9. Capture operator evidence and obtain explicit authorization before any staging write or production consideration.

## Risks and decisions still required

| Risk/decision | Why it matters | Required resolution |
| --- | --- | --- |
| Existing reaction table conflates concepts | Active UI could expose legacy semantics or permit duplicate reactions | Normalize in place or choose a new active model before implementation; add lesson-comment target support deliberately |
| Community comments lack parent | UI cannot truthfully render nested replies today | Approve parent relation, depth limit, orphan handling, and migration policy |
| Historical rows have nullable actor/legacy targets | Counts and ownership can be wrong | Separate historical/projection rows from active member-owned rows |
| Private-space sharing | A URL can become an accidental disclosure path | Keep internal-only until token/visibility/privacy review passes |
| Counts and feed queries at scale | Naive per-row queries cause latency and inconsistent projections | Define pagination, select/depth, batching, and index evidence before UI |
| Moderation timing | Pending content must not leak through aggregates or cached projections | Test every service and projection against all moderation states |
| Reaction vocabulary | “Like” may not fit a professional learning context | Product owner must approve the three v1 types before schema work |

## Comparable-system research and applicable patterns

The following systems were reviewed for patterns, not copied:

- [Fluent Community: comments and reactions](https://fluentcommunity.co/docs/handling-comments-reactions/) — supports comments, replies, media attachments, moderation actions, reporting, pinning, and progressive “view more” handling. Applicable pattern: treat moderation and long-thread disclosure as first-class; do not copy its reaction vocabulary or UI density.
- [Circle: spaces and space groups](https://api.circle.so/get-started/concepts/spaces-and-space-groups) — uses spaces as both content containers and access gates, with public/private/secret visibility. Applicable pattern: keep space context and access semantics together in the member projection.
- [Circle: post concepts](https://api.circle.so/get-started/concepts/posts) — separates post types and returns structured post metadata, body, author, and space context. Applicable pattern: make target type and context explicit in projections.
- [Circle: moderation settings](https://help.circle.so/p/administration/moderation/manage-moderation-settings) — supports preemptive moderation, reports, and space-specific post/comment controls. Applicable pattern: moderation state must be explicit and independently configurable; do not copy Circle’s product scope.
- [Canvas Basics Guide](https://community.canvaslms.com/html/assets/Canvas_Basics_Guide.pdf) — distinguishes focused discussions with limited nesting from threaded discussions with deeper nesting, and supports collapsed reply groups. Applicable pattern: choose a bounded thread model intentionally for learning contexts rather than assuming infinite nesting.
- [Payload access control](https://payloadcms.com/docs/access-control/overview) — supports operation-specific collection/global/field access and evaluates permissions before operations. Applicable pattern: keep member engagement behind operation-specific fail-closed access.
- [Payload relationship fields](https://payloadcms.com/docs/fields/relationship) — supports required/unique/indexed relationships, validation, filtering, and controlled depth. Applicable pattern: use explicit target relationships and enforce invariants at both validation and service layers.
- [Payload indexes](https://payloadcms.com/docs/database/indexes) and [querying](https://payloadcms.com/docs/queries/overview) — recommend indexes for frequent filters/sorts, bounded limits, selected fields, and minimal relationship depth. Applicable pattern: design projections and indexes around observed query shapes.
- [Payload Join field](https://payloadcms.com/docs/fields/join) — provides reverse admin/API visibility without duplicating relationship storage. Applicable pattern: store each ownership relationship once and derive reverse views rather than duplicating IDs.

Accessed 2026-08-24. External sources establish comparable patterns; the repository’s existing collections and access services remain authoritative for JPV implementation decisions.

## Validation boundary

This contract is documentation-only. Completion validation must prove:

- the contract file contains the four engagement domains and all required permission/service/performance/migration sections;
- documentation consistency checks pass;
- existing UX and architecture checks pass;
- the release gate remains green;
- no application behavior, schema, migration, deployment, or production state changes occurred.

No implementation goal may begin until this contract is explicitly approved and converted into a separate, bounded implementation task.
