# Legacy Platform → Payload Staging Dry-Run Plan

**Repository:** jpv-bootcamp  
**Branch:** `feature/course-branding-and-preview`  
**Reviewed application checkpoint:** `43d569211acde5ae80f6e33524d40d432b417ce8`  
**Lane:** local/read-only normalization and staging dry-run preparation only  
**Database writes authorized by this document:** No  
**Stripe/Bunny/Dokploy mutations authorized by this document:** No  
**Production operations authorized:** No

---

## 1. Objective

Build a deterministic, rerunnable migration pipeline that converts the legacy WordPress + FluentCRM + FluentCommunity + Stripe/Bunny source state into a normalized Payload import plan, proves all source-to-target relationships, and produces a complete reconciliation report **before any legacy-data write to `jpvbootcamp_staging`**.

This plan is intentionally fail-closed. Unknown identities, orphan relationships, unsupported content, or count drift must appear as blockers rather than being silently dropped or guessed.

---

## 2. Immutable Staging Boundaries

Only the following future write target is allowed after separate authorization:

- environment: `staging`
- target: `jpvbootcamp-staging`
- PostgreSQL host: `10.0.2.4`
- port: `5433`
- database: `jpvbootcamp`
- schema: `jpvbootcamp_staging`
- staging origin: `https://preview.jpvbootcamp.com`
- Dokploy application slug: `clients-jpv-bootcamp-app-tp9xrk`
- Dokploy application ID: `I_2Vukga3cc3ZhaG-mUzU`

This dry-run phase performs **no database or provider mutation**.

Production, `main`, the public schema, production Stripe, and production Dokploy are excluded.

---

## 3. Source Inputs

Read-only inputs for the first deterministic rehearsal:

1. WordPress WXR export dated 2026-08-12.
2. Full MariaDB SQL dump dated 2026-08-12 containing WordPress, FluentCRM, and FluentCommunity data.
3. WordPress uploads archive at `src/assets/uploads` used only as a local migration source; do not commit it.
4. Sanitized live Stripe inventory for the five approved legacy paid Products.
5. Sanitized sandbox Stripe catalogue for `prod_UuO0SZGtwH75xI`.
6. Sanitized Bunny Stream inventory for library `581531`.

Provider/source files containing PII must not be committed to Git.

A fresh final source snapshot and fresh Stripe read-only state are required immediately before eventual cutover; the 2026-08-12 sources are the rehearsal baseline.

---

## 4. Target Membership Invariant

There is one target membership entitlement only:

`jpv_bootcamp_membership`

Target member states:

### 4.1 Active paid member

- Has a current qualifying legacy Stripe subscription with status `active`.
- Target `payload_members.accountStatus = active`.
- Target billing model: the single JPV Bootcamp membership model.
- Access: all migrated member courses, spaces, feeds, discussions, and resources.

### 4.2 Blocked/deactivated member

- Does not have a current qualifying `active` legacy Stripe subscription.
- Target `payload_members.accountStatus = blocked`.
- No active target subscription/paid entitlement in staging.
- Identity, profile, authorship, community history, and course progress remain preserved.
- Login/paid-member access remains denied.

### 4.3 Fail-closed Stripe status policy

For the rehearsal baseline:

- `active` => active candidate.
- `canceled` => blocked.
- `incomplete_expired` => blocked.
- `past_due` => blocked until a later read-only snapshot proves recovery to `active`.
- Duplicate historical Stripe Customer records do not create duplicate Payload members.
- Discounts/promotions do not negate current `active` membership; preserve discount evidence for later billing-cutover planning.

Expected 2026-08-12 rehearsal population after the operator-confirmed Nidia duplicate merge:

- WordPress member/subscriber source accounts represented: **48**.
- Canonical target members after merging WordPress users 74 and 76 into one person: **47**.
- Active paid candidates: **12**.
- Blocked/deactivated candidates: **35**.

The dry-run must fail if source-account coverage or canonical person-level counts differ without an explicit conflict record explaining the difference.

---

## 5. Known Identity Exceptions

### 5.1 Nidia Gonzalez duplicate WordPress identity

Source evidence contains:

- WordPress user 74: `nsgonza2@gmsil.com`, matching the current active Stripe Customer email exactly.
- WordPress user 76 / FluentCRM: `nsgonza2@gmail.com`.

Dry-run behavior:

- Treat WordPress user 74 as the billing-authoritative active identity.
- Inspect all FluentCommunity, FluentCRM, course-progress, post/comment, and membership references to users 74 and 76.
- Produce one canonical target-person proposal with all source IDs retained in migration metadata/crosswalk.
- Never create two active paid members for these records without explicit contrary evidence.
- Report every relationship moved from the duplicate source identity to the canonical target member.

### 5.2 Anita/Stephen name conflict

Source evidence contains exact email `anita13steve@gmail.com` in both systems, but Stripe customer name differs from WordPress/FluentCRM name.

Dry-run behavior:

- Join by exact normalized email.
- Preserve source-specific names in conflict/audit evidence.
- Prefer WordPress/profile identity for the migrated member-facing name unless an explicit profile-authority rule proves otherwise.
- Never silently overwrite source identity evidence.

### 5.3 Orphan historical Stripe customers

Three canceled Stripe Customers have no usable email/name.

Dry-run behavior:

- Keep their Stripe IDs in the billing-orphan report.
- Do not guess a WordPress match.
- They cannot activate any target member because they have no current qualifying subscription.

---

## 6. Legacy Stripe Catalogue Decision

The following are legacy Products and are **not** target Products:

- `prod_Tvj8HliPtISF2K` — legacy VIP.
- `prod_Tvj7d4LMAxVVta` — legacy Pro.
- `prod_TcZanPbgn4ERhq` — legacy VIP.

The other approved legacy Product IDs remain historical classification inputs as well.

No existing legacy Product may be renamed/reused as the new live target.

Sandbox/test target:

- Product `prod_UuO0SZGtwH75xI` — `JPV Bootcamp Membership`.
- Monthly Price `price_1TuZE1LIsSm7aAua4nIhf9U8` — GBP 80/month.
- Annual Price `price_1TuZEPLIsSm7aAuaMfEAUS5m` — GBP 800/year.

Live catalogue creation is a later, separately authorized create-new-only task after staging rehearsal/acceptance.

---

## 7. Canonical Source → Payload Mapping

| Source concept | Payload target |
|---|---|
| WordPress/FluentCRM/FluentCommunity person | `payload_members` + `payload_contacts` through one identity crosswalk |
| Current qualifying paid relationship | `payload_members.accountStatus=active` plus staging/test membership representation |
| Non-current/free legacy person | `payload_members.accountStatus=blocked`; history preserved, no active subscription |
| Legacy CRM tags/lists | `payload_contacts` / CRM metadata where useful; never membership access |
| FluentCommunity course | `payload_courses` |
| Course section | `payload_course_modules` |
| Course lesson | `payload_lessons` |
| Course/student membership | `payload_course_enrollments` where semantically applicable |
| Lesson completion | `payload_lesson_progress` |
| FluentCommunity space/group | `payload_spaces` |
| Space membership | `payload_space_memberships` |
| Feed/community post | `payload_space_posts` |
| Comment/reply | `payload_space_comments` |
| Space/community attachment | `payload_space_files` and/or `payload_media` according to runtime model |
| WordPress attachment | `payload_media` and related lesson/community reference |
| Existing Bunny video | preserve `libraryId=581531` + exact `videoGuid`; do not re-upload when already present |
| Legacy billing relationship | `payload_subscriptions` staging/test representation only after a separately approved write plan |

Legacy tier-based products, upgrade CTAs, paywalls, Free/Pro/VIP gates, and tier-specific access states are excluded as target functionality.

Historical post bodies are not rewritten merely because they mention legacy tiers.

---

## 8. Course Migration Rules

Baseline source inventory:

- 3 courses.
- 10 course sections.
- 61 course lessons.
- 103 `lesson_completed` records across 11 users.
- 6 `course_completed` activities across 5 users.

Dry-run requirements:

1. Preserve course titles, descriptions, status, order, and source IDs.
2. Preserve section/module order and lesson order.
3. Convert supported WordPress block/HTML lesson content into the target lesson content representation without dropping text, images, links, tables, lists, embeds, or documents.
4. Preserve original external video URLs and Bunny GUIDs.
5. Resolve every lesson media/document relationship.
6. Map lesson completion to the canonical target member after identity reconciliation.
7. Do not create duplicate progress when duplicate legacy identities merge.
8. Generate an orphan-progress report for any completion record whose user or lesson cannot be resolved.
9. `free_preview_lesson` and other legacy tier/free-preview flags must not recreate a free-access tier.

Expected count gates before target writes:

- source courses normalized: 3/3.
- sections normalized: 10/10.
- lessons normalized: 61/61.
- every completion record either mapped exactly once or explicitly reported as an unresolved blocker.

---

## 9. Community Migration Rules

Baseline source inventory:

- 16 spaces.
- 182 space-membership rows.
- 80 feed/community posts.
- 105 comments.
- 220 reaction/progress records in the source reaction table.
- 86 FluentCommunity media records.

Dry-run requirements:

1. Preserve source IDs, authorship, timestamps, privacy/moderation state, parent/thread relationships, and content bodies.
2. Preserve comments/replies and map mentioned users through the identity crosswalk when possible.
3. Preserve supported reactions/bookmarks or explicitly report unsupported engagement records; never silently drop them.
4. Preserve attached images/documents/media references.
5. Tier-specific visibility must not survive as access control.
6. Rename the functional space label `Only VIP Discussion` to a neutral member-only target name such as `Member Discussion`; preserve all post/comment bodies unchanged.
7. Exclude active upgrade spaces/pages/objects whose sole purpose is Free→Pro/VIP or Pro→VIP conversion.
8. All active members must be eligible for all member spaces after migration; blocked members retain authorship/history but cannot access the paid platform.

Every source post/comment must resolve to one target author identity or an explicit orphan/conflict record.

---

## 10. WordPress Media Rules

Local upload source baseline:

- approximately 386 files / 65.2 MB.
- WXR attachment records: 104.
- archive includes derivative thumbnails and non-content/control files.

Dry-run behavior:

1. Build an attachment manifest keyed by WordPress attachment ID, original path, original URL, MIME type, size, and checksum.
2. Prefer original attachment files over generated derivative thumbnails when target semantics allow.
3. Map every WXR/lesson/community `wp-content/uploads` URL to a local file if present.
4. Explicitly exclude executable/control files such as `.php`, `.htaccess`, plugin artifacts, and other non-media payloads.
5. Produce missing-file and duplicate-checksum reports.
6. Do not upload media during dry-run.

---

## 11. Bunny Rules

Verified Bunny Stream source:

- library ID `581531`.
- configured hostname `vz-d0404b6f-bd9.b-cdn.net`.
- 12 videos visible to the staging-scoped credentials.
- 11 reusable legacy videos with status `resolution_finished`.
- exclude failed/test video `staging-proof-upload-test`.

Dry-run behavior:

1. Parse every FluentCommunity lesson/post/content field for Bunny `player.mediadelivery.net/embed/581531/<guid>` or equivalent known GUID reference.
2. Join only referenced GUIDs to the verified 11-video inventory.
3. Preserve library ID and GUID; do not upload/copy videos that already exist in the matching library.
4. Fail/report if a source content record references a Bunny GUID not found in the inventory.
5. Do not automatically create target video records for library videos that are not referenced by migrated source content.
6. The missing `BUNNY_API_KEY` / `BUNNY_LIBRARY_ID` aliases do not block read-only mapping/reuse; resolve the runtime upload/create-video variable contract before final staging media acceptance if that flow is exercised.

Known source mappings already observed include the verified GUID `4124c032-adc2-4505-8dbc-f214df073a5c` and lesson embeds for `56266f09-d651-4bc5-a5b0-ac9185018018` and `cda4b492-91af-430d-9bba-4268ccaf8cc2`.

---

## 12. Normalized Intermediate Model

The dry-run tooling should emit a deterministic intermediate representation before producing any Payload writes. Minimum entities:

- `people`
- `identityCrosswalk`
- `billingEvidence`
- `memberClassification`
- `crmContacts`
- `courses`
- `modules`
- `lessons`
- `enrollments`
- `lessonProgress`
- `spaces`
- `spaceMemberships`
- `posts`
- `comments`
- `reactions`
- `media`
- `bunnyVideos`
- `conflicts`
- `orphans`

Each normalized entity must retain source-system identifiers sufficient for deterministic reruns and reconciliation.

Do not include passwords or attempt to migrate WordPress password hashes into Payload credentials.

---

## 13. Dry-Run Output Artifacts

PII-bearing outputs must remain local/temporary and uncommitted.

Required outputs:

1. source inventory summary;
2. person/identity crosswalk;
3. active-vs-blocked member roster;
4. Stripe billing evidence map;
5. course/module/lesson map;
6. course-progress map;
7. space/post/comment map;
8. media attachment map;
9. Bunny GUID map;
10. conflicts/orphans report;
11. source→target count reconciliation;
12. proposed Payload create/update operations with stable idempotency keys, but **no execution**.

The committed repo may contain only non-PII test fixtures, schemas, aggregate counts, and migration logic.

---

## 14. Reconciliation Gates

Dry-run status is `PASS` only when all applicable gates hold:

### Membership

- all 48 WordPress member/subscriber source accounts represented, with documented merge exceptions producing 47 canonical target members;
- current verified rehearsal classification = 11 active / 36 blocked across the 47 canonical target members; historical 2026-08-12 evidence remains 12 active / 35 blocked;
- no active member derived solely from FluentCRM Free/Pro/VIP tags;
- no duplicate active member created from duplicate Stripe or WordPress identities;
- past-due status remains fail-closed unless refreshed to active.

### Courses

- courses: 3 mapped.
- sections: 10 mapped.
- lessons: 61 mapped.
- lesson progress: every source completion mapped or explicitly blocked with reason.

### Community

- spaces: every intended source space classified as migrate / rename / exclude with reason.
- feed posts: 80 mapped or each exception explained.
- comments: 105 mapped or each exception explained.
- no unexplained author/thread orphan.

### Media

- all referenced WordPress attachment URLs mapped or reported.
- all referenced FluentCommunity media records mapped or reported.
- every referenced Bunny GUID present in verified inventory or reported as blocker.
- no executable/control file proposed for media import.

### Access semantics

- no Free/Pro/VIP access gate survives.
- no active upgrade-to-Pro/VIP functionality survives.
- active members receive the unified member-access model.
- blocked members preserve data but cannot obtain member access through migrated legacy flags.

Unexplained loss of source content is a blocker.

---

## 15. Implementation Sequence

### DRY-1 — Source parsers

Implement deterministic WXR + SQL + local media manifest parsers with tests. No provider calls required.

### DRY-2 — Identity crosswalk

Resolve WordPress, FluentCRM, FluentCommunity, and sanitized Stripe identities. Implement explicit conflict handling for Nidia and Anita/Stephen cases. Produce local PII roster only.

### DRY-3 — Membership classification

Apply the two-state policy and assert 48 source member accounts resolve to 47 canonical target members: 11 active / 36 blocked against the current verified live Stripe snapshot. Preserve the historical 2026-08-12 12 active / 35 blocked classification as evidence only. Never create target subscriptions during this phase.

### DRY-4 — Courses/progress

Normalize 3 courses / 10 modules / 61 lessons and progress history.

### DRY-5 — Community

Normalize spaces, memberships, 80 posts, 105 comments, reactions, moderation state, and media references.

### DRY-6 — Media/Bunny

Map WordPress originals, FluentCommunity media URLs, R2 references, and verified Bunny GUIDs. No upload.

### DRY-7 — Payload operation plan

Generate idempotent proposed Payload operations in dependency order, without executing them.

Recommended dependency order:

1. canonical members/contacts;
2. media metadata and reusable external references;
3. courses;
4. modules;
5. lessons/resources;
6. spaces;
7. memberships/enrollments;
8. posts;
9. comments/files/reactions;
10. progress;
11. staging/test billing representation only under a separate approved write packet.

### DRY-8 — Reconciliation report

Require every gate in Section 14 to pass before preparing any staging-data apply packet.

---

## 16. What Happens After Dry-Run PASS

Dry-run PASS does **not** authorize a write.

Next sequence after separate operator review:

1. create a staging-only legacy-data apply packet with backup/rollback/idempotency controls;
2. perform the first full import into `jpvbootcamp_staging` only;
3. run source→staging reconciliation and UI/API smoke tests;
4. fix only proven migration defects and rerun from a clean/reset rehearsal state as required;
5. confirm course/media/community fidelity and active/blocked access behavior;
6. only after staging acceptance, prepare the separate create-new-only live Stripe catalogue operation;
7. later perform a fresh final source/Stripe delta and separately authorized production/live cutover.

No production action is authorized by this plan.



---

## 17. Implementation Checkpoint — 2026-08-12

### Completed in the current Workbench batch

Implemented non-PII migration logic under `scripts/migration/`:

- `legacySourceDryRun.ts`
  - deterministic phpMyAdmin SQL `INSERT` parser for the required WordPress, FluentCRM, and FluentCommunity tables;
  - deterministic WXR item/attachment parser;
  - local media manifest with SHA-256 hashing for importable files and fail-closed exclusion of executable/control files;
  - normalized WordPress/FluentCRM/FluentCommunity intermediate model;
  - operator-confirmed Nidia merge: source WP users 74 + 76 resolve to one canonical person, with canonical email sourced from WP 76 (`nsgonza2@gmail.com`) while WP 74 remains a billing-match alias;
  - fail-closed member classification;
  - current rehearsal invariant: 48 source subscriber accounts → 47 canonical subscriber members → 11 active / 36 blocked; historical 2026-08-12 evidence remains 12 active / 35 blocked;
  - explicit navigation/functional-space classification so tier upgrade objects are not silently imported;
  - `Only VIP Discussion` → `Member Discussion` functional rename while preserving historical post bodies;
  - actual FluentCommunity lesson-completion encoding recognized as `object_type=lesson_completed` + `type=completed`;
  - WordPress attachment reconciliation;
  - Bunny GUID reconciliation against library `581531`;
  - hard guard preventing PII-bearing output from being written inside the repository.

- `legacyPayloadOperationPlan.ts`
  - generates schema-aligned **proposed** Payload operations only;
  - `executionAuthorized=false` and `executable=false` are hard-coded plan properties;
  - preserves 47 canonical subscriber members plus blocked staff/admin author mirrors required for legacy authorship relationships;
  - active subscribers receive unified access proposals for every migrated course and community space;
  - blocked subscribers preserve historical course/space relationships without current access;
  - lesson completion history resolves through the canonical identity crosswalk;
  - reactions/bookmarks are retained as source metadata pending final target-shape decisions;
  - existing legacy Stripe tier semantics are not used as target access controls;
  - rich WordPress/HTML content now converts through the approved lossless HTML→Lexical path, retains exact raw source plus conversion diagnostics, and fails closed only for specific unresolved media/embed/code cases;
  - Bunny-backed lesson references reconcile at the source layer by verified library ID + video GUID. Proposed `bunny_videos` writes remain non-executable with `bunny_target_schema_guid_first_compatibility_required` until the target persistence schema is made GUID-first; GUIDs are never guessed.

- `runLegacySourceDryRun.ts`
  - local read-only CLI accepting SQL, WXR, sanitized Stripe, sanitized Bunny, and local uploads paths;
  - asserts the current 48 → 47 → 11 active / 36 blocked identity snapshot expectations while retaining 12/35 as historical 2026-08-12 evidence;
  - fail-fast asserts the known 2026-08-12 source baseline before accepting a dry-run: 51 WordPress users, 3 administrators, 48 FluentCRM contacts, 16 spaces, 182 space memberships, 3 courses, 10 sections, 61 lessons, 80 feed posts, 105 comments, 220 reaction/progress rows, 103 lesson completions, 6 course completions, 86 FluentCommunity media rows, 117 WXR items, 104 WXR attachments, and 386 local upload files;
  - any unexplained count drift raises `LEGACY_SOURCE_CONTENT_EXPECTATION_FAILED` before reconciliation/output acceptance;
  - writes the PII-bearing reconciliation report only to an operator-supplied path outside the repo with file mode `0600`;
  - includes the complete non-executable proposed Payload operation plan in that local report;
  - performs no database, Stripe, Bunny, or Dokploy mutations.

### Validation evidence

Current validation passes:

- TypeScript: `tsc --noEmit` → PASS.
- `legacySourceDryRun.test.ts` → PASS 6/6, including exact source-count success and one-count `LEGACY_SOURCE_CONTENT_EXPECTATION_FAILED` drift rejection.
- `legacyPayloadOperationPlan.test.ts` → PASS, including GUID-first Bunny source reconciliation, explicit target-schema compatibility blocking, and missing-GUID fail-closed behavior.
- `legacyBunnyReadOnly.test.ts` → PASS, proving GET-only GUID verification against the current Bunny Stream API, staging alias support, failed-video skipping, and GUID/library validation.
- `bunny_config_aliases.test.ts` → PASS.
- `bunny_get_video_readonly.test.ts` → PASS.
- existing `legacyMigrationBehavior.test.ts` → PASS 13/13.
- existing `stripeSubscriptionMigration.test.ts` → PASS 35/35.
- full high-risk security scan on the zero-network dry-run core (`legacySourceDryRun*`, `legacyPayloadOperationPlan*`, `runLegacySourceDryRun.ts`) → zero findings.
- forbidden-runtime-execution scan across all modified migration/Bunny executable files → zero findings.
- full high-risk scan across all modified Bunny/runtime files reports expected network `fetch` calls plus lexical `apiKey`/`token` false positives from the Bunny client surface; these are reviewed exceptions, not a clean zero-finding result. The migration-specific Bunny resolver is separately covered by tests proving GET-only behavior, validated GUID/library identity, failed-video skipping, and no mutation method.
- secret-material scan on migration authority documentation → zero findings.

A previously referenced `scripts/content/wordpressAdapter.test.ts` path does not exist in the current repository; no adapter regression test was skipped silently after this was verified by repository search.

### Current live-source DRY-8 checkpoint

The source artifacts are now available at verified local paths and the complete read-only DRY-8 regression has **PASSed**. No database, Stripe, Bunny, Dokploy, staging, or production mutation occurred.

Verified inputs:

- `/private/tmp/127_0_0_1.sql` — SHA-256 `cf6fcb585411360076bbb01164437543ab3debd568cb7b1b37c1d8ee8a4da70e`;
- `/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml` — SHA-256 `186de11d2f5fed7d1f964a66d0df3fb83049d1fd87d6e2972decfd24c91cc5c8`;
- `/private/tmp/jpv-stripe-live-subscriptions.json` — SHA-256 `5ed3457ed96020165f15a0b03952a25d756c43a481da03af9836ca4938a23523`;
- `/private/tmp/jpv-bunny-migration-inventory.json` — SHA-256 `f9a6fe7990ec0585a7645558ce597c20b943c0efbb94d92389c568917f27533c`;
- `src/assets/uploads` for local WordPress/media binaries.

Current live rehearsal identity is **48 source subscriber accounts → 47 canonical people → 11 active / 36 blocked**. The earlier 12/35 result remains the historical 2026-08-12 Stripe snapshot, not the current gate.

Latest read-only plan evidence:

- 3 courses / 10 sections / 61 lessons;
- 4 migrated community spaces / 7 navigation-only / 2 excluded functional spaces;
- 182 source space memberships / 80 feed posts / 105 comments / 117 community reactions;
- 103 lesson completions / 6 course completions;
- 104/104 WXR attachments mapped;
- A2 read-only media/archive manifest PASS: 533 manifest records covering all 43 planner binary-import intents, all 104 WXR attachment references, and all 386 local upload files; 3 binary intents resolve locally, 40 remain external/remote sources with no network fetch, 0 local-class binaries are missing, 18 public / 25 private binary imports, and 279 local files are explicitly archive-only unmatched rather than silently discarded;
- A3 zero-write media execution-plan PASS: 533 deterministic entries / 43 future execution intents; 3 `ready_after_write_authorization`, 39 `requires_remote_source_acquisition`, 1 `schema_blocked`, 0 `source_missing_blocked`; 18 public / 25 private intents; 6 relationship-bearing intents; 43 rollback-ledger templates; 1 duplicate-checksum group reported with automatic coalescing disabled; `mutationMode=none`, `networkAuthorized=false`, `outputWritten=false`;
- A4 zero-network remote-acquisition plan PASS: 40 remote source definitions because the schema-blocked community OG is itself remote in addition to the 39 A3 remote-acquisition dispositions; 15 public / 25 private; all 40 are source-proven `s3`, HTTPS, provider-credential-required, and `acquisition_definition_ready`; 0 authentication-unknown, 0 fail-closed definitions, 0 known pre-acquisition checksums, 0 known pre-acquisition byte counts; locator hosts classify 31 object-storage-origin / 9 legacy-origin; `networkAuthorized=false`, `outputWritten=false`;
- 5 referenced Bunny GUIDs / zero missing;
- three Stripe orphans, all canceled + missing customer email, therefore blocked/historical;
- 47 xprofile-backed member-profile operations;
- one source-proven `portalSettings` Global operation;
- three source-proven PortalSettings media references;
- 935 proposed operations total / 179 blocked operations; 117 of those operations are community reactions, all blocked only on the undated Forward D schema-registration gate;
- 2 source-proven course-cover media references targeting existing `payload_courses.coverImage`;
- 1 source-proven community-OG media reference targeting future `payload_spaces.ogImage`;
- 14 unresolved relationships: 6 `bunny_target_schema_guid_first_compatibility_required`, 7 `lesson_comment_schema_registration_required`, and 1 `space_media_schema_registration_required`.

Rich-text conversion, inline Bunny ordering, lesson comments, xprofile profile fields, member cover images, portal branding/settings, and the two course-cover targets are now source-reconciled. `customization_settings` and `welcome_banner_settings` are preserved losslessly under `portalSettings.legacySettings` unless an actual new-platform runtime equivalent is required. `snippets_settings.custom_css` and `custom_js` are empty and are never executed.

The local CLI remains read-only. `runLegacySourceDryRun.ts --jpv-private-tmp` is the verified local preset; its PII-bearing report stays outside the repository at mode `0600`.

### Remaining blockers after real-source PASS

1. Keep the six Bunny GUID-first compatibility blockers until undated Forward A can be registered after migration29. Forward A must also preflight and normalize the legacy varchar `bunny_videos.lesson_id` relationship before adding its real FK.
2. Keep the seven lesson-comment schema-registration blockers until undated Forward B can register the physical `payload_lesson_comments` schema and locked-doc relation.
3. Keep the single community `space_og_image` blocked on `space_media_schema_registration_required` until undated Forward C can add `payload_spaces.ogImage`. The two `space_cover_photo` rows require no new schema because they belong to migrated courses and target existing `payload_courses.coverImage`.
4. Complete idempotent binary media import execution tooling for source records whose targets are already known, including the two course covers.
5. Do not design or execute a staging-write packet until migration29 ordering is resolved, the prepared Forward A/B/C schema is authorized/registered, binary imports are executable, and explicit staging-write authorization is granted.



### DRY-8 Execution Attempt — 2026-08-13 — SOURCE FILES VERIFIED; BUNNY VERIFIER CONTRACT CORRECTED

Codex was used only as a local filesystem bridge/executor because Workbench cannot access `/tmp` or user folders outside the locked repository.

Codex verified and copied the four exact source artifacts to `/tmp` with byte-identical hashes:

- SQL: 7,624,098 bytes; source/destination hash equality YES.
- WXR: 299,769 bytes; source/destination hash equality YES.
- sanitized Stripe subscriptions inventory: 53,926 bytes; source/destination hash equality YES.
- sanitized Bunny inventory: 9,346 bytes; source/destination hash equality YES.

The first real Bunny verification attempt stopped safely before SQL/WXR reconciliation because the then-current migration utility called the obsolete endpoint `https://api.bunny.net/stream/{libraryId}/videos/{guid}` and expected a numeric Bunny video ID. The first usable GUID returned HTTP 404. The failed `staging-proof-upload-test` entry was skipped, and no fallback, invented ID, incomplete DRY-8 run, provider mutation, repository edit, database write, or commit was performed by Codex.

Post-attempt diagnosis against the current Bunny Stream API established:

- Stream API base: `https://video.bunnycdn.com`;
- GET video path: `/library/{libraryId}/videos/{guid}`;
- the response identifies the video by `guid`; no numeric Bunny video ID is returned for this migration to recover.

The repository dry-run tooling has now been corrected accordingly:

- `verifyLegacyBunnyVideos.ts` performs GET-only GUID verification on the current endpoint;
- `resolveLegacyBunnyVideoIds.ts` is intentionally deprecated/fail-closed;
- `legacyPayloadOperationPlan.ts` accepts verified GUID-backed source relationships without numeric-ID enrichment;
- proposed `bunny_videos` writes carry `bunny_target_schema_guid_first_compatibility_required` until a separately reviewed forward migration updates the target persistence schema;
- no existing/applied migration has been rewritten and the separate migration29 lane remains untouched.

**Historical checkpoint (superseded by the final DRY-8 PASS below):** at this point DRY-8 was blocked pending a second Codex execution using the corrected GUID verifier and full real-source `runLegacySourceDryRun.ts` report.



### DRY-8 Execution Attempt — Community Post Type Correction

A second Codex execution used the corrected GET-only Bunny GUID verifier successfully:

- Bunny library `581531` verification: PASS;
- 11 usable legacy GUIDs verified;
- 0 referenced Bunny GUIDs missing;
- failed/test Bunny asset skipped;
- no Bunny mutation performed.

The full dry-run then stopped safely at the strict source-count gate with one mismatch only:

- `feedPosts expected=80 actual=0`.

All other strict source counts matched, and the identity gate had already resolved 48 source subscriber accounts to 47 canonical members: 12 active / 35 blocked.

Root cause was a migration parser vocabulary error, not source drift. The real `wp_fcom_posts` dump stores ordinary community/feed posts with `type='text'`. `course_section` and `course_lesson` remain distinct `type` values. The separate `content_type` column also commonly contains `text`, while FluentCommunity media/reaction records may independently use the vocabulary `feed`; these fields must not be conflated.

Repository correction:

- `buildLegacyDryRunNormalization()` now classifies community/feed posts with `post.type === 'text'` instead of `post.type === 'feed'`;
- both synthetic migration fixtures now use the real `type='text'` value for community posts;
- TypeScript, `legacySourceDryRun.test.ts` (6/6), and `legacyPayloadOperationPlan.test.ts` pass after the correction.

**Historical checkpoint (superseded by the final DRY-8 PASS below):** after the feed-post parser fix, DRY-8 still required one real-source rerun outside Workbench's repository-scoped filesystem.



### DRY-8 Full Real-Source Report — Relationship Classification Follow-up

A subsequent Codex execution completed `runLegacySourceDryRun.ts` and generated the read-only report. Source verification itself passed:

- all 17 strict source-count gates matched;
- 48 source subscriber accounts → 47 canonical members → 12 active / 35 blocked;
- Nidia WP74 + WP76 resolved to one active canonical member using `nsgonza2@gmail.com`;
- Bunny verification passed for library `581531`: 11 reusable GUIDs verified, all 5 referenced GUIDs matched, 0 missing;
- 3 courses / 10 sections / 61 lessons reconciled with no missing course/module/progress parent;
- 104/104 WordPress attachments mapped, 0 missing;
- no Free/Pro/VIP entitlement behavior was introduced;
- no rich text was flattened and no historical content was silently discarded.

The first complete plan reported 10 entries as unexplained: `unresolved_comment_post=7` and `unresolved_media_context=3`. Follow-up source analysis shows those two categories were too coarse:

1. **Comments on known non-community FluentCommunity posts**
   - The planner previously looked only for a target `payload_space_posts` operation when resolving every comment.
   - The source SQL permits comments on course lessons (`enable_comments=yes`) and contains comments whose `post_id` points to `wp_fcom_posts.type='course_lesson'` records.
   - There is currently no target lesson-comment collection in this repo.
   - The planner now resolves each comment against the complete source `wp_fcom_posts` table first. A known `course_lesson` parent becomes `lesson_comment_target_model_required`; another known non-community source type becomes `comment_parent_target_model_required`; only an actually absent source parent remains `unresolved_comment_post`.
   - Known lesson comments are not forced into `payload_space_comments`. Their complete source rows remain preserved in the DRY-8 report pending a target lesson-discussion model.

2. **FluentCommunity platform media**
   - The three previously unexplained rows are the source platform assets with `object_source='onboarding'` (one row) and `object_source='general'` (two rows), all without feed/sub-object relationships.
   - These are known platform/social-preview assets, not orphaned post/lesson media.
   - They now become `platform_media_asset_requires_target_decision`, while `unresolved_media_context` is reserved for genuinely unknown source contexts.

The planner/CLI now exposes `communityComments`, `deferredLessonComments`, `deferredOtherSourceComments`, `platformMediaAssetsAwaitingTargetDecision`, and `unresolvedByCode` so the next real-source run can distinguish source loss from target-model decisions without manual report archaeology.

Validation after this classification change:

- `tsc --noEmit` → PASS;
- `legacySourceDryRun.test.ts` → PASS 6/6;
- `legacyPayloadOperationPlan.test.ts` → PASS, including community-comment routing, lesson-comment deferral, true missing-parent fail-closed behavior, onboarding/general platform-media classification, and truly unknown-media fail-closed behavior;
- `legacyMigrationBehavior.test.ts` → PASS 13/13.

**Historical checkpoint (superseded by the final DRY-8 PASS below):** one final real-source rerun was required to prove that `unresolved_comment_post` and `unresolved_media_context` both reached zero after the relationship-classification fixes.



### DRY-8 Historical Authority Checkpoint — PASS (superseded by the current live-source checkpoint above)

**Historical verdict:** `DRY-8 PASS` for the earlier 2026-08-12-era provider snapshot.  
**Current staging write readiness remains:** `BLOCKED`; use the newer 11 active / 36 blocked live-source checkpoint above for current gating.  
**Reviewed application checkpoint:** `43d569211acde5ae80f6e33524d40d432b417ce8`.  
**No commit, staging database write, provider mutation, deployment, or production operation was performed.**

Historical real-source evidence from that corrected read-only run:

- all 17 strict source-count gates passed: 51 WordPress users, 3 administrators, 48 FluentCRM contacts, 16 spaces, 182 source space memberships, 3 courses, 10 sections, 61 lessons, 80 community posts, 105 comments, 220 reaction/progress rows, 103 lesson completions, 6 course completions, 86 FluentCommunity media rows, 117 WXR items, 104 WXR attachments, and 386 local upload files;
- identity reconciliation passed: 48 source subscriber accounts → 47 canonical subscribers → 12 active / 35 blocked;
- Nidia WP74 + WP76 resolved to exactly one active canonical member using `nsgonza2@gmail.com`;
- Bunny source verification passed: 11 reusable GUIDs verified in library `581531`; all 5 referenced GUIDs matched; 0 missing;
- course reconciliation passed with 3 courses / 10 modules / 61 lessons, 36 active enrollments, 39 revoked historical enrollments, 103 lesson completions, and 6 course completions;
- community reconciliation passed with 4 migrated spaces, 7 navigation-only spaces, 2 excluded tier-upgrade functional spaces, 48 active space memberships, 64 blocked historical memberships, 80 posts, 98 routed community comments, and 7 deferred lesson comments;
- all 105 source comments are accounted for: 98 routed community comments + 7 deferred lesson comments + 0 deferred other-parent comments;
- WordPress media reconciliation passed: 104/104 WXR attachments mapped, 0 missing;
- FluentCommunity media reconciliation produced 40 community-file references, 25 lesson-resource references, 18 existing profile/space media target decisions, and 3 known platform-media target decisions; `unresolved_media_context=0`;
- `unresolved_comment_post=0` and there are **zero unexplained source/relationship blockers**;
- proposed non-executable Payload plan: 762 operations — 50 members, 50 profiles, 47 contacts, 3 courses, 10 modules, 61 lessons, 4 Bunny video records, 4 spaces, 75 course enrollments, 103 lesson-progress records, 112 space memberships, 80 posts, 98 comments, 25 lesson resources, and 40 space files;
- blocked proposed operations: 267, all attributable to explicit target-design gates rather than unexplained source loss;
- no target entitlement derives from historical Free/Pro/VIP tags;
- rich WordPress/HTML content was not flattened;
- no historical content was silently dropped.

Final unresolved codes are all **expected target-design work**:

- `richtext_wordpress_or_html_conversion_required`: 238 operation blockers;
- `lesson_resource_file_resolution_required`: 25;
- `bunny_target_schema_guid_first_compatibility_required`: 4;
- `media_asset_requires_target_decision`: 18;
- `platform_media_asset_requires_target_decision`: 3;
- `lesson_comment_target_model_required`: 7;
- `multiple_bunny_videos_per_lesson`: 1;
- `comment_parent_target_model_required`: 0.

Therefore the legacy **source discovery, normalization, identity reconciliation, entitlement classification, relationship reconciliation, and proposed-operation dry-run are complete**. Do not rerun DRY-8 unless source artifacts change or a target-design change requires a regression rehearsal.

#### Remaining work before any staging write

The next phase is target-model implementation/hardening, not further source archaeology:

1. approve and implement a lossless WordPress/HTML → Payload Lexical conversion path;
2. define protected/public Payload file resolution for the 25 lesson-resource references;
3. introduce a separately reviewed forward migration making `bunny_videos` GUID-first without rewriting previously applied migrations or conflating the separate migration29 lane;
4. choose target handling for 7 preserved lesson comments;
5. decide placement/retention rules for 18 profile/space media assets and 3 onboarding/general platform assets;
6. resolve the single lesson containing multiple Bunny videos with an explicit target-model decision;
7. rerun synthetic contracts and, only after those design gates are closed, perform a fresh read-only real-source regression before designing a staging-write packet.

**Current migration position:** DRY-1 through DRY-8 source rehearsal complete; source reconciliation is accepted; staging-write planning remains prohibited until the target-design backlog above is closed and separately validated.



#### DRY-8 Closeout Validation — 2026-08-13

Final repository validation after recording the accepted real-source PASS:

- `tsc --noEmit` → PASS;
- `legacySourceDryRun.test.ts` → PASS 6/6;
- `legacyPayloadOperationPlan.test.ts` → PASS;
- `legacyBunnyReadOnly.test.ts` → PASS;
- `legacyMigrationBehavior.test.ts` → PASS 13/13;
- `stripeSubscriptionMigration.test.ts` → PASS 35/35;
- high-risk scan on the zero-network migration core → zero findings;
- forbidden-runtime-execution scan across all modified migration/Bunny executables → zero findings;
- secret-material scan across all migration authority docs → zero findings.

No commit was created. The reviewed application checkpoint remains `43d569211acde5ae80f6e33524d40d432b417ce8`.



### Target-Design Hardening Run — Discovery Decisions

A new persistent Workbench run was opened after DRY-8 PASS to close target-design blockers without staging/provider/production writes or commits.

Current architecture decisions from exact repo inspection:

1. **Bunny persistence is GUID-first at runtime, but migration registration is currently ordered behind the isolated migration29 lane.**
   - Signed playback already requires `videoGuid`; the current Bunny Stream API also identifies videos by GUID.
   - `bunny_videos.video_id` is legacy compatibility state; `video_guid` must become required/canonical and numeric `video_id` nullable in a new forward migration.
   - The existing applied `20260718_110000_bunny_videos` migration must not be rewritten.
   - The controlled migration29 runner (`20260804_050000_member_account_action_reservations`) hard-codes 28→29 applied counts and requires that migration29 be the sole missing Payload migration. Registering any new dated forward migration now would make that runner see an additional pending migration and would conflate/block the separately reviewed lane. Therefore the GUID-first work can be designed and contract-tested in this hardening run, but canonical registration must wait until migration29 ordering is separately resolved/applied. `runStagingPayloadMigration.ts` will not be changed in this run.

2. **Lesson comments do not fit the existing community-comment model.**
   - `payload_space_comments.post` is structurally tied to `payload_space_posts`; there is no existing generalized lesson-comment/discussion collection.
   - The 7 preserved lesson comments must not be forced into community comments.
   - Smallest appropriate future target model: a lesson-scoped comment collection with required lesson, author, optional self-parent/thread relation, rich-text body, moderation status, migration/source metadata, and timestamps/indexes. This remains a target-model/product decision rather than an importer guess.

3. **Media mappings divide into deterministic and product-specific cases.**
   - `user_avatar` has a deterministic structural destination: `payload_member_profiles.avatar` via imported `payload_media`.
   - `user_cover_photo` has no target profile cover field today and remains a schema/product decision.
   - `space_document` can map to `payload_space_files` when its `feed_id` resolves to a migrated community post/space; it should not be lumped into generic profile/space media decisions.
   - `onboarding` / `general` platform preview assets have no structural target and remain explicit platform-media decisions.

4. **All legacy lesson documents are paid/member resources and fit the existing protected resource model.**
   - `payload_lesson_resources.protectedFile` points to `payload_private_media` and the guarded runtime prefers protected media over public media.
   - Legacy `lesson_document` resources should therefore plan a private-media import plus a draft lesson-resource record linked through `protectedFile`, with `downloadRequiresAccess=true` until the binary import succeeds. They must not be published as public `payload_media` fallbacks by default.

5. **Lossless rich-text conversion requires a DOM implementation that is not currently declared.**
   - The repo has `@payloadcms/richtext-lexical`, but no `jsdom`, `linkedom`, `happy-dom`, `parse5`, `htmlparser2`, or `cheerio` dependency.
   - The installed converter requires a DOM/JSDOM constructor. No dependency or lockfile change is authorized in this run without a separate explicit decision. Rich text remains fail-closed and is never flattened.

6. **The one lesson with multiple Bunny videos is genuinely ambiguous in the current model.**
   - `payload_lessons.bunnyVideo` is singular and `bunny_videos.lesson` is documented as one video per lesson.
   - Do not silently choose one GUID or invent ordering. Keep this as one explicit product/model decision.

Safe implementation batch for this run: improve deterministic `space_document` routing and protected lesson-resource planning; prepare/validate the GUID-first Bunny migration design without registering/applying it; leave lesson comments, rich-text dependency, cover/platform media placement, and multi-video behavior explicitly blocked where product/schema decisions are required.



### Target-Design Hardening — Implementation Checkpoint

The safe deterministic hardening batch is implemented and validated without staging/provider/production writes or commits.

Closed target-design items:

1. **Protected lesson-resource target placement — CLOSED at the planning/schema level.**
   - Legacy paid lesson documents now propose a `payload_private_media` binary-import operation.
   - The corresponding `payload_lesson_resources` proposal links `protectedFile` to that private-media operation, remains `status='draft'`, and keeps `downloadRequiresAccess=true`.
   - The prior ambiguous `lesson_resource_file_resolution_required` design blocker is replaced by the narrower execution blocker `lesson_resource_private_media_import_required` on the binary import itself.
   - No binary upload or staging write is performed by the dry-run planner.

2. **FluentCommunity `space_document` placement — CLOSED when the source feed relationship resolves.**
   - `space_document` rows now route deterministically to `payload_space_files` attached to the resolved migrated community post/space.
   - They are no longer counted as generic profile/space media target decisions.

3. **FluentCommunity `user_avatar` placement — CLOSED at the planning/schema level.**
   - A `user_avatar` row now proposes a `payload_media` binary-import operation and wires the canonical `payload_member_profiles.avatar` relationship to it.
   - Merged source identities resolve through the canonical profile operation, so avatar mapping does not split merged members.
   - Binary transfer remains explicitly blocked by `member_avatar_media_import_required` until a later authorized media-import execution.
   - `user_cover_photo` remains unresolved because the current profile schema has no cover-photo field.

4. **Bunny runtime GUID-first compatibility — IMPLEMENTED.**
   - `src/lib/bunny-api.ts` now uses the current `https://video.bunnycdn.com` Stream API and normalizes Bunny `guid` to application `videoGuid`.
   - The obsolete playback-token helper is fail-closed/deprecated; protected playback continues to use the local GUID-based signer.
   - `src/collections/PayloadBunnyVideo.ts` treats numeric `videoId` as optional legacy compatibility metadata and `videoGuid` as canonical/unique for current records.
   - `src/app/api/admin/bunny/create-video/route.ts` persists GUID-first records and keeps response `videoId` only as a compatibility alias containing the GUID string.
   - `src/app/api/webhook/bunny/route.ts` performs GUID-primary idempotency/upserts with numeric `VideoId` only as an optional legacy fallback.
   - Payload generated types were regenerated locally after the collection change; no database/provider/network action was required.

5. **Bunny GUID-first forward migration design — COMPLETE, registration intentionally deferred.**
   - Exact forward/down SQL design is captured in `docs/migration/BUNNY_GUID_FIRST_FORWARD_MIGRATION_DRAFT.md`.
   - The migration is intentionally not registered under `src/migrations` yet because the controlled migration29 lane requires migration29 to remain the sole canonical pending migration.
   - `scripts/payload_migration_inventory_contract.test.ts` still proves exactly 29 canonical migrations and migration29 remains last.
   - No migration29 file, registry ordering, or staging migration runner was changed by this hardening run.

Remaining genuine decision/authorization boundaries:

- **Lesson comments:** 7 source lesson comments remain preserved/deferred; there is no existing generalized lesson-comment model. A lesson-scoped comment collection/product decision is required before implementation.
- **Rich text:** lossless HTML/WordPress → Lexical conversion requires a DOM implementation not currently declared. No dependency/lockfile change was made; explicit dependency approval is required before implementation.
- **Profile cover/platform media:** `user_cover_photo` and onboarding/general platform assets have no structural target field today. A schema/product placement decision is required.
- **One multi-video lesson:** the current lesson/Bunny model is singular; selecting or ordering multiple source videos is a product/model decision.
- **Migration30 registration:** the GUID-first schema migration can only be registered after the migration29 ordering lane is explicitly resolved/rebased.
- **Media execution:** avatar and protected lesson-resource mappings are now structurally decided, but actual binary import remains a later authorized execution step.

Validation after the hardening implementation:

- `legacyPayloadOperationPlan.test.ts` → PASS, including protected lesson-resource/private-media planning, `space_document` routing, canonical `user_avatar` profile wiring, preserved `user_cover_photo` decision blocking, comment deferrals, platform-media classification, and GUID-first Bunny proposals;
- `tsc --noEmit` → PASS;
- `bunny_guid_first_runtime.test.ts` → PASS;
- `bunny_config_aliases.test.ts` → PASS;
- `legacyBunnyReadOnly.test.ts` → PASS;
- `legacySourceDryRun.test.ts` → PASS 6/6;
- `legacyMigrationBehavior.test.ts` → PASS 13/13;
- `stripeSubscriptionMigration.test.ts` → PASS 35/35;
- `payload_migration_inventory_contract.test.ts` → PASS; exactly 29 canonical migrations remain registered and migration29 remains last;
- high-risk scan on the zero-network migration core → zero findings;
- forbidden-runtime-execution scan across modified migration/Bunny executables → zero findings;
- secret-material scan across migration authority docs and the Bunny migration draft → zero findings.

**Staging-write readiness remains BLOCKED** only on the explicit target-model/dependency/migration-order/execution decisions above. Source reconciliation remains PASS and does not need to be repeated until one of those target designs changes or a final pre-write regression is requested.



### Target-Design Decision Closure — Remaining Model Decisions

The remaining target-model questions were re-inspected against the current lesson/community runtime and the real 2026-08-12 source evidence. The following decisions are now authoritative for migration planning; schema registration remains deferred behind migration29.

#### Lesson comments — implemented real discussion target

The 7 preserved lesson comments are **not** mapped to `payload_space_comments`. They use the registered lesson-scoped `payload_lesson_comments` collection and the dedicated lesson-discussion runtime.

Implemented collection/runtime contract:

- required `lesson` relationship → `payload_lessons` (indexed);
- required canonical `author` relationship → `payload_members` (indexed), with human `displayName` preserved for member-facing historical authorship;
- optional self-referential `parent` relationship with same-lesson enforcement;
- required `body` Lexical richText produced by the approved lossless converter;
- exact `legacyBodyHtml` plus `source.raw`/conversion diagnostics and migration/source metadata;
- moderation state compatible with visible/pending_review/hidden/deleted;
- unique/indexed `legacyCommentId` plus original `sourceCreatedAt` for idempotency/history;
- visible historical listing, active-member posting/replies, hidden-parent rejection, community-equivalent rate limiting and audit events;
- blocked/non-entitled members preserve historical authorship but cannot create/reply.

The planner emits real `payload_lesson_comments` operations and keeps only `lesson_comment_schema_registration_required` where the physical post-migration29 schema is not yet registered. The runtime collection/config is already implemented; migration29 remains untouched and sole canonical pending migration.

#### Cover and platform media — current target placement

`user_cover_photo` now has a real target-equivalent member feature: `payload_member_profiles.coverImage` → `payload_media`, with historical display plus active-member upload/replace/remove controls. The source-proven cover relationship and member-facing runtime are implemented; deterministic legacy binary media import/linking remains a later authorized execution step.

`onboarding` / `general` platform assets and portal branding/settings are different: their active JPV semantics are still source-evidence gated because the uploaded SQL/source is not currently retrievable through this run. Do not invent `portalSettings`, dynamic branding fields, or archive-only semantics for an actively configured legacy feature without source proof.

- member cover functionality → `TARGET_EQUIVALENT_EXISTS`; binary legacy cover import/linking remains later execution;
- onboarding/general/portal assets → preserve source identity and provenance, but keep semantic target classification blocked until actual JPV settings evidence is available;
- portal/settings/colors/custom CSS/JS fields are added or reimplemented only when the real source proves populated/configured usage;
- legacy custom JavaScript is never auto-executed during migration.

The planner/runtime must therefore distinguish implemented member-cover parity from unresolved source-specific portal/settings semantics rather than grouping both into an archive-only media decision.

#### Multi-video lesson — ordered preservation decided

The real source identifies the single multi-video lesson as FluentCommunity lesson ID `14`, **“Lesson 1 - Biblical Foundation & Mindset for New Beginnings”** (`slug='lesson-1'`). Its source body intentionally contains two sequential Bunny embeds, in this order:

1. `56266f09-d651-4bc5-a5b0-ac9185018018`;
2. `cda4b492-91af-430d-9bba-4268ccaf8cc2`.

The surrounding source copy describes multiple student testimonies, so both videos are intentional content. Do not select one as a silent primary and do not discard either GUID.

Implemented target design: preserve each recognized Bunny embed directly inside `payload_lessons.content` as a custom Lexical `bunnyVideo` block at its original document position.

- each block stores the canonical Bunny GUID plus migration provenance needed by the managed player;
- lesson 14 preserves both verified GUIDs in exact source order, with surrounding source text retained;
- no `payload_lesson_videos` ordered join is created and no silent primary video is invented;
- existing singular `payload_lessons.bunnyVideo` remains only a backward-compatibility/hero-video field for ordinary existing lessons;
- member playback verifies the requested inline GUID is actually present in the entitled lesson before signing Bunny playback.

The runtime and planner implementation are complete. The remaining forward-schema concern is only the post-migration29 Payload schema compatibility required by the registered Lexical migration blocks and GUID-first Bunny model; there is no lesson-video join registration blocker.

#### Rich-text conversion — exact dependency gate

Payload's supported HTML→Lexical flow uses `convertHTMLToLexical`, `editorConfigFactory`, and a caller-supplied `JSDOM` constructor. The repo currently has `@payloadcms/richtext-lexical@3.87.1` but no direct DOM dependency.

For the repo's Node 20 runtime, the approved technical recommendation is **`jsdom@26.1.0`** with **`@types/jsdom@21.1.7`** for TypeScript declarations. `jsdom@26.1.0` declares Node `>=18`; newer jsdom 30 requires Node 22.22.2+ and is therefore not appropriate for the current runtime. The converter must additionally preprocess/upload known local WordPress images before conversion and inject Payload Lexical upload attributes rather than silently dropping `<img>` nodes.

No package or lockfile change has been made. Explicit dependency approval remains required before implementing the converter. The intended implementation slice after approval is:

1. add the two pinned dependencies;
2. create a migration-only HTML→Lexical utility using `editorConfigFactory` + `convertHTMLToLexical({ JSDOM, ... })`;
3. pre-resolve mapped WordPress images/media into Payload media relationships before conversion;
4. round-trip representative paragraphs, headings, lists, links, blockquotes, inline formatting, images, and embedded-media placeholders through Lexical→HTML assertions;
5. retain original source HTML in migration evidence for every converted record;
6. keep any unsupported block/HTML structure fail-closed and reported rather than flattening it.

#### Migration ordering — unchanged

Migration29 remains the sole canonical pending Payload migration. Do not register any dated forward migration until migration29 is separately resolved/applied/rebased and the canonical migration inventory contract is intentionally advanced. The current undated preparation sequence is Forward A (Bunny GUID-first + lesson FK normalization), Forward B (`payload_lesson_comments` physical schema), and Forward C (`payload_spaces.ogImage`). The superseded ordered lesson-video join is not part of the forward schema.



### Target-Design Decision Closure — Final Validation

The target-design decision phase is complete. All remaining product/model ambiguities identified after DRY-8 now have explicit migration targets or explicit approval/order gates; no staging/provider/production writes or commits were performed.

Current decided target designs:

- lesson comments/discussions → real registered `payload_lesson_comments` functionality; migration preserves all seven historical comments with Lexical body, human display name, exact `legacyBodyHtml`/raw source, timestamps, authorship and provenance; entitled active members can post/reply while blocked/non-entitled members preserve history but cannot mutate;
- member `user_cover_photo` → active `payload_member_profiles.coverImage` relationship and account upload/replace/remove behavior; target functionality exists, while deterministic legacy binary import/linking remains a later execution step;
- onboarding/general platform media and portal branding/settings → source evidence is complete; three platform media records map to `portalSettings.logo` / `loginBanner.logo`, `whiteLogo`, and `featuredImage`, while supported login/banner/form settings are active and unsupported customization/welcome/signup settings remain inert under `legacySettings`;
- multi-video FluentCommunity lesson 14 → inline Lexical `bunnyVideo` blocks preserve both verified Bunny GUIDs in exact source order with surrounding text context; no `payload_lesson_videos` join and no silent primary;
- rich-text conversion → implemented through the approved JSDOM + Payload `convertHTMLToLexical` path with exact source retained and fail-closed `LegacyHTMLBlock` fallback plus specific media/embed/code blockers;
- reactions → no generalized reusable reaction runtime currently exists; do not fake a `payload_space_comments` reaction relationship, and add a lesson-specific target only if actual JPV source proves lesson-comment reactions require migration/functionality;
- migration ordering → migration29 remains the sole canonical pending migration; Bunny GUID-first compatibility and subsequent feature-parity schema remain intentionally unregistered until that lane is separately resolved.

The non-executable planner now emits real Lexical lesson/post/community-comment/lesson-comment bodies, source diagnostics/provenance, real lesson-comment records, cover/media planning, protected lesson resources, avatar mapping, space documents and GUID-first Bunny records. Physical schema registration and binary import execution remain gated behind migration29/source evidence/explicit staging authorization as applicable.

Latest immediate planner validation before this documentation refresh:

- `tsc --noEmit` → PASS after async planner/caller conversion and type repair;
- `legacyPayloadOperationPlan.test.ts` → PASS with real Lexical lesson/post/community-comment/lesson-comment bodies, exact source evidence, fallback-block assertions and both lesson-14 Bunny GUIDs preserved in source order;
- `legacyRichText.test.ts` → PASS;
- `lesson-discussion.test.ts` → PASS 7/7;
- `legacySourceDryRun.test.ts` → PASS 6/6.

The complete closeout suite, production build, security scans and final migration29/HEAD/worktree safety verification must be rerun on this exact latest state before this dry-run plan can claim final closeout evidence.

**Target-design decisions: 100% resolved.**

**Staging-write readiness remains BLOCKED** on explicit authorization/order/execution gates only:

1. separate resolution/application/rebase of migration29 before any dated forward migration is created or registered;
2. authorized registration of the prepared undated Forward A/B/C schema: Bunny GUID-first plus lesson FK normalization, physical `payload_lesson_comments`, and `payload_spaces.ogImage`;
3. later authorized binary import execution for already-resolved media targets, including the two course covers, member media, PortalSettings media, and protected lesson resources;
4. a fresh real-source read-only regression after any eventual registered forward schema and immediately before any staging-write packet is designed.

The current real-source regression **has already run successfully** against the preparation-only planner and is useful precisely because it proves there are no unexplained source relationships: 935 operations / 179 blocked / 14 unresolved. The 117 community-reaction operations are all deterministically mapped (61 `post`, 36 `comment`, 20 `survey_option`) and blocked only on Forward D schema registration; unresolved relationships remain 6 Bunny + 7 lesson-comment + 1 community-OG schema blocker.



### Feature-Parity Preparation Goal — 2026-08-14

The user approved a stricter migration acceptance standard: source rows are not enough. Every legacy data family and every feature actually enabled or used by this JPV instance must have an equivalent Payload-native implementation, an explicitly documented intentional replacement, or lossless preservation behind a named target implementation blocker. Prefer preserving too much over discarding information.

This goal supersedes earlier archive-only assumptions where those assets represented real legacy functionality. In particular:

- lesson comments must become real lesson discussion functionality for active members, not historical archive-only records;
- `user_cover_photo` must become an active member profile cover image when source usage is proven;
- portal/onboarding/general branding assets and settings must map to a real Payload portal-settings target when source usage proves they were active configuration;
- inline/multiple Bunny embeds must preserve their source position/context in rich lesson content rather than being reduced to an arbitrary single primary video;
- source-proven profile metadata such as headline, biography, website, social links, and related member profile views must be supported where the actual JPV source contains them;
- legacy custom CSS/JavaScript is preserved as inert source evidence and reviewed/reimplemented safely rather than executed automatically.

Approved dependency gate is now open for migration-only rich-text conversion:

- `jsdom@26.1.0`;
- `@types/jsdom@21.1.7`.

The dependency lockfile has been regenerated with pnpm and the required migration tooling dependencies are present. Migration29 remains untouched and unapplied; all undated post-migration29 forward-schema work remains unregistered until migration29 ordering is separately resolved.

Implementation roadmap for this Goal run:

1. implement deterministic HTML→Lexical conversion with JSDOM, original-HTML preservation, custom `LegacyHTMLBlock` fallback, and inline Bunny block support;
2. complete a source-driven JPV feature-parity inventory and durable matrix;
3. implement source-proven member profile parity including active cover-image behavior and any actually populated profile fields;
4. implement source-proven portal/branding settings as Payload Global state;
5. implement real lesson discussions for active members while preserving blocked-member historical authorship;
6. preserve inline/multiple Bunny videos in lesson rich-text order/context while retaining existing singular hero-video compatibility;
7. prepare forward-schema drafts/order without modifying or applying migration29;
8. prepare deterministic idempotent binary-media import architecture with provenance and protected/public targets;
9. update the non-executable migration planner for all approved targets;
10. after target schemas/converter/runtime are complete, run one fresh read-only real-source regression plus feature-parity acceptance matrix before any staging-write packet is designed.

No staging database, Stripe, Bunny, Dokploy, deployment, production, or Git commit mutation is authorized by this goal.
