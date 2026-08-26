# Bunny GUID-First Forward Migration Draft

**Status:** design-ready, intentionally **undated and unregistered** while migration29 remains the isolated canonical pending Payload migration.  
**Forward-step identity:** `Forward A — Bunny GUID-first compatibility`  
**Do not create, date, apply, or register a migration module until the migration29 lane is separately completed/rebased.**

## Purpose

The current Bunny Stream API identifies a video by the `guid` returned from Create/Get Video and sent as `VideoGuid` in webhooks. The existing JPV table was originally created with required numeric `video_id`, while the runtime already signs playback with `videoGuid`. A second schema/runtime drift is also source-proven: the original table created `lesson_id` as `varchar`, while the current Payload config and create-video runtime treat `lesson` as a relationship to `payload_lessons`.

The forward step must therefore:

1. ensure `video_guid` exists;
2. permit legacy `video_id` to be null for GUID-only/current records;
3. add a unique index for non-null GUID values;
4. preserve existing numeric-only legacy rows until they can be backfilled/reviewed;
5. read-only preflight every non-empty `lesson_id`, requiring a base-10 integer string that resolves to an existing `payload_lessons.id`;
6. fail closed on any non-numeric or dangling lesson value rather than casting/guessing it;
7. after a clean preflight, normalize `lesson_id` to integer and add a real `payload_lessons(id)` FK with `ON DELETE SET NULL`;
8. never rewrite `20260718_110000_bunny_videos.ts`;
9. remain ordered after migration29 is explicitly resolved, without assigning a dated migration identity yet.

### Required lesson relationship preflight

Before any DDL that changes `lesson_id`, run a read-only validation that proves:

- every non-null/non-empty value matches `^[0-9]+# Bunny GUID-First Forward Migration Draft

**Status:** design-ready, intentionally **undated and unregistered** while migration29 remains the isolated canonical pending Payload migration.  
**Forward-step identity:** `Forward A — Bunny GUID-first compatibility`  
**Do not create, date, apply, or register a migration module until the migration29 lane is separately completed/rebased.**

## Purpose

The current Bunny Stream API identifies a video by the `guid` returned from Create/Get Video and sent as `VideoGuid` in webhooks. The existing JPV table was originally created with required numeric `video_id`, while the runtime already signs playback with `videoGuid`. A second schema/runtime drift is also source-proven: the original table created `lesson_id` as `varchar`, while the current Payload config and create-video runtime treat `lesson` as a relationship to `payload_lessons`.

The forward step must therefore:

1. ensure `video_guid` exists;
2. permit legacy `video_id` to be null for GUID-only/current records;
3. add a unique index for non-null GUID values;
4. preserve existing numeric-only legacy rows until they can be backfilled/reviewed;
5. read-only preflight every non-empty `lesson_id`, requiring a base-10 integer string that resolves to an existing `payload_lessons.id`;
6. fail closed on any non-numeric or dangling lesson value rather than casting/guessing it;
7. after a clean preflight, normalize `lesson_id` to integer and add a real `payload_lessons(id)` FK with `ON DELETE SET NULL`;
8. never rewrite `20260718_110000_bunny_videos.ts`;
;
- every parsed integer joins to an existing `payload_lessons.id`;
- zero values are unresolved or dangling.

If any row fails either rule, stop. Do not cast it, null it, or invent a relationship.

Only after that preflight is clean may the forward step convert `lesson_id` to integer and add the `payload_lessons(id)` foreign key with `ON DELETE SET NULL`.

## Intended `up` migration

Use the repo's normal `payloadSqlSchemaPrefix()` and Drizzle `sql` pattern. Equivalent SQL:

```sql
ALTER TABLE <payload_schema>."bunny_videos"
  ADD COLUMN IF NOT EXISTS "video_guid" varchar;

ALTER TABLE <payload_schema>."bunny_videos"
  ALTER COLUMN "video_id" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bunny_videos_video_guid_unique_idx"
  ON <payload_schema>."bunny_videos" ("video_guid")
  WHERE "video_guid" IS NOT NULL;
```

The first GUID-first migration intentionally does **not** set `video_guid` database-level `NOT NULL`, because existing numeric-only legacy rows may not have a verified GUID yet. Runtime create/webhook paths require/use GUID for current Bunny events; the nullable DB column is only a compatibility bridge for old records.

A later cleanup migration may set `video_guid NOT NULL` only after a read-only backfill/reconciliation proves every retained row has a verified GUID.

## Intended `down` migration

Rollback must fail closed if GUID-only rows have been created, because restoring `video_id NOT NULL` would otherwise destroy or invalidate current records.

Equivalent logic:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM <payload_schema>."bunny_videos"
    WHERE "video_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot rollback Bunny GUID-first migration while GUID-only rows exist';
  END IF;
END $$;

DROP INDEX IF EXISTS <payload_schema>."bunny_videos_video_guid_unique_idx";

ALTER TABLE <payload_schema>."bunny_videos"
  ALTER COLUMN "video_id" SET NOT NULL;

ALTER TABLE <payload_schema>."bunny_videos"
  DROP COLUMN IF EXISTS "video_guid";
```

## Runtime contract paired with this migration

- `src/lib/bunny-api.ts` uses `https://video.bunnycdn.com` and normalizes Bunny `guid` to application `videoGuid`.
- `src/app/api/admin/bunny/create-video/route.ts` persists `videoGuid` for new records; response field `videoId` is retained only as a compatibility alias containing the GUID string.
- `src/app/api/webhook/bunny/route.ts` looks up/upserts by `(libraryId, videoGuid)` first; numeric `VideoId` is optional legacy fallback only.
- `src/collections/PayloadBunnyVideo.ts` treats numeric `videoId` as optional legacy metadata and `videoGuid` as canonical/unique for current records.
- playback remains GUID-based.

## Registration gate

Do **not** add this draft as any dated module under `src/migrations` yet. `scripts/payload_migration_inventory_contract.test.ts` currently requires exactly 29 dated modules, and the controlled migration29 staging runner expects migration29 to be the sole pending migration. Registering any forward module now would intentionally fail that safety contract and conflate two independently reviewed lanes.

Registration becomes safe only after the migration29 lane is explicitly completed/rebased and the migration inventory/readiness contracts are updated for the new canonical count/order.

## Pre-registration validation

Before converting this draft into a real migration module:

- migration29 status/order is explicitly resolved;
- existing `bunny_videos` row count is read-only inspected;
- duplicate non-null GUIDs = 0;
- any numeric-only rows are reported, not guessed/backfilled;
- current create/webhook/playback tests pass;
- no provider mutation is required to register the schema migration.
