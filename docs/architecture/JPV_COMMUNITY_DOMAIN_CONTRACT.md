# JPV Community Domain Contract

**Status:** A3 COMMUNITY DOMAIN CONVERGENCE COMPLETE — LOCAL REVIEW ARTIFACT

**Date:** 2026-08-27

This document records the community mutation behavior observed immediately
before A3 refactoring. It is the compatibility contract for the shared
community commands. A3 consolidates equivalent post/comment mutation and
moderation choreography; it does not add community features, change the
schema, or change the public result contracts.

## Boundary and actor model

`requirePortalAccess()` resolves either a `MemberActor` or an `AdminActor`.
`requirePortalMember()` is used by create-post/create-comment transports and
also permits an administrator's explicitly linked portal member profile for
member-facing participation. A linked `memberId` never changes an
`AdminActor` into a `MemberActor`: administrator moderation remains available
only through the administrator policy path.

For the existing Payload collections, post/comment reads are administrator
restricted and comment deletion is administrator restricted at the collection
level. The server-side community command boundary therefore performs the
actor/ownership/relationship checks first and uses the existing named service
access override for the final controlled read/write. Administrator commands
receive the A1 `privilegedPayloadAccess()` object; member-owned mutations keep
the existing service behavior and do not create a new page/component bypass.

## Pre-refactor behavior matrix

The matrix describes the behavior of the two transports before A3. “None” in
the audit column is intentional: ordinary member edits/deletes did not emit
administrator audit events, while admin mutations did. Create operations are
included for completeness but remain on the existing authoring service in A3
because their rate limits, moderation queue, member notifications, and
mention flow are not equivalent to the admin moderation operations.

| Operation | Allowed actor | Ownership | Relationship checks | Visibility / moderation | Rate limit | Audit | Notifications | Cache / revalidation | Redirect / result | Error behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create post | Active portal member, including an admin using linked member identity | Active space membership role `member`, `moderator`, or `admin`; no post ownership yet | Space detail must be allowed and membership active | Created visible; Payload authoring service queues moderation according to existing policy | Existing post limit in `src/lib/payloadCourse/communityPosting.ts` | `space_post.created` plus existing moderation audit/queue behavior | Existing moderation/admin and space-member notifications; mentions best effort after create | Member space path revalidated | Redirect to space with `submission=pending`; failures use `submission=error&reason=...` | Rate limit, access, validation, or bounded server reason |
| Edit post | `MemberActor` or `AdminActor` after portal access | Member must own post; admin may edit any post in the expected space | Resolve space by slug; post must belong to that space | Existing moderation state is preserved; body becomes plain-text Lexical for member input, admin may pass Lexical | No edit-specific limit | None for member; admin emits `post.edited` with prior title and title/body-edited result | None | Post detail and space paths revalidated | `{ok:true}` or existing member error object | `space_not_found`, `post_space_mismatch`, `not_owner`, validation, or raw caught server message |
| Delete post | `MemberActor` or `AdminActor` after portal access | Member must own post; admin may delete in expected space | Resolve space by slug; post must belong to that space | Member delete did not apply a comment dependency guard; admin delete refused posts with comments | None | None for member; admin emits `post.deleted` with prior title | None | Member space path; admin community path | `{ok:true}` or existing member error object; admin `PortalAdminActionResult` | Relationship/ownership errors; admin dependency block; bounded admin error |
| Create comment | Active portal member, including an admin using linked member identity | Active membership through the visible post access path | Post detail must be allowed and commentable | Created visible; locked/hidden post is not commentable | Existing comment limit in `src/lib/payloadCourse/communityPosting.ts` | `space_comment.created` plus existing moderation behavior | Existing post-author notification; mentions best effort after create | Post detail and space paths revalidated | Redirect to post with `submission=pending`; failures use `submission=error&reason=...` | Rate limit, access, validation, or bounded server reason |
| Edit comment | `MemberActor` or `AdminActor` after portal access | Member must own comment; admin may edit in expected post/space | Resolve space; post must belong to space; comment must belong to post | Existing moderation state is preserved; body becomes plain-text Lexical for member input, admin may pass Lexical | No edit-specific limit | None for member; admin emits `comment.edited` with body type | None | Post detail path revalidated | `{ok:true}` or existing member error object; admin `PortalAdminActionResult` | `space_not_found`, `post_space_mismatch`, `comment_post_mismatch`, `not_owner`, validation, or bounded admin error |
| Delete comment | `MemberActor` or `AdminActor` after portal access | Member must own comment; admin may delete in expected post/space | Resolve space; post must belong to space; comment must belong to post | Existing moderation state is otherwise unchanged | None | None for member; admin emits `comment.deleted` with display name | None | Post detail path revalidated | `{ok:true}` or existing member error object; admin `PortalAdminActionResult` | Relationship/ownership errors; bounded admin error |
| Pin post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Sets `pinned=true`; does not alter moderation status | No admin rate limit | `post.pinned`, before pinned and after true | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or expected-space mismatch |
| Unpin post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Sets `pinned=false`; does not alter moderation status | No admin rate limit | `post.unpinned`, after false | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or expected-space mismatch |
| Lock post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Sets `locked=true`; prevents new comments through existing read path | No admin rate limit | `post.locked`, after true | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or expected-space mismatch |
| Unlock post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Sets `locked=false` | No admin rate limit | `post.unlocked`, after false | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or expected-space mismatch |
| Hide post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Sets `moderationStatus=hidden` | No admin rate limit | `post.hidden`, prior moderation status and hidden result | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or expected-space mismatch |
| Unhide post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Sets `moderationStatus=visible` | No admin rate limit | `post.unhidden`, visible result | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or expected-space mismatch |
| Admin delete post | `AdminActor` only; confirmation required | Ownership is not relevant | Post must belong to expected space; post with comments is dependency-blocked | Deletes the post only when it has no comments | No admin rate limit | `post.deleted`, prior title | None | `/portal/community` revalidated | `PortalAdminActionResult` | Confirmation, not found, relationship mismatch, dependency block, or bounded admin error |
| Admin edit post | `AdminActor` only | Ownership is not relevant | Post must belong to expected space | Preserves moderation state; accepts bounded text or an existing Lexical root | No admin rate limit | `post.edited`, prior title and title/body-edited result | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, relationship mismatch, validation, or bounded admin error |
| Hide comment | `AdminActor` only | Ownership is not relevant | Comment must belong to expected post; post must belong to expected space | Sets `moderationStatus=hidden` | No admin rate limit | `comment.hidden`, hidden result | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or relationship mismatch |
| Unhide comment | `AdminActor` only | Ownership is not relevant | Comment must belong to expected post; post must belong to expected space | Sets `moderationStatus=visible` | No admin rate limit | `comment.unhidden`, visible result | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, or relationship mismatch |
| Admin edit comment | `AdminActor` only | Ownership is not relevant | Comment must belong to expected post; post must belong to expected space | Preserves moderation state; accepts bounded text or an existing Lexical root | No admin rate limit | `comment.edited`, body type | None | `/portal/community` revalidated | `PortalAdminActionResult` | Admin gate, not found, relationship mismatch, validation, or bounded admin error |
| Admin delete comment | `AdminActor` only; confirmation required | Ownership is not relevant | Comment must belong to expected post; post must belong to expected space | Deletes the comment | No admin rate limit | `comment.deleted`, prior display name | None | `/portal/community` revalidated | `PortalAdminActionResult` | Confirmation, not found, or relationship mismatch |

## A3 shared boundary

The shared command layer is intentionally bounded:

- `src/lib/community/policy.ts` contains deterministic actor/ownership and
  moderation decisions.
- `src/lib/community/persistence.ts` owns space/post/comment lookup,
  relationship verification, update/delete choreography, and the one named
  service access boundary used after policy has passed.
- `src/lib/community/commands.ts` owns edit/delete/moderation validation,
  operation-specific audit semantics, and actor-aware command composition.

The member and administrator transports retain their route-specific concerns:
authentication entry, input extraction, safe result/redirect translation, and
targeted `revalidatePath()` calls. The existing create transports and
`src/lib/payloadCourse/communityPosting.ts` remains deliberate authoring duplication because it
own rate limits, pending moderation, member notifications, and mention
notifications that are not shared with administrator moderation.

No reactions, bookmarks, sharing, UI, schema, migration, provider, billing,
identity, course, or production behavior is part of A3.
