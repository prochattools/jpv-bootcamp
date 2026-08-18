# Lesson Discussions and Inline Bunny Video Forward-Schema Draft

**Status:** runtime/collection design implemented in code; physical schema migration intentionally unregistered while migration29 remains the sole canonical pending Payload migration.

This document supersedes the earlier archive-only lesson-comment design and the provisional `payload_lesson_videos` ordered-join design.

## 1. Real lesson discussions

### Implemented target collection

Slug: `payload_lesson_comments`.

Implemented fields:

- `displayName`: required text used for stable historical/member-facing authorship;
- `lesson`: required relationship → `payload_lessons`, indexed;
- `author`: required relationship → `payload_members`, indexed;
- `parent`: optional self relationship → `payload_lesson_comments`, indexed;
- `body`: required Payload Lexical richText;
- `legacyBodyHtml`: exact historical rendered/source HTML retained as migration evidence;
- `moderationStatus`: `visible | pending_review | hidden | deleted`, default `visible`;
- `legacyCommentId`: unique/indexed migration idempotency key;
- `sourceCreatedAt`: original source timestamp;
- `metadata`: source IDs/type/status/migration provenance;
- Payload timestamps enabled.

The collection is registered in Payload config, but direct member collection writes remain closed. Member writes go through the lesson-discussion service layer with `overrideAccess` only after explicit authorization.

### Implemented runtime contract

For active/eligible members with lesson access:

- visible historical/current lesson comments are listed under the lesson;
- members can create new lesson comments;
- members can reply to visible comments in the same lesson;
- reply parents from another lesson are rejected;
- hidden/deleted parents cannot receive replies;
- writes use the same five-comments-per-minute policy as current community comments;
- audit events are recorded;
- member display names come from canonical profile/member identity;
- historical source timestamps are preferred for migrated comments.

Blocked/ineligible/non-enrolled members fail closed at the normal lesson-access boundary and cannot create/reply. Historical authorship remains stored independently of whether the historical author can currently authenticate.

The seven DRY-8 lesson comments are no longer archive-only records. Migration planning creates `payload_lesson_comments` operations for them with real Lexical bodies, human display names, exact `legacyBodyHtml`, source timestamps and deterministic legacy IDs.

### Reaction parity

The current JPV application does **not** contain a generalized reusable reaction collection/runtime that can safely target both `payload_space_comments` and `payload_lesson_comments`. Therefore lesson reactions are not faked through `payload_space_comments` and no polymorphic relation is invented.

Before a lesson-specific reaction collection/runtime is added, the JPV source audit must prove that reactions attached specifically to the seven migrated lesson comments exist and need functional parity. If they do, add the smallest lesson-comment reaction target in the post-migration29 feature-parity migration. If they do not, do not build unused reaction infrastructure solely because FluentCommunity supported reactions generically.

## 2. Inline/multiple Bunny videos

### Source decision

The known multi-video source lesson is FluentCommunity lesson ID `14`, `Lesson 1 - Biblical Foundation & Mindset for New Beginnings` (`slug=lesson-1`). It contains two intentional sequential Bunny embeds:

1. `56266f09-d651-4bc5-a5b0-ac9185018018`;
2. `cda4b492-91af-430d-9bba-4268ccaf8cc2`.

Both are preserved in source order. No silent primary is chosen.

### Implemented target model

The provisional `payload_lesson_videos` ordered join is superseded and should **not** be created.

Inline/multiple legacy videos are represented inside `payload_lessons.content` as custom Lexical `bunnyVideo` blocks containing:

- canonical `videoGuid`;
- Bunny `libraryId`;
- optional title;
- original source URL for provenance.

The migration converter preserves these blocks at the original document position. This preserves not only video order but the surrounding text context that made the source lesson meaningful.

The existing top-level `payload_lessons.bunnyVideo` relationship remains available as an explicit hero/feature-video compatibility field for ordinary existing lessons. It is not used as a substitute for multiple inline source videos.

### Implemented playback security

Inline Bunny blocks use the existing managed signed Bunny player. Lesson playback accepts an optional canonical `videoGuid`, but only after:

1. member authentication;
2. lesson/course entitlement verification;
3. server-side verification that the requested GUID is actually present in that lesson's Lexical `bunnyVideo` block;
4. lookup of that GUID in `bunny_videos`;
5. normal protected Bunny signing.

Arbitrary GUID requests and GUID overrides for page/post targets fail closed.

### Migration planning

- legacy HTML converts deterministically through JSDOM + Payload `convertHTMLToLexical`;
- each recognized Bunny embed becomes a `bunnyVideo` Lexical block in source order;
- one proposed GUID-first `bunny_videos` provider record is still planned for each verified source GUID;
- multi-video lessons no longer propose `payload_lesson_videos` rows and no longer carry `lesson_video_join_schema_registration_required`;
- missing/failed source GUIDs remain hard source-reconciliation failures;
- unsupported non-Bunny embeds are preserved through `legacyHTML` fallback blocks and explicit implementation blockers rather than discarded.

## 3. Rich-text fallback blocks

`LegacyHTMLBlock` and `BunnyVideoBlock` are registered in the Payload Lexical editor configuration.

`LegacyHTMLBlock` stores two forms:

- `html`: exact inert source fragment retained for migration evidence;
- `safeHtml`: deterministic sanitized display form.

The member renderer uses `safeHtml` only and never passes raw `html` to `dangerouslySetInnerHTML`. Scripts, executable attributes and dangerous embedded resources are stripped/replaced in `safeHtml` while exact source evidence remains available to migration/admin review.

Unresolved images remain preserved as fallback blocks and are explicitly blocked on media resolution; they are not silently dropped or flattened.

## 4. Member cover image forward-schema requirement

The implemented `payload_member_profiles.coverImage` upload relationship points to `payload_media` and restores the source-proven FluentCommunity `user_cover_photo` feature.

Runtime behavior already supports:

- historical cover display;
- active member upload/replace/remove;
- blocked/ineligible member mutation denial;
- image MIME/8 MB validation;
- security and audit events;
- retention of the old media document when a relationship is replaced or removed.

The later feature-parity schema migration must include the database relationship/column generated by Payload for `coverImage`; do not rewrite an earlier applied migration to add it.

## 5. Ordering after migration29

Migration29 remains the sole canonical pending migration and is not modified or applied by this work.

Default safe registration sequence after migration29 is separately resolved:

1. complete/apply/rebase migration29 through its existing authorization lane;
2. **Forward A — Bunny GUID-first compatibility:** add nullable `video_guid`, make legacy numeric `video_id` optional, preflight/normalize legacy varchar `lesson_id` to a real `payload_lessons` relationship, then add the FK. Do not assign a dated migration identity yet;
3. **Forward B — lesson-comment physical schema:** register `payload_lesson_comments`, its moderation enum, relationships/indexes, and locked-document relation without changing the already-green discussion runtime;
4. **Forward C — community OG media only:** add `payload_spaces.ogImage -> payload_media`. Raw-source classification now proves the two `space_cover_photo` rows belong to migrated **course** spaces and already target existing `payload_courses.coverImage`; they do not require new schema. The one `space_og_image` row belongs to a migrated **community** space and is the only remaining space-media schema blocker;
5. keep inline `LegacyHTMLBlock` / `BunnyVideoBlock` content inside existing Lexical storage; do **not** create a `payload_lesson_videos` join table;
6. do not add a member headline field because audited source population is zero; do not add executable custom CSS/JS fields because both source values are empty;
7. regenerate Payload types after an eventual authorized schema registration;
8. run the complete read-only real-source regression before any staging-write packet.

No dated migration module, migration registry entry, migration29 file, or migration29 staging runner is changed by this draft.
