# Legacy Media and Engagement Repair — 2026-08-31

**Repository:** `jpv-bootcamp`
**Worktree:** `codex/migration-media-repair`
**Base:** production/main `25261095b1dd502f8f05b226aa810057eb4c2978`
**Scope:** read-only source audit plus isolated application repair. This document is not authorization to modify a database, deploy, or change production.

## Findings

The August 25 migration package contains the source media needed for the reported lesson images:

- 386 files in the WordPress uploads archive.
- 376 raster images suitable for browser delivery.
- 104 WordPress attachment records in the WXR export.
- 106 unique WordPress upload paths referenced by attachment metadata or migrated content.
- All 106 referenced upload paths are present in the supplied local archive.

The answer to “is all of this imported and linked in production?” is **no**. The source archive is complete locally, but the running production image had partial coverage: read-only basename probes found 51 of the 106 WXR-referenced attachments available and 55 unavailable. Existing migrated lesson blocks also retained unresolved image placeholders instead of renderable image URLs. Therefore the missing lesson images are not explained by absent source files; they are an import/runtime-linking problem.

## Root causes

1. The production Docker image did not copy the WordPress raster archive into a public runtime path.
2. The rich-text migration treated WordPress `<img>` and unsupported `<figure>` content as fallback blocks when no Payload media map was supplied.
3. The portal renderer displayed the sanitized fallback text but had no safe repair step for an already-imported image placeholder.
4. Reaction writes depended on the audit table being readable/writable. A missing or unavailable audit projection could make the UI report a failed reaction even when the engagement row was the actual user-facing operation.

## Isolated repair

- The image build copies only non-empty raster files from `src/assets/uploads` to `public/legacy-media`, preserving the WordPress year/month path. This path intentionally stays outside Dokploy's mounted `/app/public/media` directory, which otherwise masks image files baked into the image.
- The image build also emits `public/legacy-media-by-name` aliases for archive basenames that are unique or byte-identical across WordPress month directories. The current live course has 58 stale preview image basenames; all 58 have a safe alias. Ambiguous basenames are deliberately not guessed.
- The migration resolver maps exact archive paths, with a unique-basename fallback only when an exact path is unavailable.
- Sanitized legacy lesson placeholders and already-imported `preview.jpvbootcamp.com/api/payload_media/file/<filename>` image sources are repaired at render time to local archive paths. Raw legacy HTML is never rendered.
- The two source-backed omissions found by the old/new live comparison are restored once at render time: `legal_agreement.jpg` is inserted into `lesson-5-the-legal-agreement`, and `banner1.png` is inserted after the existing image in `lesson-6-the-word-of-god`.
- New migrations resolve legacy images to the static archive path when no Payload media relationship exists, so future imports do not leave image-only blockers.
- Audit and notification records remain best-effort side effects for reactions. Reaction persistence is independent of audit availability; the unique member/target index remains the duplicate-write guard. Count queries fall back from Payload `count` to `find`.

Archived videos and documents are not copied into this public image path. Bunny video references continue through the existing managed-video path, and private/document media requires its separately reviewed storage/import route.

## Live reconciliation evidence — 2026-08-31

- The authenticated old and new course pages both contain 47 lessons with matching lesson titles after HTML-entity normalization.
- The old platform has five unique Bunny video GUIDs. The new platform has the same five GUIDs, and the authenticated browser loaded each new video with a non-zero duration.
- The new platform exposes 15 protected lesson-resource records. Each was downloaded through the authenticated browser and had a non-zero byte count with a valid PDF or XLSX signature. The downloaded files were verified by SHA-256; duplicate records for the same source binary produced matching hashes.
- The old platform lists `UK_Property_Value_Factors.pdf` in the factors lesson, but its authenticated `force_download` endpoint currently returns **Document not found**. The file is also absent from the supplied August 25 archive, so this is the one confirmed source gap that cannot be repaired from the available data. The original WordPress media binary or a replacement supplied by the operator is required.

This repair does not mutate the production database. It makes the confirmed current-content omissions render from the checked-in archive and keeps paid documents protected behind the existing authenticated resource route.

## Validation

Passing in this worktree:

- focused legacy lesson renderer and reaction tests: 18 tests;
- legacy rich-text conversion contract;
- legacy media manifest and execution-plan tests;
- legacy media executor safety tests;
- course access service tests;
- community portal and discussion tests;
- TypeScript no-emit check;
- static-media preparation check: 376 raster files copied and a known lesson image verified.

The first production image build/deployment completed at `f593f90`, and the runtime health endpoint converged to that SHA, but the first static-media probe returned 404. Dokploy inspection confirmed that its `/app/public/media` volume masks image files baked into that directory. This follow-up moves the bundled archive to `public/legacy-media` and emits `/legacy-media/...` URLs outside the mounted directory. The follow-up image must be deployed and its media probes rechecked before declaring image delivery complete. An authenticated browser check is also required to verify the reaction mutation against the live schema.
