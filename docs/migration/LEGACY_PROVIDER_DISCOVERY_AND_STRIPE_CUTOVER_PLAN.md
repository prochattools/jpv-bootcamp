# Legacy Provider Discovery and Stripe Cutover Plan

**Repository:** jpv-bootcamp  
**Branch:** `feature/course-branding-and-preview`  
**Reviewed application checkpoint:** `43d569211acde5ae80f6e33524d40d432b417ce8`  
**Status:** Planning / provider discovery — no Stripe live mutations authorized; no legacy-data staging apply authorized by this document  
**Last updated:** 2026-08-12

---

## 1. Purpose

This document preserves the provider-side facts, migration policy, unresolved questions, and execution boundaries for migrating the legacy WordPress + FluentCRM + FluentCommunity platform into the Payload CMS JPV Bootcamp platform.

It supplements `LEGACY_PLATFORM_IMPORT_MASTER_PLAN.md`. Where the older master plan assumes legacy Free/Pro/VIP access levels should be reproduced, this document supersedes that assumption for the current migration.

The migration must be rehearsed and reconciled in the staging application/database before any production cutover.

---

## 2. Immutable Membership Policy

The new JPV Bootcamp platform has exactly one paid entitlement:

`jpv_bootcamp_membership`

Legacy Free / Pro / VIP are **not target subscription tiers**.

### 2.1 Target member groups

There are only two target account groups:

1. **Active paid member**
   - Legacy user is proven to have a qualifying paid Pro/VIP Stripe relationship under one of the approved legacy product IDs.
   - Payload member target state: `accountStatus=active`.
   - Target entitlement: `jpv_bootcamp_membership`.
   - Active members receive access to all migrated courses, groups/spaces, feeds, discussions, and member content.

2. **Deactivated member**
   - Legacy user does not have a qualifying paid Pro/VIP Stripe relationship.
   - User identity, profile, authorship, posts, comments, course history/progress, and other historical data are still migrated and preserved.
   - Payload member target state: `accountStatus=blocked` unless a later approved implementation contract chooses an equivalent fail-closed state.
   - No active target subscription is created.
   - Login/member entitlement remains denied until the user separately becomes a paying member.

### 2.2 Legacy tier data

Legacy Free / Pro / VIP tags, labels, and source values may be retained only as migration/audit metadata for reconciliation. They must not control target access, course visibility, community visibility, billing plan, or entitlement.

Historical user-generated content that mentions Free, Pro, or VIP is preserved unchanged.

Functional legacy upgrade objects/CTAs/products such as `Upgrade to Pro`, `Upgrade to VIP`, or Free/Pro/VIP access gates are not migrated as active functionality.

A legacy group/space name such as `Only VIP Discussion` must lose the tier gate and be renamed to a neutral member-only name such as `Member Discussion` before final acceptance. Historical post bodies remain unchanged.

---

## 3. Legacy Stripe Product Set

Approved legacy paid-product IDs supplied by the operator:

- `prod_Tvj8ugfQ2SJUOj`
- `prod_Tvj8pgx91owYMN`
- `prod_Tvj8HliPtISF2K`
- `prod_Tvj7d4LMAxVVta`
- `prod_TcZanPbgn4ERhq`

These IDs are classification inputs only until their Stripe `livemode`, names, prices, subscription counts, statuses, and customer relationships are verified through a read-only live-mode inventory.

Do not infer paid-member status solely from FluentCRM Free/Pro/VIP tags when Stripe evidence is available.

Ambiguous Stripe states such as `trialing`, `past_due`, `paused`, `unpaid`, duplicate active subscriptions, multiple legacy products, missing customer email, or conflicting identities must be reported for operator review rather than silently classified.

---

## 4. New Membership Product

### 4.1 Existing sandbox/test product

Sandbox product supplied and verified by provider discovery:

- Product ID: `prod_UuO0SZGtwH75xI`
- Name: `JPV Bootcamp Membership`
- Monthly price: `price_1TuZE1LIsSm7aAua4nIhf9U8`
- Annual price: `price_1TuZEPLIsSm7aAuaMfEAUS5m`
- Intended pricing: GBP 80/month or GBP 800/year
- Mode: sandbox/test only

Staging currently reports `STRIPE_ENV=test` with matching membership product/price configuration.

### 4.2 Live product does not yet exist

No new live JPV Bootcamp Membership product has been created or authorized by this plan.

Stripe sandbox/test objects and live objects are isolated. A sandbox Product/Price ID cannot be used by live subscriptions. Therefore the staging rehearsal must not be described as literally moving existing live Stripe subscriptions onto `prod_UuO0SZGtwH75xI`.

The future live catalogue step must create **new live Product/Price objects only** (or use Stripe's supported test-to-live catalogue-copy mechanism) after the final read-only live assessment is complete.

Creation of the new live product must be fail-closed:

- create new objects only;
- never update/archive/delete an existing product or price;
- never update a Customer, Subscription, Subscription Item, Invoice, Payment Method, Payment Link, Checkout Session, Schedule, Coupon, Promotion Code, or Tax configuration during the catalogue-creation task;
- verify no equivalent live target product already exists before creating anything;
- stop on ambiguity rather than mutate an existing object;
- record created live product/price IDs for a separately authorized later cutover.

The live product should reproduce the approved sandbox product's non-secret catalogue semantics (name, description/metadata if approved, currency, monthly/annual recurrence and amounts) only after those fields are re-read from Stripe immediately before creation.

---

## 5. Correct Stripe Migration Sequence

### Phase S1 — Read-only live inventory

Re-authenticate the dedicated Stripe CLI profile and retrieve GET-only live evidence for:

- all five legacy product IDs;
- all active/inactive Prices under those products;
- all Subscriptions containing those Prices/Products;
- Customer identity fields needed for migration matching;
- status, cadence, current period, cancellation state, discounts, schedules, trial state, collection method, and payment-method-presence indicators;
- duplicate/multi-product customer conditions;
- invoice/proration-relevant subscription configuration.

No provider mutation is permitted in S1.

### Phase S2 — Deterministic paid/deactivated classification

Join Stripe live evidence to the WordPress/FluentCRM/FluentCommunity identity crosswalk.

Produce two target sets:

- active paid members;
- deactivated members.

No target write is permitted until the crosswalk balances and all ambiguous Stripe/customer identities are resolved or explicitly dispositioned.

### Phase S3 — Staging/test rehearsal

Use Payload staging plus Stripe sandbox/test data to rehearse the new one-plan model.

Do not attempt to move live payment methods or live Stripe object IDs into sandbox mode. Sandbox objects are simulation/shadow evidence only.

Rehearsal must prove:

- active paid-member identities map to `accountStatus=active` and `jpv_bootcamp_membership`;
- deactivated members map to `accountStatus=blocked` with no active entitlement;
- course/community history is preserved for both groups;
- only active members can log in/use member content;
- all active members see all member courses/groups/discussions regardless of legacy tier;
- no Free/Pro/VIP access gate survives.

### Phase S4 — Create new live catalogue objects (separate authorization)

After S1-S3 are reconciled, create the new live JPV Bootcamp Membership product and approved monthly/annual live Prices as **new objects only**.

This task is catalogue creation only. It must not change any existing subscription/customer.

### Phase S5 — Read-only live cutover preview

For every qualifying existing live subscription, build the exact proposed change from its current subscription item Price to the corresponding new live monthly/annual JPV Bootcamp Membership Price.

Before any update, use Stripe's read-only invoice preview/proration facilities to determine billing effects and preserve the intended renewal/cadence semantics.

Produce an operator-reviewed cutover packet containing old subscription/item/price, proposed new price, cadence, billing-cycle effect, proration result, warnings, and rollback/reference evidence.

### Phase S6 — Controlled live subscription cutover (future explicit authorization only)

Only after staging/data acceptance and a separately approved production/live billing window may existing live subscriptions be changed.

Preferred continuity model: retain the existing live Customer and Subscription and replace the relevant existing subscription item's Price with the approved new live membership Price, using the pre-approved proration/billing-cycle policy.

Never cancel/recreate all subscriptions merely to change the product unless a later evidence-backed plan explicitly requires that behavior.

---

## 6. Provider Discovery Results — 2026-08-12

All provider discovery runs reported read-only execution and no repository/provider mutations.

### Stripe

Verified live account:

- Account: `acct_1Sed9ULQNsjxBhGB`.
- All five supplied legacy Product IDs were found in live mode.
- All five legacy Products and their discovered Prices report `livemode=true`.
- Catalogue inventory contains eight currently listed legacy Prices plus one additional historical/unlisted associated Price encountered in subscription history; downstream reconciliation must treat the complete known set as nine associated Prices until independently reduced.
- 24 unique qualifying Stripe Customers were found across the legacy paid-product set.
- Subscription-status snapshot: `active=12`, `incomplete_expired=4`, `canceled=7`, `past_due=1`.
- Current cadence snapshot: `monthly=24`, `annual=0`.
- No current duplicate qualifying subscriptions were reported.
- No current multi-product customers were reported.
- Four duplicate historical email identities were detected, with three current identity exceptions called out by provider discovery.
- Eight customers were initially classified by provider discovery as clean/definite active candidates.
- Sixteen raw Stripe customer records were initially marked `REVIEW_REQUIRED`; subsequent person-level reconciliation resolves most of those records without provider mutation.

Interpretation under the immutable two-state policy after reconciliation:

- All 12 currently `active` qualifying subscriptions are active-member candidates at the person/account level.
- Four of those active subscriptions were initially placed in the review set for non-entitlement reasons: duplicate historical Stripe Customer identity or discount/promotion presence. These conditions do not negate an otherwise current paid subscription.
- Duplicate-customer cases with one active subscription and one `incomplete_expired` duplicate resolve to one active migrated person while retaining the expired Stripe record as audit history.
- The four `incomplete_expired` and seven `canceled` records do not establish current entitlement and therefore map fail-closed to the deactivated group after identity reconciliation unless that same person has another current active qualifying subscription.
- The single `past_due` customer remains the only true current-status policy exception. Staging classification is fail-closed to blocked/deactivated while the subscription remains `past_due`; a fresh final Stripe snapshot may promote the member only if status has recovered to `active` before cutover.
- Three canceled Stripe Customers lack usable customer email/name; because they have no current qualifying subscription, they cannot authorize activation. Preserve them as orphan billing evidence rather than guessing identity.
- With the 2026-08-12 source snapshot, the provisional staging roster is therefore 48 WordPress subscriber/member source accounts resolving to 47 canonical target members after the operator-confirmed Nidia duplicate merge: 12 active paid-member candidates and 35 blocked/deactivated candidates, subject to a final pre-cutover refresh.
- Identity exceptions remain visible in the dry-run report, especially the operator-confirmed Nidia duplicate merge/corrected Gmail address and the `anita13steve@gmail.com` Stripe/WordPress name mismatch.

Verified sandbox target catalogue:

- Product `prod_UuO0SZGtwH75xI` exists and is active in sandbox/test mode.
- Monthly Price: `price_1TuZE1LIsSm7aAua4nIhf9U8`.
- Annual Price: `price_1TuZEPLIsSm7aAuaMfEAUS5m`.
- Staging reports `STRIPE_ENV=test` with the sandbox target catalogue configured.

Live target catalogue status:

- No exact complete live equivalent of the sandbox target was proven.
- The three plausible live Product matches reported by provider discovery are all explicitly part of the approved legacy paid-product set: `prod_Tvj8HliPtISF2K`, `prod_Tvj7d4LMAxVVta`, and `prod_TcZanPbgn4ERhq`.
- Decision: **REJECT all three as target candidates.** They are legacy products and must not be renamed, repurposed, or reused as the new live `JPV Bootcamp Membership`.
- A future separately authorized catalogue-creation task may create one new live Product plus new monthly/annual Prices only after staging rehearsal/acceptance. Existing live Stripe objects remain immutable during that task.

### Bunny

Verified:

- Bunny Stream library ID accessible to staging: `581531`.
- Both supplied Stream/library-scoped credentials could list the same 12 videos.
- 11 legacy video assets have reusable GUIDs.
- `staging-proof-upload-test` is a failed/test asset and must not be treated as migrated legacy content.
- Existing legacy Bunny GUIDs/URLs can be reused for migration planning and are not blocked by the inability to enumerate account-level libraries.

Unverified/non-blocking for content mapping:

- Dashboard library name.
- Account-wide list of Bunny libraries because the available credentials are library-scoped and return HTTP 401 for account-level metadata.

Bunny runtime compatibility status:

- Staging provides `BUNNY_STREAM_*` configuration/credentials.
- Local migration work now updates `src/lib/bunny-api.ts` and provider-readiness diagnostics to accept both `BUNNY_API_KEY`/`BUNNY_LIBRARY_ID` and `BUNNY_STREAM_API_KEY`/`BUNNY_STREAM_LIBRARY_ID`.
- GET-only legacy video verification is implemented so reusable GUIDs can be validated directly against Bunny Stream without changing any asset. Bunny's current API is GUID-first; the remaining numeric `video_id` issue belongs to the target Payload persistence schema, not provider discovery.
- These changes remain local/uncommitted and have not been deployed or verified in staging yet.

### Dokploy staging

- Stripe staging mode is correctly `test`.
- The application remains in the staging-only migration lane.
- Bunny alias compatibility is implemented in the current local dry-run batch; final provider acceptance still requires a later authorized deployment/smoke verification, not a provider configuration mutation.
- Production Dokploy/application/database configuration remains out of scope.

---

## 7. Source Data Already Available

Current migration discovery has access to:

- WordPress WXR export dated 2026-08-12;
- full WordPress/MariaDB SQL export containing WordPress, FluentCRM, and FluentCommunity tables;
- local WordPress uploads archive under `src/assets/uploads` (migration source only; do not commit as application assets);
- FluentCommunity course/community records in the SQL source;
- legacy media references including Bunny/external video references.

The normal WXR alone is not authoritative for FluentCommunity/FluentCRM migration. The SQL export and provider inventories are required for complete source reconciliation.

A fresh final source snapshot/delta is required at cutover because the legacy platform may continue changing after the current export.

---

## 8. Required Next Work

The broad provider discovery pass is complete enough to stop repeated account-wide querying. The remaining work is targeted reconciliation and staging-import preparation.

### 8.1 Stripe/person crosswalk validation — required before member staging writes

The raw 16-record provider review has been resolved at the policy level. Do not repeat broad Stripe discovery. Validate the resulting person-level staging roster through the deterministic identity crosswalk:

- 12 current qualifying `active` Stripe subscriptions => active-member candidates;
- all other WordPress subscriber/member accounts => blocked/deactivated by default;
- the single current `past_due` member remains blocked until a fresh Stripe snapshot proves recovery to `active`;
- canceled and `incomplete_expired` Stripe records remain historical billing evidence and do not authorize activation;
- discounts/promotions on an otherwise active subscription do not block staging activation, but their evidence must be preserved for the later live billing-cutover preview.

Known identity conflicts that must be resolved deterministically in the dry-run:

- Nidia Gonzalez: WordPress user 74 (`nsgonza2@gmsil.com`) is the misspelled legacy email that matches the active Stripe customer, while WordPress user 76 / FluentCRM uses the operator-confirmed correct email `nsgonza2@gmail.com`. Treat both source IDs as one person. Use user 74 only as the billing-match alias, set the canonical target email from user 76 to `nsgonza2@gmail.com`, and merge/preserve all relationships from both source identities into one active target member.
- `anita13steve@gmail.com`: Stripe customer name and WordPress/FluentCRM name differ. Join by the exact email and retain both source names in conflict/audit evidence; do not silently overwrite source identity data.
- Three canceled Stripe Customers have no usable email/name. Preserve them as orphan billing evidence only; never use them to activate a WordPress member by guesswork.

Expected dry-run totals from the 2026-08-12 snapshot are 48 preserved WordPress member source accounts resolving to 47 canonical target members after the Nidia merge: 12 active candidates and 35 blocked/deactivated candidates. The dry-run must fail if source-account coverage or canonical person counts differ without an explicit, evidenced reason.

Do not write PII-bearing crosswalk artifacts into Git. Keep detailed person-level evidence in controlled local/temporary outputs.

### 8.2 Live target Product decision — resolved

The three plausible live Product matches have been inspected and are all legacy paid Products:

- `prod_Tvj8HliPtISF2K` — legacy VIP;
- `prod_Tvj7d4LMAxVVta` — legacy Pro;
- `prod_TcZanPbgn4ERhq` — legacy VIP.

Decision: **REJECT all three as target candidates.** Do not rename, repurpose, or reuse them as the new live `JPV Bootcamp Membership`.

A future separately authorized create-new-only catalogue task may create one new live Product and new monthly/annual Prices after staging rehearsal/acceptance. No existing Stripe object may be modified during that catalogue-creation task.

### 8.3 Bunny staging runtime contract — compatibility implemented locally; final staging verification still required

The 11 existing legacy Bunny video GUIDs are sufficient to continue source-to-target mapping and importer development.

The runtime variable mismatch identified during provider discovery has been resolved in the current local migration batch:

- staging supplies `BUNNY_STREAM_API_KEY` / `BUNNY_STREAM_LIBRARY_ID` values;
- `src/lib/bunny-api.ts` now accepts both the legacy `BUNNY_API_KEY` / `BUNNY_LIBRARY_ID` aliases and the staging `BUNNY_STREAM_API_KEY` / `BUNNY_STREAM_LIBRARY_ID` names;
- provider-readiness diagnostics use the same alias contract;
- tests verify the alias compatibility without reading or exposing provider secrets.

A migration-local GET-only verification path is also implemented. It resolves each reusable legacy `videoGuid` through `GET https://video.bunnycdn.com/library/{libraryId}/videos/{guid}`, validates GUID/library identity, skips failed/test videos, and performs no upload, delete, rename, or other Bunny mutation. Bunny's current Stream API response exposes the video `guid` as the canonical identifier; it does not provide a numeric Bunny video ID for this migration to recover.

These changes remain local/uncommitted and are not yet deployed to staging. Final media acceptance still requires an authorized deployment/smoke verification plus the real-source GET-only enrichment run.

Do not alter provider credentials merely for naming convenience. Account-level Bunny library-name enumeration remains non-blocking when exact library ID `581531`, referenced GUIDs, hostname, and playback behavior are proven.

### 8.4 Migration tooling / DRY-8 status — source reconciliation complete; staging write still prohibited

The deterministic read-only migration mapping and real-source DRY-8 rehearsal are complete for the 2026-08-12 snapshot:

1. the two-state membership invariant is enforced in migration code/tests;
2. the SQL-based FluentCommunity source adapter is implemented;
3. the identity crosswalk is implemented and reconciles 48 source subscriber accounts to 47 canonical members;
4. WordPress/FluentCRM/FluentCommunity users are mapped to Payload member/contact targets;
5. courses/sections/lessons/progress are reconciled;
6. spaces/feed posts/comments/reactions are reconciled, including explicit deferral of 7 lesson comments rather than misrouting them;
7. WordPress uploads and existing Bunny references are reconciled;
8. tier-gated functional labels are neutralized while historical body text remains unchanged;
9. functional `Upgrade to Pro` / `Upgrade to VIP` / Free-Pro-VIP entitlement objects are excluded;
10. the deterministic real-source dry-run report passes with zero unexplained source/relationship blockers.

No staging database write should occur yet. Remaining blockers are target-design work (lossless rich text, lesson resources, GUID-first Bunny persistence, lesson-comment destination, media target decisions, and the single multi-video lesson), plus the later requirement for fresh source/Stripe evidence and separately approved cutover actions.

---

## 9. Hard Safety Boundaries

Until an explicit later authorization states otherwise:

- no Stripe live create/update/delete;
- no existing Stripe object mutation in test or live mode;
- no migration of legacy data into production;
- no production database or Dokploy operation;
- no changing existing Bunny assets;
- no committing source exports, SQL dumps, uploads, API responses containing PII, or provider secrets;
- no Free/Pro/VIP entitlement model in Payload;
- no automatic classification of ambiguous billing states;
- no migration execution solely from FluentCRM tags.

Staging/test rehearsal and read-only discovery remain the current lane.

---

## 10. Exit Criteria for Provider Assessment

Provider discovery is complete only when:

- all five legacy Stripe Product IDs are verified in the correct live account/mode;
- every associated Price and qualifying Subscription is inventoried;
- every qualifying Stripe Customer can be joined or flagged for review against the legacy identity crosswalk;
- active/deactivated target counts are deterministic;
- monthly/annual target cadence mapping is defined;
- sandbox product/prices remain verified;
- Bunny reusable-asset mapping is reconciled;
- staging Stripe/Bunny configuration is proven internally consistent;
- no provider mutations occurred;
- a create-new-only live catalogue packet can be generated for separate approval.

Only after these criteria are satisfied should the project prepare the separate live Product/Price creation operation.
