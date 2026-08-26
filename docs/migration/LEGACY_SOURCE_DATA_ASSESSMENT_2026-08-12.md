# Legacy Source Data Assessment — 2026-08-12

**Repository:** jpv-bootcamp  
**Migration lane:** source discovery + DRY-8 rehearsal complete; staging-write readiness blocked on target-design work  
**Reviewed application checkpoint:** `43d569211acde5ae80f6e33524d40d432b417ce8`  
**Contains PII:** No — counts, IDs, rules, and structural findings only  

---

## 1. Purpose

This assessment records the concrete source data discovered from the 2026-08-12 WordPress WXR export, full WordPress/MariaDB SQL dump, local WordPress uploads archive, Stripe read-only inventory, and Bunny read-only inventory.

It is not an authorization to import data into staging and is not an authorization to create or modify live Stripe objects.

---

## 2. Source Artifacts

Available discovery sources:

- WordPress WXR export generated 2026-08-12 from `https://portal.jpvbootcamp.com`.
- Full MariaDB/phpMyAdmin SQL dump for the legacy WordPress portal, including WordPress, FluentCRM, and FluentCommunity tables.
- Local WordPress uploads archive at `src/assets/uploads` for migration analysis only; do not commit as application assets.
- Stripe live read-only provider inventory for the five approved legacy paid Product IDs.
- Stripe sandbox read-only catalogue inventory for the new JPV Bootcamp Membership test Product.
- Bunny Stream read-only inventory for library ID `581531`.

A final fresh source snapshot/delta will be required at cutover because the old platform can continue changing after this discovery export.

---

## 3. Target Membership Rule

There is one target paid entitlement only:

`jpv_bootcamp_membership`

There are two target member states:

### Active paid member

- Proven current qualifying legacy paid Stripe relationship under an approved legacy Pro/VIP Product.
- Payload target: `accountStatus=active`.
- Target entitlement: `jpv_bootcamp_membership`.
- Access: all member courses, groups/spaces, feeds, discussions, and member content.

### Deactivated member

- No proven current qualifying legacy paid Stripe relationship.
- Payload target: `accountStatus=blocked`.
- No active target subscription/entitlement.
- Historical identity/profile/authorship/posts/comments/course progress remain preserved.
- User cannot log in/use paid-member functionality until a new paid subscription is separately established.

Legacy Free/Pro/VIP labels are audit/source metadata only. They never determine target access.

---

## 4. WordPress WXR Findings

The WXR is a valid WordPress export but is not a complete source for FluentCRM/FluentCommunity data.

Observed WXR inventory:

- 117 total WordPress export records.
- 104 attachment records.
- 3 pages.
- 3 legacy `fluent-products` records representing Free/Pro/VIP functionality.
- 1 ordinary WordPress post.
- Remaining navigation/style/support objects.

Migration implications:

- Use WXR primarily for WordPress content/attachment identity and metadata reconciliation.
- Do not import legacy Free/Pro/VIP product/upgrade objects as target functionality.
- Preserve historical user-generated text that mentions Free/Pro/VIP unchanged.

---

## 5. WordPress / FluentCRM Identity Findings

Discovery of the SQL source found:

- 51 WordPress users total.
- 48 subscriber/member accounts.
- 3 administrator accounts.
- 48 FluentCRM contacts marked subscribed at export time.
- 47 WordPress subscriber accounts have corresponding FluentCRM records.
- 1 WordPress subscriber has no FluentCRM contact.
- FluentCRM contains one administrator-linked contact.

Legacy FluentCRM tier-tag observations:

- Free tag: 46 contacts.
- Pro tag: 18 contacts.
- VIP tag: 18 contacts.
- Tags overlap and are not mutually exclusive.

Migration implication:

Do not use these tags as the authoritative paid-member classifier. Use Stripe live billing evidence, then join the Stripe Customer to the legacy WordPress/FluentCRM/FluentCommunity identity crosswalk.

Expected base population for member migration remains the 48 WordPress subscriber/member accounts, subject to duplicate/email/identity reconciliation.

Administrators remain operator/admin identities rather than being automatically provisioned as paid migrated members.

---

## 6. Stripe Live Billing Findings

Approved legacy paid Product IDs:

- `prod_Tvj8ugfQ2SJUOj`
- `prod_Tvj8pgx91owYMN`
- `prod_Tvj8HliPtISF2K`
- `prod_Tvj7d4LMAxVVta`
- `prod_TcZanPbgn4ERhq`

Provider discovery verified:

- Stripe account: `acct_1Sed9ULQNsjxBhGB`.
- All five legacy Products are live-mode objects.
- Eight currently listed associated Prices plus one historical/unlisted associated Price have been observed; treat the complete known legacy price set as nine until reconciliation proves otherwise.
- 24 unique qualifying Stripe Customers.
- Status snapshot: active 12; incomplete_expired 4; canceled 7; past_due 1.
- Current cadence snapshot: monthly 24; annual 0.
- No current duplicate qualifying subscriptions reported.
- No current multi-product customers reported.
- Four duplicate historical email identities detected; three current identity exceptions reported.
- Eight clean active candidates.
- Sixteen review-required records.

Resolved staging classification policy from the uploaded provider evidence and SQL identity joins:

- All 12 currently `active` qualifying Stripe subscriptions are paid-member candidates. The four records that Codex placed in `REVIEW_REQUIRED` solely because of duplicate Stripe-customer history or discounts are still active-member candidates at the person/account level:
  - Clara Ngozi Amechi: one active VIP subscription plus one `incomplete_expired` duplicate customer => activate the single matching WordPress member; retain the expired Stripe customer as audit history only.
  - Miss V Mante (`ronyaa@live.co.uk`): one active Pro subscription plus one `incomplete_expired` duplicate => activate the single matching WordPress member.
  - Steve Westhoek: active VIP subscription with a discount/promotion => active member; preserve discount evidence for later live billing-cutover review.
  - Gary Mowat: active Pro subscription with a discount/promotion => active member; preserve discount evidence for later live billing-cutover review.
- The 7 `canceled` and 4 `incomplete_expired` subscription records do not establish current paid entitlement. Their matching WordPress members remain blocked/deactivated unless another current active qualifying subscription exists for that same person.
- The single `past_due` record (Raouda Sakour) is fail-closed for staging: target `accountStatus=blocked` while Stripe remains `past_due`. A fresh final Stripe snapshot may promote the member to active if the subscription has recovered to `active` before cutover.
- Three canceled Stripe Customers lack usable customer email/name. Because none has a current qualifying subscription, these records cannot authorize activation; unmatched WordPress members remain blocked by default. Preserve the orphan Stripe IDs in the reconciliation report rather than guessing identity.

Provisional staging member totals under this fail-closed policy after the operator-confirmed Nidia duplicate merge:

- 48 WordPress subscriber/member source accounts to preserve and reconcile.
- 47 canonical target members after merging WordPress users 74 and 76 into one person.
- 12 active paid-member candidates from current qualifying `active` Stripe subscriptions.
- 35 blocked/deactivated member candidates, including the current `past_due` member unless status recovers before the final snapshot.

Identity-crosswalk exceptions that must be handled by the dry-run importer before any staging write:

- Nidia Gonzalez has two WordPress identities: WP user 74 (`nsgonza2@gmsil.com`) is the misspelled legacy email that matches the active Stripe customer, while WP user 76 / FluentCRM uses the operator-confirmed correct email `nsgonza2@gmail.com`. Treat both source IDs as one person. Use user 74 only as the billing-match source, but set the canonical new-platform email to the correctly spelled `nsgonza2@gmail.com` from user 76 and merge/preserve all historical relationships from both source identities into that one target member.
- `anita13steve@gmail.com` matches an active Stripe Customer whose Stripe name is `Stephen Bhatti`, while the WordPress/FluentCRM identity is Anita Stephen. Email is the deterministic join signal for staging, but the name discrepancy must remain visible in the identity-conflict report rather than silently overwriting source names.

These counts are a staging dry-run classification, not a live billing mutation instruction. Recompute them from a fresh Stripe snapshot immediately before final cutover.

### 2026-08-15 verified live-source refresh

The 12 active / 35 blocked classification above is retained as the **historical 2026-08-12 snapshot**. A later sanitized live Stripe inventory at `/private/tmp/jpv-stripe-live-subscriptions.json` is authoritative for the current rehearsal and contains 11 active subscriptions. Reconciliation against the same 48 WordPress source subscriber accounts / 47 canonical people therefore now yields **11 active / 36 blocked**.

Verified local source bundle used by the current read-only regression:

- `/private/tmp/127_0_0_1.sql` — 7,624,098 bytes — SHA-256 `cf6fcb585411360076bbb01164437543ab3debd568cb7b1b37c1d8ee8a4da70e`;
- `/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml` — 299,769 bytes — SHA-256 `186de11d2f5fed7d1f964a66d0df3fb83049d1fd87d6e2972decfd24c91cc5c8`;
- `/private/tmp/jpv-stripe-live-subscriptions.json` — 31,114 bytes — SHA-256 `5ed3457ed96020165f15a0b03952a25d756c43a481da03af9836ca4938a23523`;
- `/private/tmp/jpv-bunny-migration-inventory.json` — 7,524 bytes — SHA-256 `f9a6fe7990ec0585a7645558ce597c20b943c0efbb94d92389c568917f27533c`.

Current provider facts: Stripe account `acct_1Sed9ULQNsjxBhGB`, 11 active / 7 canceled / 4 incomplete_expired / 1 past_due; three orphan Stripe records are all canceled with missing customer email and remain blocked/historical. Bunny library `581531` contains 12 GUID-addressed videos, 11 finished/reusable and one failed test video.

The raw SQL feature audit also closes several former evidence gaps:

- `wp_fcom_xprofile`: 51 rows; 11 non-empty short descriptions; website 4; Facebook 4; Instagram 2; LinkedIn 2; Twitter/X 1; YouTube 1; `cover_photo` 2; `headline` zero non-empty;
- source profile fields are now planned into `payload_member_profiles` using canonical-first duplicate-profile merging and Lexical biography conversion;
- `fluent_community_settings` and `auth_settings` prove active site title/logo/white-logo/featured-image/login branding use;
- the existing `portalSettings` Global is therefore source-proven, while unsupported `customization_settings` and `welcome_banner_settings` are retained losslessly under `legacySettings`;
- `snippets_settings.custom_css` and `custom_js` are both empty and must never be auto-executed;
- three FluentCommunity platform-media records are now exactly linked to `portalSettings.logo` / `loginBanner.logo`, `whiteLogo`, and `featuredImage`.

The latest full read-only real-source plan passes with 815 proposed operations, 58 blocked operations, 47 xprofile-backed member-profile operations, one PortalSettings Global operation, 104/104 WXR attachments mapped, zero missing Bunny GUIDs, and 16 explicit unresolved relationships (6 Bunny forward-schema, 7 lesson-comment schema registration, 3 space cover/OG target-schema decisions).

---

## 7. New Stripe Membership Catalogue

Sandbox/test target:

- Product: `prod_UuO0SZGtwH75xI` — JPV Bootcamp Membership.
- Monthly test Price: `price_1TuZE1LIsSm7aAua4nIhf9U8` — intended GBP 80/month.
- Annual test Price: `price_1TuZEPLIsSm7aAuaMfEAUS5m` — intended GBP 800/year.
- Staging reports `STRIPE_ENV=test`.

No exact complete live target equivalent has been approved.

The three plausible existing live Product candidates reported by provider discovery are now explicitly rejected as target candidates because all three are members of the approved legacy paid-product set:

- `prod_Tvj8HliPtISF2K` — `JPV Bootcamp VIP Membership (legacy)`.
- `prod_Tvj7d4LMAxVVta` — `JPV Bootcamp Pro Membership`.
- `prod_TcZanPbgn4ERhq` — `JPV Bootcamp VIP Membership`.

None may be renamed, repurposed, or reused as the new live `JPV Bootcamp Membership` target. When live catalogue creation is separately authorized after staging rehearsal/acceptance, create a new live Product and new monthly/annual Prices only, mirroring the approved sandbox catalogue semantics. Existing Stripe objects remain immutable during that operation.

No existing live Stripe Product, Price, Customer, Subscription, Subscription Item, Invoice, Payment Method, Schedule, Coupon, or other provider object may be changed during catalogue review/creation.

---

## 8. FluentCommunity Structural Findings

The SQL dump contains the actual FluentCommunity tables and is the authoritative source for community/course migration rather than the WXR alone.

Observed source counts:

- 16 spaces.
- 182 space-membership records.
- 50 unique users represented in community memberships.
- 151 FluentCommunity content records.
- 105 comments.
- 220 reaction/progress records.
- 86 FluentCommunity media records.

The 151 content records include:

- 80 community/feed posts.
- 61 course lessons.
- 10 course sections.

Known courses:

1. Property Investment Training – UK
   - 7 sections.
   - 47 lessons.
2. RESOURCES LIBRARY
   - 2 sections.
   - 11 lessons.
3. Welcome
   - 1 section.
   - 3 lessons.

Course progress evidence includes:

- 103 `lesson_completed` records across 11 users.
- 6 `course_completed` activities across 5 users.

These records should be mapped into Payload lesson/course progress rather than resetting migrated members to zero.

---

## 9. Community Migration Policy

Preserve:

- spaces/groups;
- memberships/roles where semantically relevant;
- feed posts;
- authorship;
- original timestamps;
- comments/thread hierarchy;
- reactions/bookmarks where supported;
- attachments;
- moderation/visibility state where present;
- historical post text unchanged.

Remove legacy tier gating from functional target structure.

Example:

`Only VIP Discussion` must no longer mean VIP-only access. Use a neutral member-only name such as `Member Discussion` unless a later operator-approved name is selected.

All active target members may access all member spaces and courses.

Deactivated members retain historical records/authorship but cannot log in or consume paid-member functionality.

Do not migrate active upgrade functionality such as `Upgrade to VIP` or `Upgrade to Pro`.

---

## 10. Media Findings

Local WordPress uploads archive at `src/assets/uploads` contains approximately:

- 386 files.
- 65.2 MB total.
- 117 JPG.
- 238 PNG.
- 11 WebP.
- 10 JPEG.
- 2 MP4.
- 2 PDF.

The archive includes WordPress derivatives/thumbnails, so file count is expected to exceed the 104 WXR attachment records.

Non-content/control files such as PHP/.htaccess/plugin artifacts must be excluded from any media importer. Do not blindly upload the entire directory.

FluentCommunity media inventory includes 86 records, most of which reference external/object storage rather than ordinary WordPress uploads.

---

## 11. Bunny Findings

Staging-accessible Bunny Stream library:

- Library ID: `581531`.
- 12 videos listed through library-scoped read access.
- 11 reusable legacy video GUIDs.
- Exclude failed/test asset `staging-proof-upload-test`.

The 11 reusable legacy GUIDs are sufficient to continue deterministic source-to-target video mapping without copying/re-uploading those videos.

Account-level library name/list is unverified because the supplied credentials are library-scoped. This is not a blocker for mapping existing GUIDs when library ID, hostname, and playback are proven.

Runtime configuration compatibility:

- staging supplies `BUNNY_STREAM_*` values;
- migration implementation now updates `src/lib/bunny-api.ts` and provider-readiness diagnostics to accept both the legacy `BUNNY_API_KEY`/`BUNNY_LIBRARY_ID` aliases and staging `BUNNY_STREAM_API_KEY`/`BUNNY_STREAM_LIBRARY_ID` names.
- this compatibility change is local/uncommitted and has not been deployed to staging yet.
- a GET-only migration utility can verify each reusable legacy `videoGuid` directly against Bunny's current Stream API without uploading, renaming, or changing any Bunny asset. The Stream response exposes `guid` as the canonical video identifier and does not provide a numeric Bunny video ID for this migration to recover.

Therefore variable naming is no longer a design blocker. Final staging acceptance must still verify the alias-compatible code after an authorized deployment and run GET-only GUID verification against the real sanitized inventory. Separately, the target `bunny_videos` persistence model still carries a legacy numeric `video_id` requirement; that is a target-schema compatibility issue to resolve through a future reviewed migration, not a source-discovery requirement.

---

## 12. Source-to-Target Mapping Summary

| Legacy source | Payload target |
|---|---|
| WordPress users / FluentCRM contacts / FluentCommunity identities | members + contacts via one identity crosswalk |
| Qualifying live Pro/VIP Stripe relationship | active member + `jpv_bootcamp_membership` |
| No qualifying current paid relationship | blocked/deactivated member, history preserved |
| FluentCRM tags/lists | CRM/audit metadata only where useful; never entitlement |
| FluentCommunity spaces | spaces |
| Space memberships | space memberships |
| Feed posts | space posts |
| Comments/replies | space comments |
| Reactions/bookmarks | corresponding supported community engagement records or audited source metadata |
| FluentCommunity courses | courses |
| Course sections | course modules |
| Lessons | lessons |
| Lesson completion | lesson progress |
| Course completion | course/progress reconciliation evidence |
| WordPress attachments | Payload media/resource mapping |
| Bunny video GUIDs/links | reuse existing Bunny references |
| Legacy upgrade products/pages | exclude as active target functionality |

---

## 13. Safe Work That Can Start Now

Without any staging database/provider mutation, implementation may proceed on:

1. a deterministic parser for the supplied SQL/WXR sources;
2. identity-crosswalk generation;
3. member active/blocked classification plumbing with unresolved Stripe records fail-closed to review;
4. FluentCommunity course/space/post/comment/progress normalization;
5. local WordPress media inventory and attachment crosswalk;
6. Bunny GUID crosswalk for the 11 reusable videos;
7. removal of Free/Pro/VIP entitlement assumptions from migration code/tests;
8. dry-run source-to-target count reconciliation;
9. conflict/review reports that contain no secrets and are not committed when they include PII.

No actual staging legacy-data import should run until the identity crosswalk and dry-run counts/relationships reconcile under the fail-closed membership policy.

---

## 14. Remaining Inputs Before Staging Legacy-Data Apply

Required:

1. Dry-run identity crosswalk proving all 48 WordPress member source accounts resolve to 47 canonical target members without duplicate active members, including the Nidia two-WordPress-account merge/corrected email and Anita/Stephen name conflict.
2. Dry-run source-to-target reconciliation report with deterministic counts and zero unexplained orphan relationships.
3. Import tooling/tests proving active versus blocked member access behavior and the expected 12-active / 35-blocked rehearsal classification across the 47 canonical target members.
4. Deterministic course/community/media/Bunny operation plan with idempotency keys and no unexplained content loss.
5. Staging `past_due` policy is already fail-closed to blocked; refresh Stripe immediately before eventual cutover and promote only if the source status has recovered to `active`.

Resolved provider decisions that do not require another broad discovery run:

- the 16 raw Stripe review records have been reduced to deterministic person-level policy plus explicit identity conflicts;
- all three plausible live target Products are rejected because they are legacy Products;
- the 11 reusable Bunny GUIDs are sufficient for source mapping.

Required before final media acceptance, but not blocking source-normalization development:

6. Reconcile Bunny runtime environment-variable contract if migration/acceptance exercises upload/create-video flows.

Required at final cutover:

7. Fresh final WordPress/FluentCRM/FluentCommunity source snapshot or deterministic delta since the 2026-08-12 export.
8. Fresh read-only Stripe snapshot and separately approved Stripe live catalogue/subscription cutover plan after staging acceptance.

---

## 15. Current Position

**Source discovery:** complete for the 2026-08-12 rehearsal snapshot.  
**Provider discovery:** complete for DRY-8; final cutover still requires a fresh read-only Stripe/source snapshot and separately approved live cutover plan.  
**Migration mapping / DRY-8:** PASS — 48 source subscribers → 47 canonical members → 12 active / 35 blocked; zero unexplained source/relationship blockers.  
**Target-design backlog:** still open — rich-text conversion, lesson-resource file resolution, GUID-first Bunny persistence, lesson-comment destination, profile/space/platform media decisions, and one multi-video lesson decision.  
**Staging legacy-data write:** not yet authorized/ready.  
**Production/live billing cutover:** explicitly out of scope.
