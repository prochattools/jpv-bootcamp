# JPV Portal Admin Service Map

**Status:** A2 SERVICE-BOUNDARY FOUNDATION COMPLETE — LOCAL REVIEW ARTIFACT

**Date:** 2026-08-27

This map records the active administrator-facing portal transports and the
service boundaries they currently use. It is a repository map, not a runtime
or production verification. A2 keeps behavior and persistence unchanged; it
consolidates shared validation, relationship-ID extraction, and plain-text
Lexical serialization only.

## Boundary vocabulary

| Layer | Responsibility in A2 | Current repository boundary |
| --- | --- | --- |
| Transport adapter | Receives browser input, establishes the actor, calls a domain operation, and returns a safe result or performs targeted revalidation. | Server Actions in `src/lib/portalAdmin/*` and the portal API routes. |
| Domain operation | Applies the operation's business rules and actor policy. | Course, community, live-session, content, and member services. |
| Persistence | Reads and writes the owning store. | Payload SDK for Payload-owned course/community/member records; provider APIs remain behind server services. |
| Audit | Records actor, target, action, and result/before-after data where the operation already does so. | `src/lib/payloadCourse/events.ts#createAuditEvent`. |
| Cache/revalidation | Refreshes the affected portal route or cache tag after a successful mutation. | `revalidatePath` in action adapters and existing route-level invalidation. |

## Course administration actions

All rows below enter through `requirePortalAdmin('/portal')`, use the typed
privileged Payload access boundary where needed, call Payload course/module/
lesson operations directly in the action adapter, write the existing audit
event, and revalidate the affected course route. The browser components are
transport callers and do not own persistence or authorization.

| Active action | Transport caller | Domain operation/persistence | Audit and cache |
| --- | --- | --- | --- |
| `createCourseAction` | `CreateCourseButton.tsx` | Validate title/slug; create `payload_courses`. | `course.created`; `/portal`, `/portal/courses`, new course path. |
| `updateCourseAction` | `CourseAdminPanel.tsx` | Update `payload_courses`, including description Lexical input. | `course.updated`; course paths. |
| `archiveCourseAction` | `CourseAdminPanel.tsx` | Course status update through `updateCourseAction`. | `course.updated`; course paths. |
| `deleteCourseAction` | `CourseAdminPanel.tsx` | Confirmed delete of a dependency-safe `payload_courses` record. | `course.deleted`; course paths. |
| `createModuleAction` | `CourseAdminPanel.tsx` | Create `payload_course_modules` under a course. | `module.created`; course paths. |
| `updateModuleAction` | `CourseAdminPanel.tsx` | Update a `payload_course_modules` record. | `module.updated`; course paths. |
| `reorderModulesAction` | `CourseAdminPanel.tsx` | Update module sort order under a course. | `module.reordered`; course paths. |
| `deleteModuleAction` | `CourseAdminPanel.tsx` | Confirmed dependency-safe module deletion. | `module.deleted`; course paths. |
| `createLessonAction` | `CourseAdminPanel.tsx` | Create `payload_lessons` under a module. | `lesson.created`; course paths. |
| `updateLessonAction` | `CourseAdminPanel.tsx` | Update lesson metadata/content and canonical Lexical input. | `lesson.updated`; course paths. |
| `reorderLessonsAction` | `CourseAdminPanel.tsx` | Update lesson sort order under a module. | `lesson.reordered`; course paths. |
| `archiveLessonAction` | `CourseAdminPanel.tsx` | Lesson status update through `updateLessonAction`. | `lesson.updated`; course paths. |
| `deleteLessonAction` | `CourseAdminPanel.tsx` | Confirmed dependency-safe lesson deletion. | `lesson.deleted`; course paths. |

## Community administration actions

These actions enter through the same A1 administrator gate and use the existing
community domain logic. Space actions persist to `payload_spaces`; moderation
actions persist to `payload_space_posts` or `payload_space_comments`. Every
successful mutation writes the existing audit event and revalidates the
community/space/post path selected by the adapter.

| Active action | Transport caller | Domain operation/persistence |
| --- | --- | --- |
| `createSpaceAction` | `SpaceAdminPanel.tsx` | Create `payload_spaces`. |
| `updateSpaceAction` | `SpaceAdminPanel.tsx` | Update `payload_spaces`. |
| `archiveSpaceAction` | `SpaceAdminPanel.tsx` | Status update through `updateSpaceAction`. |
| `restoreSpaceAction` | `SpaceAdminPanel.tsx` | Status update through `updateSpaceAction`. |
| `deleteSpaceAction` | `SpaceAdminPanel.tsx` | Confirmed dependency-safe delete of `payload_spaces`. |
| `adminPinPostAction` | `PostModerationPanel.tsx` | Set `pinned` on `payload_space_posts`. |
| `adminUnpinPostAction` | `PostModerationPanel.tsx` | Clear `pinned` on `payload_space_posts`. |
| `adminLockPostAction` | `PostModerationPanel.tsx` | Set `locked` on `payload_space_posts`. |
| `adminUnlockPostAction` | `PostModerationPanel.tsx` | Clear `locked` on `payload_space_posts`. |
| `adminHidePostAction` | `PostModerationPanel.tsx` | Set post moderation status to hidden. |
| `adminUnhidePostAction` | `PostModerationPanel.tsx` | Restore post moderation visibility. |
| `adminDeletePostAction` | `PostModerationPanel.tsx` | Confirmed delete of a post through the existing moderation rules. |
| `adminEditPostAction` | `PostModerationPanel.tsx` | Update post title/body with bounded input and canonical Lexical output. |
| `adminEditCommentAction` | `CommentModerationActions.tsx` | Update comment body with bounded input and canonical Lexical output. |
| `adminDeleteCommentAction` | `CommentModerationActions.tsx` | Confirmed delete of a comment through moderation rules. |
| `adminHideCommentAction` | `CommentModerationActions.tsx` | Set comment moderation status to hidden. |
| `adminUnhideCommentAction` | `CommentModerationActions.tsx` | Restore comment moderation visibility. |

## Other administrator-facing portal transports

These are active surfaces identified during A2 inventory. They remain in their
current boundaries because refactoring them would expand A2 into A3/A4
service restructuring or product behavior change.

| Transport | Current domain/persistence boundary | A2 disposition |
| --- | --- | --- |
| `POST /api/portal/announcements` and `/announcements/media` | Announcement/content services and Payload content/media records; called by `PortalAnnouncementComposer.tsx`. | Mapped only; content consolidation is later packet scope. |
| `GET/POST /api/portal/live-sessions` and `PATCH /api/portal/live-sessions/:id` | `src/lib/liveSessions/*` plus Payload `live_sessions`; LiveKit room state remains provider state. | Mapped only; retain current API helper and lifecycle boundary. |
| `POST /api/portal/reactions` | `src/lib/payloadCourse/reactions.ts`; Payload engagement rows and existing audit/notification behavior. | Mapped only; shared relationship helper consolidated. |
| `POST /api/portal/bookmarks` | Bookmark service and Payload bookmark rows. | Mapped only; no behavior change. |
| `GET/POST /api/portal/notifications` | Member notification records and read/unread state. | Mapped only; no behavior change. |
| Community member Server Actions | `src/app/(frontend)/portal/community/actions.ts` delegates to `communityPosting.ts`, Payload discussion, and notifications. | Shared bounded text and relationship primitives only. |
| Lesson discussion Server Actions/API | Lesson discussion service plus `payload_lesson_comments`. | Shared Lexical and relationship primitives only. |
| `POST/DELETE /api/portal/account/cover` | Member cover-image service and Payload media/profile records. | Shared relationship primitive only. |

## Shared primitives consolidated in A2

| Concern | Canonical module | Compatibility/usage note |
| --- | --- | --- |
| Slug normalization | `src/lib/domain/validation.ts#normalizeSlug` | Preserves the existing lowercase, dash, 2–100 character contract and `PortalAdminActionError` messages. |
| Title validation | `src/lib/domain/validation.ts#validateTitle` | Preserves required/trimmed/200-character behavior. |
| Bounded text | `src/lib/domain/validation.ts#boundedText` | Uses the shared action error type; existing community error translation remains compatible. |
| Record/relationship IDs | `src/lib/domain/relationships.ts#relationshipId` and `#normalizeRelationshipId` | Handles direct string/number IDs and populated objects; arrays remain invalid as a scalar relationship. |
| Plain text to Lexical | `src/lib/content/plainTextToLexical.ts#plainTextToLexical` | Deterministic caller-capped paragraphs with the existing Payload node shape and `direction: 'ltr'`; no silent default character truncation; `buildPlainTextRichText` remains a compatibility facade. |
| Email normalization | `src/lib/normalize-email.ts#normalizeEmail` | Existing canonical helper reused; A2 adds no replacement. |
| Audit event | `src/lib/payloadCourse/events.ts#createAuditEvent` | Retained as the canonical audit primitive; no parallel helper or opaque before/after contract added. |

## Historical branch findings

The comparison was read-only and used ancestry/file-level evidence. No branch
was merged, cherry-picked, deleted, or rewritten.

| Branch | Finding | A2 disposition |
| --- | --- | --- |
| `codex/portal-admin-flow-production` | Tip is an ancestor of this branch; no file delta remains. | Already integrated/superseded; do not replay. |
| `codex/portal-theme-payload-ux` | Tip is an ancestor of this branch; no file delta remains. | Already integrated/superseded; do not replay. |
| `codex/portal-operations-polish` | Tip is an ancestor of this branch; no file delta remains. | Already integrated/superseded; do not replay. |
| `codex/ux-foundation-nonoverlap` | Tip is an ancestor of this branch; no file delta remains. | Already integrated/superseded; do not replay. |
| `feature/course-branding-and-preview` | Tip is an ancestor of this branch; no file delta remains. | Already integrated/superseded; do not replay. |
| `codex/feature-billing-integration` | One unique no-write Stripe reconciliation commit and focused test delta remain. | Still unique but outside A2; preserve unmerged for A5 source-of-truth and architecture-enforcement review. |

## A2 completion and next boundary

A2 is complete when the canonical primitives, this service map, the scoped
documentation updates, focused tests, broader repository checks, and the local
commit are present. A2 does not include UI redesign, data/schema migration,
provider changes, production actions, access-policy changes, service rewrites,
or branch integration. The next packet is A3 Community Domain Convergence. A4
is Course / Creator Domain Convergence; A5 is Source-of-Truth + Architecture
Enforcement; A6 is Full Regression / Controlled Production Integration. These
packets must remain separately authorized and must preserve the source-of-truth
and reconciliation rules before any data backfill is proposed.

## Approved packet sequence after A2

| Packet | Exact ownership |
| --- | --- |
| A3 | Community domain convergence — shared member/admin post/comment mutation and overlapping moderation semantics. |
| A4 | Course / Creator domain convergence — bounded course, module, and lesson services separated from transport actions. |
| A5 | Source-of-truth and architecture enforcement — identity/provider ownership, projections, guards, privileged access, and preserved billing candidate review. |
| A6 | Full regression and controlled production integration — release evidence and the explicit production integration decision, with no feature development. |
