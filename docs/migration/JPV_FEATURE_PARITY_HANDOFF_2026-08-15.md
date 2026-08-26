# JPV Bootcamp Feature-Parity Migration Handoff — 2026-08-15

> **Historical handoff — not a current execution packet.** This document records the 2026-08-15 implementation checkpoint and its migration29 safety boundary. The current source has advanced to a 36-migration registry; use `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md` for current release status. No staging or production action is authorized by this historical handoff.

## Resume authority

- sourceId: `prochattools-jpv-bootcamp`
- branch: `feature/course-branding-and-preview`
- active Goal runId: `agent-358d6669-f6f5-42b5-8c35-1765270e1203`
- active sessionId: `session-agent-358d6669-f6f5-42b5-8c35-1765270e1203`
- reviewed checkpoint / current HEAD expectation: `43d569211acde5ae80f6e33524d40d432b417ce8`
- **DO NOT COMMIT**
- **NO staging/provider/production writes**
- **DO NOT touch migration29**
- **DO NOT touch `.env.production.BAK` or unrelated worktree residue**

## Goal

Complete Payload CMS legacy feature parity and migration preparation for the real JPV Bootcamp WordPress + FluentCommunity + FluentCRM migration. Preserve all actually-used legacy data/functionality. Missing target functionality must be implemented cleanly rather than silently dropping source data.

The new platform has one membership only. Legacy Pro/VIP become active; legacy free/non-paid become blocked/deactivated. Never derive target entitlement from FluentCRM Free/Pro/VIP tags.

Identity invariant:

- historical 2026-08-12 reconciliation: `48 source subscriber accounts -> 47 canonical people -> 12 active / 35 blocked`;
- current verified live Stripe refresh (2026-08-15 artifact): `48 source subscriber accounts -> 47 canonical people -> 11 active / 36 blocked`.

The 12/35 result remains historical evidence; current rehearsal gating uses 11/36 because the live sanitized Stripe inventory contains 11 active subscriptions.

Nidia invariant:

`WP74 + WP76 -> one canonical member -> nsgonza2@gmail.com`

## Source reconciliation already accepted

DRY-8 source reconciliation is PASS with zero unexplained source/relationship blockers. Accepted strict counts:

- WordPress users 51
- administrators 3
- FluentCRM contacts 48
- spaces 16
- space memberships 182
- courses 3
- sections/modules 10
- lessons 61
- feed/community posts 80
- source comments 105
- reactions/progress source rows 220
- lesson completions 103
- course completions 6
- FluentCommunity media 86
- WXR items 117
- WXR attachments 104
- local uploads 386

Do not reopen these conclusions without contradictory source evidence.

## Completed feature-parity implementation

### Rich text / inline Bunny

Approved dependencies are already declared and lockfile regenerated normally with repository-pinned pnpm:

- `jsdom@26.1.0`
- `@types/jsdom@21.1.7`

Implemented:

- `LegacyMigrationBlocks` registered in root Payload Lexical editor.
- deterministic `scripts/migration/legacyRichText.ts` HTML -> Payload Lexical conversion.
- exact original HTML retained as migration evidence.
- unsupported/unresolved fragments fail closed through `LegacyHTMLBlock`; no HTML flattening.
- `LegacyHTMLBlock` stores exact `html` plus sanitized inert `safeHtml`.
- inline Bunny embeds become `BunnyVideoBlock` using canonical GUID and preserve document order.
- lesson playback API supports entitlement-protected inline `videoGuid` lookup.
- arbitrary/page/post GUID requests are rejected by runtime contracts.
- `ManagedBunnyVideoPlayer` supports inline GUID playback.
- `LegacyLessonRichText` renders complete lesson Lexical content.
- lesson page no longer relies on lossy `contentHtml` projection.
- provisional `payload_lesson_videos` planner join has now been removed; inline Lexical Bunny blocks are the source-order mechanism.

### Member cover image

Implemented end-to-end:

- `payload_member_profiles.coverImage -> payload_media`
- historical cover projection
- active eligible member upload/replace/remove
- blocked member mutation denial
- image MIME validation + 8 MB limit
- security/audit events
- old media retained after unlink
- account UI preview/controls
- existing avatar behavior preserved
- Payload types regenerated

### Lesson discussions

Implemented real `payload_lesson_comments` functionality:

- collection registered in Payload config
- lesson relationship
- canonical member author
- parent/reply relationship
- rich-text body
- `legacyBodyHtml`/provenance
- moderation/status behavior
- source timestamps / legacy comment ID/idempotency
- entitlement enforcement
- visible historical comments
- active comment creation and replies
- same-lesson parent enforcement
- hidden-parent rejection
- community-equivalent rate limiting
- audit events
- human/canonical display names
- member lesson discussion UI with historical timestamps/authorship
- blocked members preserve authorship but cannot mutate

Seven legacy lesson comments are now planned into this real target rather than `payload_space_comments`.

A canonical dated migration for this collection is **not registered** because migration29 remains the sole canonical pending migration. Keep the forward schema in draft form only until ordering permits registration.

### Migration operation planner — latest state

`buildLegacyPayloadOperationPlan` is now async and callers have been converted to await it.

Real Lexical conversion is wired for:

- lessons
- community posts
- ordinary community comments
- lesson comments

Each path preserves exact raw source HTML/message plus conversion diagnostics.

Specific fail-closed blockers replace the blanket rich-text blocker where applicable:

- `richtext_unresolved_image_media_resolution_required`
- `richtext_embed_target_implementation_required`
- `richtext_legacy_code_review_required`

Lesson comments retain `lesson_comment_schema_registration_required` while migration29 blocks physical forward-schema registration.

Latest planner test changes prove:

- lesson has real Lexical content
- inline Bunny block is present in lesson content
- community post/comment have real Lexical bodies
- lesson comment has real Lexical body + displayName + legacyBodyHtml
- exact source HTML remains under `source.raw`
- unresolved image becomes `LegacyHTMLBlock` plus the specific image-resolution blocker
- two Bunny embeds remain in source order in Lexical
- no `payload_lesson_videos` operations/join blocker remain

## Latest validation evidence

Latest current-state results before this handoff:

- `tsc --noEmit`: **PASS** after async planner/caller and latest type repair
- `scripts/migration/legacyPayloadOperationPlan.test.ts`: **PASS** after latest rich-text/multi-video/fallback assertions
- `scripts/migration/legacyRichText.test.ts`: **PASS**
- `src/__tests__/lesson-discussion.test.ts`: **PASS 7/7**
- `scripts/migration/legacySourceDryRun.test.ts`: **PASS 6/6**

Previously green and should be rerun for final closeout:

- `bunny-video-auth.test.ts` 13/13
- `member-cover-image.test.ts` 5/5
- `legacy-lesson-rich-text-design.test.ts` 2/2
- Bunny GUID-first/runtime/config/read-only contracts
- Stripe migration safety contract
- Payload migration inventory contract

## Source feature audit — completed from verified local artifacts

The raw source bundle is now directly retrievable and was audited read-only from:

- `/private/tmp/127_0_0_1.sql` — 7,624,098 bytes — SHA-256 `cf6fcb585411360076bbb01164437543ab3debd568cb7b1b37c1d8ee8a4da70e`
- `/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml` — 299,769 bytes — SHA-256 `186de11d2f5fed7d1f964a66d0df3fb83049d1fd87d6e2972decfd24c91cc5c8`
- `/private/tmp/jpv-stripe-live-subscriptions.json` — 31,114 bytes — SHA-256 `5ed3457ed96020165f15a0b03952a25d756c43a481da03af9836ca4938a23523`
- `/private/tmp/jpv-bunny-migration-inventory.json` — 7,524 bytes — SHA-256 `f9a6fe7990ec0585a7645558ce597c20b943c0efbb94d92389c568917f27533c`
- WordPress/media binaries remain under `src/assets/uploads`.

The live provider evidence is mutation-free: Stripe account `acct_1Sed9ULQNsjxBhGB` has 11 active subscriptions; Bunny library `581531` has 12 videos, 11 reusable/finished and one failed test video.

Source-proven member-profile usage:

- `wp_fcom_xprofile`: 51 rows;
- 11 non-empty short descriptions and 11 non-empty WordPress descriptions;
- website 4;
- Facebook 4;
- Instagram 2;
- LinkedIn 2;
- Twitter/X 1;
- YouTube 1;
- `cover_photo` 2;
- `headline` key exists but has **zero non-empty values**, so no headline target is invented.

The planner now migrates these xprofile fields into `payload_member_profiles`, using the canonical WP user's profile first with deterministic duplicate-source fallback. Biography uses the approved Lexical converter; exact xprofile raw metadata and conversion diagnostics are retained. The current real-source plan reports `memberProfilesWithLegacyProfileData = 47`.

A5 remaining-parity audit evidence is aggregate-only and PII-safe. Reactions/progress comprise 220 rows total: 117 community reactions and 103 lesson completion/progress rows. The community set is fully associated with migrated targets: 81 post-associated reactions (61 direct feed reactions plus 20 survey-option votes whose target post resolves through source `object_id`; `parent_id` is provenance only) and 36 comment reactions, with 0 orphan community targets. Reaction types are 91 `like`, 6 `bookmark`, and 20 `survey_vote`; all 220 reaction/progress rows resolve to a source user and 189/220 resolve to canonical members. A5 measured **zero lesson-specific social reactions beyond completion/progress**, so no separate lesson-social-reaction migration target is source-proven. Community reaction target/runtime architecture remains intentionally undecided for the next HIGH checkpoint.

A5 also classifies legacy member-directory/public-profile usage as source-proven configuration evidence without selecting a target UX: `member_list_layout` is present, one member-related navigation reference exists, and FluentCommunity access configuration (`access`, `access_roles`, `acess_level`) is populated. There is no explicit directory-enable, public-profile, or profile-access/privacy key. The target already has the account profile editor and migrated biography/website/social/cover data, but no member-directory route and no public/member-profile route. Existing posts/comments/memberships can support derived activity without duplicated data or inherently requiring new schema. Exact UX/privacy/runtime scope remains for the HIGH architecture checkpoint.

Source-proven portal/settings usage:

- `fluent_community_settings.site_title`, primary logo, white logo and featured image are populated;
- `auth_settings.login.banner` and `auth_settings.login.form` contain populated titles/descriptions/colors/button labels and branding;
- `customization_settings` is populated and is preserved losslessly under `portalSettings.legacySettings` rather than recreating legacy layout behavior that the new portal does not need;
- `welcome_banner_settings` is preserved under `legacySettings`; its `enabled`, `allowClose`, `bannerVideo`, `mediaType`, `type`, login and logout structures are non-empty, while `bannerImage`, CTA content and description are empty;
- `snippets_settings.custom_css` and `custom_js` both exist but are **empty**. They are never executed or materialized as executable Payload fields.

The existing `portalSettings` Global is now source-proven. The planner emits one Global operation that maps the supported site/login branding fields and preserves unsupported legacy settings plus exact serialized source evidence. Three source media records are definitively mapped to `portalSettings.logo`/`loginBanner.logo`, `whiteLogo`, and `featuredImage`.

Three Stripe orphans remain intentionally blocked/historical: all are `canceled` and `missing_customer_email`; none can activate a member.

## Migration29 / forward-schema boundary

Migration29 remains the sole canonical pending migration and must stay isolated.

Do not modify, register around, apply, or conflate migration29 in this goal.

The prepared post-migration29 forward schema is now explicit and **undated**:

- **Forward A — Bunny GUID-first compatibility:** add nullable canonical `video_guid`, make legacy numeric `video_id` optional, and read-only preflight/normalize original varchar `lesson_id` to a real `payload_lessons` FK;
- **Forward B — `payload_lesson_comments`:** register the already-implemented physical table/enum/FKs/indexes plus locked-document relation without changing runtime behavior;
- **Forward C — `payload_spaces.ogImage`:** add the one new community-space media relationship proven by source. The two source `space_cover_photo` records belong to migrated courses and already target existing `payload_courses.coverImage`, so they require no new schema.

Authority: `docs/migration/POST_MIGRATION29_FORWARD_SCHEMA_PREPARATION.md` and `scripts/migration/postMigration29ForwardSchemaPlan.ts`.

Never rewrite an applied migration, and do not create/register a dated forward migration until migration29 ordering is explicitly resolved.

## Exact next work

1. Continue from the current working tree; do not rediscover completed rich-text, xprofile, PortalSettings, course-cover, lesson-discussion, or inline Bunny work.
2. Treat `docs/migration/POST_MIGRATION29_FORWARD_SCHEMA_PREPARATION.md` and `scripts/migration/postMigration29ForwardSchemaPlan.ts` as the current forward-schema authority.
3. Keep all forward work preparation-only. Do **not** create/register/apply a dated migration until migration29 ordering is explicitly resolved.
4. Validate the undated plan and planner integration:
   - `type-check:payload`;
   - `postMigration29ForwardSchemaPlan.test.ts`;
   - `legacyPayloadOperationPlan.test.ts`;
   - `legacySourceDryRun.test.ts`;
   - `lesson-discussion.test.ts`;
   - Bunny GUID-first/config/GET-only/read-only contracts;
   - `payload_migration_inventory_contract.test.ts`.
5. Rerun the full READ-ONLY real-source regression after any planner/forward-plan change and require:
   - 48 source → 47 canonical → 11 active / 36 blocked;
   - 104/104 attachments mapped;
   - zero missing Bunny GUIDs;
   - 47 xprofile-backed profiles;
   - one `portalSettings` Global;
   - 2 course-cover media references targeting existing `payload_courses.coverImage`;
   - 1 community-OG media reference targeting future `payload_spaces.ogImage`;
   - current measured plan: 935 operations / 179 blocked / 14 unresolved = 117 community-reaction operations blocked only on `community_reaction_schema_registration_required`, plus 6 Bunny + 7 lesson-comment + 1 community-OG unresolved schema relationships.
   - A2 read-only media/archive manifest: 533 records; all 43 planner binary-import intents covered; 3 locally resolvable and 40 external/remote with no network fetch; 18 public / 25 private imports; 104/104 WXR attachment records; all 386 local upload files represented; 279 archive-only unmatched; 0 missing local-class binary sources.
   - A3 zero-write media execution plan: 533 deterministic entries / 43 future execution intents; 3 ready after write authorization, 39 require remote-source acquisition, 1 schema-blocked community OG intent, 0 source-missing; 18 public / 25 private; 6 relationship-bearing; 43 rollback-ledger templates; 1 duplicate-checksum group reported without automatic coalescing; `mutationMode=none`, `networkAuthorized=false`, `outputWritten=false`.
   - A4 zero-network remote acquisition plan: 40 remote source definitions because the schema-blocked community OG is itself remote in addition to the 39 A3 remote-acquisition dispositions; 15 public / 25 private; all 40 are source-proven `s3`, HTTPS, provider-credential-required, and `acquisition_definition_ready`; 0 authentication-unknown, 0 fail-closed definitions, 0 known pre-acquisition checksums, 0 known pre-acquisition byte counts; locator hosts classify 31 object-storage-origin / 9 legacy-origin; `networkAuthorized=false`, `outputWritten=false`.
6. Keep binary media import execution separate from schema preparation. The two course covers have resolved targets but still require binary import execution.
7. Run targeted security scans and the final protected-path/status safety snapshot before closing this preparation phase.
8. Keep PII-bearing reports outside the repository and preserve `.env.production.BAK` plus unrelated residue untouched.

## Hard restrictions

- NO commit
- NO staging database writes
- NO Stripe mutation
- NO Bunny mutation
- NO Dokploy mutation
- NO production operations
- DO NOT touch migration29
- DO NOT touch `.env.production.BAK`
- DO NOT discard unrelated dirty worktree residue
- DO NOT flatten legacy HTML
- DO NOT derive target entitlement from Free/Pro/VIP tags

## Resume prompt for a new conversation

```text
Resume the active JPV Bootcamp Payload legacy feature-parity Goal directly in Workbench.

Read first:
- docs/migration/JPV_FEATURE_PARITY_HANDOFF_2026-08-15.md
- docs/migration/POST_MIGRATION29_FORWARD_SCHEMA_PREPARATION.md
- docs/migration/LEGACY_STAGING_DRY_RUN_PLAN.md
- docs/migration/LEGACY_FEATURE_PARITY_MATRIX.md
- docs/migration/LESSON_INTERACTIONS_AND_VIDEO_ORDERING_DRAFT.md
- docs/migration/BUNNY_GUID_FIRST_FORWARD_MIGRATION_DRAFT.md

sourceId: prochattools-jpv-bootcamp
runId: agent-358d6669-f6f5-42b5-8c35-1765270e1203
branch: feature/course-branding-and-preview
reviewed checkpoint: 43d569211acde5ae80f6e33524d40d432b417ce8

Continue from the exact current working tree. Do not rediscover or reimplement completed rich-text, cover-image, lesson-discussion, Bunny inline-video, or planner work.

First verify active run/source/HEAD/status, then follow the handoff's Exact next work through docs, complete validation, security scans, and final safety verification.

The raw SQL/WXR/Stripe/Bunny source audit is complete and the latest read-only real-source regression passes. Continue from the undated post-migration29 forward-schema preparation. Current measured authority is 935 operations / 179 blocked / 14 unresolved. The 117 added community-reaction operations are all blocked on the undated Forward D schema-registration gate; unresolved relationships remain only six Bunny GUID-first compatibility blockers, seven lesson-comment schema-registration blockers, and one community `space_og_image` → future `payload_spaces.ogImage` blocker. The two source `space_cover_photo` records belong to migrated courses and already target existing `payload_courses.coverImage`; they are not schema blockers. Do not invent additional profile/portal fields, community cover fields, or legacy code execution.

NO COMMIT.
NO staging/provider/production writes.
DO NOT touch migration29.
DO NOT touch .env.production.BAK or unrelated residue.
```
