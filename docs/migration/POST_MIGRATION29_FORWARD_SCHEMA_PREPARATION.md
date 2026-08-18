# Post-Migration29 Forward-Schema Preparation

**Status:** preparation only. This is not a dated migration module and must not be registered or applied while migration29 remains the sole canonical pending migration.

**Reviewed application checkpoint:** `43d569211acde5ae80f6e33524d40d432b417ce8`.

## Current authority

The latest read-only real-source regression against the verified SQL/WXR/Stripe/Bunny bundle passes with:

- 48 source accounts → 47 canonical members → 11 active / 36 blocked;
- 104/104 WXR attachments mapped;
- zero missing Bunny GUIDs;
- 47 xprofile-backed member profiles;
- one `portalSettings` Global operation;
- 935 proposed operations;
- 179 blocked operations, including 117 community-reaction operations gated on Forward D schema registration;
- 14 unresolved relationships.

The 14 unresolved relationships are now fully classified:

- 6 × `bunny_target_schema_guid_first_compatibility_required`;
- 7 × `lesson_comment_schema_registration_required`;
- 1 × `space_media_schema_registration_required`.

The previous three generic space-media target decisions are closed. Source classification proves:

- 2 × `space_cover_photo:migratedCourseSpace` → existing `payload_courses.coverImage`;
- 1 × `space_og_image:migratedCommunitySpace` → future `payload_spaces.ogImage`.

The two course-cover imports still require binary media execution, but they do **not** require new schema.

## Registration gate and ordering

No dated migration30 is authorized by this document. Do not create, register, apply, stage, or deploy a forward migration until the migration29 authorization/order lane is explicitly resolved.

When that lane is resolved, prepare one reviewed forward migration packet in this deterministic order:

1. **Forward A — Bunny GUID-first compatibility**
2. **Forward B — `payload_lesson_comments` physical schema**
3. **Forward C — `payload_spaces.ogImage` relationship**

The ordering is intentional: Bunny compatibility closes existing runtime/table drift first; lesson comments then register an already-running target model; the single community OG field is last and additive.

The exact preparation-only PostgreSQL fragments and read-only preflight/rollback guard queries are compiled as inert strings in `scripts/migration/postMigration29ForwardSqlDraft.ts` and contract-tested by `scripts/migration/postMigration29ForwardSqlDraft.test.ts`. These files do not import a database adapter, execute SQL, or register a migration.

## Forward A — Bunny GUID-first persistence

### Existing drift

The original `bunny_videos` migration created:

- required numeric `video_id`;
- `lesson_id` as `varchar`.

The current runtime/config instead treats:

- `videoGuid` as canonical Bunny identity;
- numeric `videoId` as optional compatibility metadata;
- `lesson` as a relationship to `payload_lessons`.

### Required preflight

Before any write:

1. read every non-null/non-empty `bunny_videos.lesson_id`;
2. require every value to be a base-10 integer string;
3. require every parsed value to reference an existing `payload_lessons.id`;
4. fail closed on any unresolved, non-numeric, or dangling value;
5. do not rewrite or guess lesson relationships;
6. do not invent numeric Bunny video IDs.

### Intended schema changes after preflight

- add nullable `video_guid varchar` if missing;
- drop `NOT NULL` from legacy `video_id`;
- create a unique partial index on non-null `video_guid`;
- convert `lesson_id` from varchar to integer only after the preflight succeeds;
- add `lesson_id -> payload_lessons(id)` with `ON DELETE SET NULL`;
- retain existing legacy numeric indexes/fallback behavior during the compatibility period.

The verified source Bunny library remains `581531`. Inline Lexical Bunny blocks remain GUID-based and preserve source ordering; no ordered join table is introduced.

### Rollback guard

Rollback must fail if any row has `video_id IS NULL`, because restoring the old numeric-ID requirement would invalidate GUID-only records. Before reversing the lesson relationship type, require all integer lesson IDs to be representable safely in the legacy column form. Never drop `video_guid` while GUID-only rows exist.

## Forward B — lesson-comment physical schema

The live Payload collection/runtime already defines and exercises `payload_lesson_comments`. The forward migration must register its physical schema without changing application behavior.

Required table contract:

- `id serial primary key`;
- `display_name varchar not null`;
- `lesson_id integer not null` → `payload_lessons(id)`;
- `author_id integer not null` → `payload_members(id)`;
- `parent_id integer null` → `payload_lesson_comments(id)`;
- `body jsonb not null`;
- `legacy_body_html varchar null`;
- moderation enum: `visible | pending_review | hidden | deleted`;
- `legacy_comment_id varchar` unique/indexed;
- `source_created_at timestamptz` indexed;
- `metadata jsonb`;
- Payload `created_at` / `updated_at` timestamps and indexes.

Also extend `payload_locked_documents_rels` with nullable `payload_lesson_comments_id`, FK `ON DELETE CASCADE`, plus an index.

Runtime behavior must remain unchanged: same-lesson parent validation, hidden/deleted parent rejection, replies, five-comments-per-minute rate limiting, audit events, historical source timestamps, and human display names.

### Rollback guard

Do not drop a populated `payload_lesson_comments` table during rollback without an explicit archive/delete approval. A rollback packet must first report row count and export/preserve migrated/current comment records. The down path should fail closed when rows exist unless a separately approved destructive rollback mode is supplied.

## Forward C — community-space OG media

Raw SQL relationship evidence proves `wp_fcom_media_archive.sub_object_id -> wp_fcom_spaces.id` for the remaining source media.

Exact classification:

- two `space_cover_photo` records belong to migrated **course** spaces and already target `payload_courses.coverImage`;
- one `space_og_image` record belongs to a migrated **community** space and needs the only new space-media field.

### Existing course-cover target

No schema migration is required for the two course covers:

- target collection: `payload_courses`;
- target field: `coverImage`;
- relation: `payload_media`;
- member-facing course detail already renders this field.

The planner now attaches each source course-cover media operation to its actual course and blocks only on binary media import execution.

### New community OG field

Add only:

- `payload_spaces.ogImage` → `payload_media`;
- DB column `og_image_id integer null`;
- FK to `payload_media(id)` with `ON DELETE SET NULL`;
- index `payload_spaces_og_image_idx`.

Do **not** add `payload_spaces.coverImage` solely because FluentCommunity supports community cover photos generically. The audited JPV source contains no migrated-community `space_cover_photo` record.

`ogImage` preserves source share/SEO media provenance. It has no current member-portal rendering dependency, so UI rendering can remain a separate additive decision.

### Rollback guard

Before dropping `og_image_id`, report and preserve/export any populated relationships. Rollback must not silently discard the source relationship or imported media provenance.

## Planner blocker-to-target map

| Current blocker | Count | Prepared target | Close condition |
|---|---:|---|---|
| `bunny_target_schema_guid_first_compatibility_required` | 6 | `bunny_videos.video_guid` + normalized lesson FK | Forward A registered/applied after preflight |
| `lesson_comment_schema_registration_required` | 7 | physical `payload_lesson_comments` schema | Forward B registered/applied |
| `space_media_schema_registration_required` | 1 | `payload_spaces.ogImage` | Forward C registered/applied |

`space_cover_photo` course records are no longer unresolved schema relationships. They target existing `payload_courses.coverImage` and remain blocked only on binary import execution.

## Safety invariants

- migration29 remains unmodified and unapplied by this preparation phase;
- canonical migration inventory remains 29 until the migration29 lane is explicitly resolved;
- no dated migration30 exists as a result of this preparation;
- no provider, staging, or production write is authorized;
- `.env.production.BAK` and unrelated residue remain untouched;
- PII-bearing dry-run reports remain outside the repository;
- any forward migration packet must rerun type-check, planner/source contracts, lesson-discussion tests, Bunny contracts, migration inventory checks, and the full real-source dry run before staging-write consideration.
