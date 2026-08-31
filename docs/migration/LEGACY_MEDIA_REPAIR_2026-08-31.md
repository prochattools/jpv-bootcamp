# Legacy Media and Engagement Repair — 2026-08-31

**Repository:** `jpv-bootcamp`
**Worktree:** `codex/migration-media-repair`
**Base:** production/main `4642b5e74a7965adf23aa083020e7c1223fcff31`
**Scope:** read-only source audit plus isolated application repair. This document is not authorization to modify a database, deploy, or change production.

## Findings

The August 25 migration package contains the source media needed for the reported lessons:

- 386 files in the WordPress uploads archive.
- 376 raster images suitable for browser delivery.
- 104 WordPress attachment records in the WXR export.
- 106 unique WordPress upload paths referenced by attachment metadata or migrated content.
- All 106 referenced paths are present in the supplied local archive.

The answer to “is all of this imported and linked in production?” is **no**. The source archive is complete locally, but the running production image had partial coverage: read-only basename probes found 51 of the 106 WXR-referenced attachments available and 55 unavailable. Existing migrated lesson blocks also retained unresolved image placeholders instead of renderable image URLs. Therefore the missing lesson images are not explained by absent source files; they are an import/runtime-linking problem.

## Root causes

1. The production Docker image did not copy the WordPress raster archive into a public runtime path.
2. The rich-text migration treated WordPress `<img>` and unsupported `<figure>` content as fallback blocks when no Payload media map was supplied.
3. The portal renderer displayed the sanitized fallback text but had no safe repair step for an already-imported image placeholder.
4. Reaction writes depended on the audit table being readable/writable. A missing or unavailable audit projection could make the UI report a failed reaction even when the engagement row was the actual user-facing operation.

## Isolated repair

- The image build copies only non-empty raster files from `src/assets/uploads` to `public/legacy-media`, preserving the WordPress year/month path. This path intentionally stays outside Dokploy's mounted `/app/public/media` directory, which otherwise masks image files baked into the image.
- The migration resolver maps exact archive paths, with a unique-basename fallback only when an exact path is unavailable.
- Sanitized legacy lesson placeholders are repaired at render time to local `/legacy-media/...` images. Raw legacy HTML is never rendered.
- New migrations resolve legacy images to the static archive path when no Payload media relationship exists, so future imports do not leave image-only blockers.
- Audit and notification records remain best-effort side effects for reactions. Reaction persistence is independent of audit availability; the unique member/target index remains the duplicate-write guard. Count queries fall back from Payload `count` to `find`.

Archived videos and documents are not copied into this public image path. Bunny video references continue through the existing managed-video path, and private/document media requires its separately reviewed storage/import route.

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
