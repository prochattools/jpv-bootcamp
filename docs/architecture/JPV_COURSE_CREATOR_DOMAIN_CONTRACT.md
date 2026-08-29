# JPV Bootcamp Course / Creator Domain Contract

**Status:** A4 COURSE / CREATOR DOMAIN CONVERGENCE COMPLETE — LOCAL REVIEW ARTIFACT

**Date:** 2026-08-28

**Starting A3 HEAD:** `876b127145f0c190fb4dfc253cd6eedb2a724d8d`

**Scope:** behavior-preserving separation of course, module, and lesson
administrator operations from their Server Action transport. This document is
repository evidence for the local A4 packet; it is not production deployment,
database, provider, or branch-integration evidence.

## Actor and transport boundary

The public browser-facing surface remains the Server Action exports in
`src/lib/portalAdmin/courseAdminActions.ts`. Each action now performs only the
transport concerns: it receives the typed request, establishes the
`AdminActor` with `requirePortalAdmin('/portal')`, invokes the appropriate
domain command, returns `PortalAdminActionResult`, and revalidates the affected
course paths. The command modules do not create a second authorization model.

The named `privilegedPayloadAccess()` object is created only after the
administrator gate and is passed to the course persistence boundary. Payload
writes continue to use the existing explicit override reason and no browser
code receives privileged access.

## Pre-refactor behavior matrix

The following behavior was present in the A3 baseline and remains the A4
contract. “Course paths” means `/portal`, `/portal/courses`, and the affected
course route, including the old route when a slug changes.

The former `courseAdminActions.ts` god-file combined the public Server Action
surface with title/slug validation, duplicate checks, course/module/lesson
lookups, parent relationship traversal, dependency checks, Payload create/
update/delete calls, sequential reorder and rollback, plain-text Lexical
conversion, media/Bunny/download field mapping, audit-event construction,
error normalization, and route revalidation. A4 separates those concerns by
ownership while preserving the matrix below.

| Action | Policy and relationship behavior | Persistence and side effects | Result/error contract |
| --- | --- | --- | --- |
| `createCourseAction` | Requires admin; validates title and slug; rejects duplicate slug. | Creates a draft, member-visible course with existing defaults; preserves Lexical description and nullable cover media; writes `course.created`; revalidates course paths. | Returns created ID and slug; duplicate is a conflict; unexpected errors are normalized. |
| `updateCourseAction` | Requires admin; validates only supplied fields; rejects a duplicate replacement slug. | Updates only supplied course fields; `descriptionText` keeps its existing precedence and is serialized through canonical `plainTextToLexical`; writes before/after `course.updated`; revalidates current and old slug paths. | Empty partial updates remain valid; missing course is `not_found`; failures remain bounded. |
| `archiveCourseAction` | Requires admin and uses the existing course update policy. | Sets status to `archived`; retains update audit and course revalidation semantics. | Same normalized update result as before. |
| `deleteCourseAction` | Requires explicit confirmation; requires admin; refuses deletion when modules or enrollments exist. | Deletes only the course after dependency checks; writes `course.deleted`; revalidates the course paths. | Unconfirmed/dependent deletes return the existing validation/conflict errors. |
| `createModuleAction` | Requires admin; validates title; requires the parent course. | Creates a module under the course with existing description, preview, and sort defaults; writes `module.created`; revalidates the course. | Returns created ID; missing parent and unexpected failures are normalized. |
| `updateModuleAction` | Requires admin; validates supplied title and resolves the module's course relationship. | Updates supplied fields with the existing trim/default behavior; writes `module.updated`; revalidates the owning course. | Missing module is `not_found`; safe bounded errors are preserved. |
| `reorderModulesAction` | Requires admin; requires an exact, duplicate-free permutation of the course's modules. | Sequentially updates `sortOrder`; best-effort rolls back the original order if a write fails; writes `modules.reordered`; revalidates the owning course. | Count, membership, duplicate, and rollback conflict messages remain unchanged. |
| `deleteModuleAction` | Requires explicit confirmation; requires admin; refuses deletion when lessons exist. | Deletes only a dependency-safe module; writes `module.deleted`; revalidates the owning course. | Unconfirmed/dependent deletes return the existing validation/conflict errors. |
| `createLessonAction` | Requires admin; validates title and slug; rejects duplicate slug; requires the parent module. | Creates a lesson with existing lock/preview/sort defaults; preserves Lexical content, cover media, Bunny media, and downloads; writes `lesson.created`; revalidates the owning course. | Returns created ID; duplicate and missing relationship errors remain bounded. |
| `updateLessonAction` | Requires admin; validates supplied fields; rejects a duplicate replacement slug; resolves module/course relationships. | Updates metadata, canonical Lexical content, cover media, Bunny media, and downloads without dropping unrelated fields; writes before/after `lesson.updated`; revalidates the owning course. | Missing lesson is `not_found`; errors remain normalized. |
| `reorderLessonsAction` | Requires admin; requires an exact, duplicate-free permutation of the module's lessons. | Sequentially updates `sortOrder`; best-effort rolls back on failure; writes `lessons.reordered`; revalidates the owning course. | Count, membership, duplicate, and rollback conflict messages remain unchanged. |
| `archiveLessonAction` | Requires admin and uses the existing lesson update policy. | Sets `lockState` to `locked`; retains update audit and course revalidation semantics. | Same normalized update result as before. |
| `deleteLessonAction` | Requires explicit confirmation; requires admin; refuses deletion when progress, comments, or resources exist. | Deletes only a dependency-safe lesson; writes `lesson.deleted`; revalidates the owning course. | Unconfirmed/dependent deletes return the existing validation/conflict errors. |

## Bounded implementation

| Boundary | A4 owner | Responsibility |
| --- | --- | --- |
| Transport | `src/lib/portalAdmin/courseAdminActions.ts` | Stable action names/signatures, admin authentication, safe result normalization, and targeted revalidation. |
| Course commands | `src/lib/courseAdmin/courseCommands.ts` | Course input normalization, slug conflict policy, dependency-safe course deletion, audit payloads, and course persistence orchestration. |
| Module commands | `src/lib/courseAdmin/moduleCommands.ts` | Module validation, course relationship resolution, exact reorder policy, rollback-aware persistence orchestration, and audit payloads. |
| Lesson commands | `src/lib/courseAdmin/lessonCommands.ts` | Lesson validation, module/course relationship resolution, content/media/download preservation, dependency-safe deletion, exact reorder policy, and audit payloads. |
| Shared policy | `src/lib/courseAdmin/policy.ts` | Explicit deletion confirmation, exact reorder validation, and duplicate-write classification. |
| Payload persistence | `src/lib/courseAdmin/persistence.ts` | Payload reads, relationship traversal, privileged writes, and sequential reorder with rollback. This layer contains no actor policy or provider calls. |
| Canonical primitives | `src/lib/domain/validation.ts`, `src/lib/domain/relationships.ts`, `src/lib/content/plainTextToLexical.ts`, `src/lib/payloadCourse/events.ts` | Existing validation, relationship-ID, rich-text serialization, and audit primitives remain authoritative. |

The modules are intentionally bounded. A4 does not introduce a giant course
service, a new provider adapter, a second Payload access bypass, or a new
course schema. No Bunny or other media-provider call was moved into the
commands; existing media identifiers remain data passed through the canonical
Payload boundary.

### Deliberate remaining duplication and risks

The stable action names and their small `revalidateCoursePaths()` calls remain
in the transport adapter because existing Creator UI imports depend on that
surface and cache invalidation belongs at the transport boundary. Each command
also retains its own domain-specific audit payload because collapsing course,
module, and lesson events into a generic event would obscure their target
collections and before/after data. The persistence layer intentionally repeats
small typed relationship lookups for the three aggregates rather than creating
a broad generic service. These are bounded compatibility choices, not a
second source of truth. Existing sequential reorders still have a best-effort
rollback rather than a new transaction mechanism; a failed rollback remains an
operational risk recorded by the existing error contract.

## Preservation and exclusions

- Member learning readers, Creator UI callers, routes, action names,
  `PortalAdminActionResult`, audit action names, dependency safeguards, and
  targeted revalidation remain unchanged.
- Rich text still honors the existing `descriptionText`/`contentText`
  precedence and canonical `plainTextToLexical` shape.
- Relationships still accept the existing Payload scalar or populated-object
  shapes and resolve module-to-course and lesson-to-module-to-course ownership
  before writes and revalidation.
- Reorders still require a complete permutation and restore the prior order on
  a failed sequential write where possible.
- No member authorization, provider, database, migration, schema, billing,
  notification, media-storage, or production-runtime behavior is in A4 scope.
- No historical branch was merged, cherry-picked, deleted, rebased, or
  force-pushed. `codex/production-app-flow-fix` was absent from the local ref
  inventory; the other named course/admin branches were already ancestors of
  A3 and had no unintegrated course/admin file delta.

## Validation and rollback

The A4 packet requires the focused course/module/lesson behavior test, the
existing Portal Admin behavioral and inline contract tests, relevant A1/A2/A3
tests, TypeScript, applicable Vitest coverage, documentation/architecture
consistency checks, and `git diff --check`. The implementation is reversible
as a single local A4 commit; no persisted records or external systems are
changed by this packet.

## Next packet boundary

A5 is not started by this contract. Its exact entry point is
Source-of-Truth + Architecture Enforcement: identity/provider ownership,
Payload/Prisma/Stripe projections, the preserved billing candidate review,
architecture guards, privileged-access enforcement, and source-of-truth
documentation. A5 must independently establish its environment and write
authority before any reconciliation or backfill is proposed.
