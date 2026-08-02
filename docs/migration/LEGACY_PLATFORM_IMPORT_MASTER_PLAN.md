# Legacy Platform Import Master Plan

**Repo:** jpv-bootcamp
**Branch:** feature/course-branding-and-preview
**Head:** c15cd578a953cd6b1dc8a3d4705350a52f7d0812
**Status:** Planning — no apply authorization granted beyond wave 1 (legacy relational, 21-row staging complete)

---

## 1. Scope and Objectives

This document is the single authoritative plan for migrating all legacy platform data into the Payload CMS-based jpv-bootcamp system. It covers eight source systems, defines the required export specifications, establishes a canonical identity crosswalk, sequences fifteen import waves, specifies validation requirements per wave, and documents the current status of every migration tool.

**Out of scope:** net-new member onboarding, Stripe live-mode billing changes, and any production apply that has not received explicit operator authorization.

---

## 2. Source Systems Overview

| # | Source System | Data Owner | Tooling Status |
|---|--------------|-----------|----------------|
| 1 | WordPress (WXR + users + media) | JC Citadel | Adapter implemented; no real export rehearsal |
| 2 | FluentCRM (contacts, consent, campaigns) | JC Citadel | Importer implemented; journal/resume; suppression protection |
| 3 | Fluent Community (spaces, posts, members) | JC Citadel | No importer; discovery export required before adapter design |
| 4 | Legacy Stripe (customers, subscriptions) | JC Citadel | Inventory + executor implemented; test-mode only |
| 5 | Relational provisioning (customer_provisioning) | JC Citadel | Implemented; staging-guarded; 21-row staging apply complete |
| 6 | WordPress media files | JC Citadel | No download tooling; references only in current adapter |
| 7 | Course progress | JC Citadel | No importer; schema mapping TBD |
| 8 | Member identity / authentication | JC Citadel | Account invitation strategy required; no password-hash migration |

---

## 3. Source Inventory Specifications

### 3.1 WordPress

Required export artifacts before wave 1 begins:

| Artifact | Format | Notes |
|---------|--------|-------|
| Full WXR export | XML (.xml) | All post types, all statuses, all taxonomies, all comments |
| Users export | CSV or JSON | wp_users + wp_usermeta; include user_login, user_email, user_registered, roles, display_name |
| Media manifest | CSV | attachment ID, GUID/URL, file path, MIME type, post_parent, alt_text, caption |
| Custom post types (CPTs) | WXR or JSON | Enumerate all registered CPTs; export each as separate slice |
| Taxonomies | JSON | All registered taxonomies and their term hierarchies |
| Comments and replies | WXR or CSV | Include comment_author_email, comment_date_gmt, comment_approved, parent |
| Attachment metadata | JSON | _wp_attachment_metadata for each media item |
| Redirect / slug inventory | CSV | Source slug, target URL or new slug, HTTP status, date added |

Checksum requirement: SHA-256 of each export file, recorded in `migration-inventory.json` before wave 1 closes.

### 3.2 FluentCRM

Required export artifacts:

| Artifact | Format | Notes |
|---------|--------|-------|
| Contacts | CSV + JSON | All fields including custom; include created_at, updated_at, source |
| Statuses | CSV | All status values and their counts |
| Tags | CSV | Tag ID, name, slug, contact count |
| Lists | CSV | List ID, name, type, contact count |
| Tag and list memberships | CSV | contact_id, tag_id or list_id, applied_at, applied_by |
| Consent timestamps | CSV | contact_id, consent_type, consented_at, revoked_at, IP, source |
| Suppression records | CSV | contact_id, email, suppression_type (unsubscribe/bounce/complaint), date, source |
| Bounce and complaint events | CSV | email, event_type, event_date, campaign_id or source |
| Campaign metadata | JSON | Campaign ID, name, status, subject, send_date, open_count, click_count |

Suppression records must be imported before any contact is created. The importer enforces this gate.

### 3.3 Fluent Community

No importer exists. A discovery export must be completed before adapter design can begin. Required export specification:

| Artifact | Format | Notes |
|---------|--------|-------|
| Users and IDs | CSV | FC user_id, wp_user_id, email, display_name, join_date, account_status |
| Spaces and groups | JSON | space_id, name, slug, type, privacy_level, owner_id, created_at |
| Memberships and roles | CSV | user_id, space_id, role, joined_at, status (active/pending/banned) |
| Posts | JSON | post_id, space_id, author_id, type, content, status, created_at, updated_at |
| Comments and replies | JSON | comment_id, post_id, parent_comment_id, author_id, content, created_at |
| Reactions | CSV | user_id, target_type, target_id, reaction_type, created_at |
| Privacy rules | JSON | space_id, visibility, join_approval_required, post_approval_required |
| Attachments | CSV | attachment_id, post_id or comment_id, file_url, file_type, file_size, uploaded_at |
| Moderation events | CSV | moderator_id, action, target_type, target_id, reason, actioned_at |
| Timestamps | — | All records must carry created_at and updated_at in UTC ISO-8601 |
| Deleted and suspended records | JSON | Soft-deleted posts, suspended users, banned memberships with deletion/suspension timestamp |

Discovery export must be performed by the site operator on the live Fluent Community instance. No automated tooling exists on our side. A dedicated adapter will be designed after reviewing the actual export structure.

### 3.4 Stripe

Required export artifacts (via Stripe API or Dashboard export):

| Artifact | Format | Notes |
|---------|--------|-------|
| Customers | JSON | All customers; include metadata, email, name, created, deleted flag |
| Subscriptions | JSON | All subscriptions including canceled; include items, current_period_end, trial dates |
| Subscription items | JSON | Price ID, product ID, quantity per item |
| Price and product mappings | JSON | price_id, product_id, nickname, unit_amount, currency, interval, active |
| Payment status | JSON | Latest invoice per subscription; payment_intent status |
| Discounts | JSON | coupon_id, percent_off or amount_off, duration, applied_to (customer or subscription) |
| Tax rates | JSON | tax_rate_id, percentage, jurisdiction, inclusive |
| Disputes | JSON | dispute_id, charge_id, amount, status, created |
| Scheduled subscription changes | JSON | subscription_schedule_id, phases, cancel_at |
| Cancellation records | JSON | subscription_id, canceled_at, cancel_at_period_end, cancellation_reason |

The `stripeSubscriptionInventory.ts` script produces a redacted inventory. Full non-redacted export must be operator-controlled and stored in a secure location outside the repo.

---

## 4. Canonical Identity Crosswalk

### 4.1 Schema

Every migrated identity must be resolved to a single crosswalk row before any wave 4+ import runs.

```
crosswalk_row {
  crosswalk_id:            UUID (generated; stable across reruns)
  normalized_email:        lowercase, trimmed (used for matching only, not as primary key)
  wp_user_id:              integer or null
  fluent_crm_contact_id:   integer or null
  fluent_community_user_id: integer or null
  stripe_customer_id:      string or null
  stripe_subscription_id:  string or null  // primary/most-recent subscription
  legacy_provisioning_id:  integer or null  // customer_provisioning PK
  payload_member_id:       string or null  // populated in wave 4
  migration_cohort:        enum (founding-21 | wave-2 | wave-3 | manual-review | excluded)
  consent_state:           enum (consented | suppressed | unsubscribed | bounced | complained | unknown)
  suppression_applied:     boolean
  identity_confidence:     enum (exact-match | email-match | manual-resolved | unresolved)
  resolution_notes:        string or null
}
```

### 4.2 Matching Rules

1. Match on `normalized_email` across all source systems.
2. Where the same email appears in multiple systems, merge into one crosswalk row; record all source IDs.
3. Where email is absent in a source system, do not create a crosswalk row for that source record until a manual resolution is recorded.
4. Email must never be the sole durable key — `crosswalk_id` is the stable join key across all downstream import scripts.
5. Multiple Stripe customers with the same email: flag as `identity_confidence = manual-resolved`; do not auto-merge.
6. Unresolved rows block wave 4 (member import) until manually reviewed and given `identity_confidence != unresolved`.

### 4.3 Password Hash Policy

Password hashes from `wp_users` must not be migrated. Default strategy: issue account invitations (REM-01 pattern) or trigger password-reset emails. Any deviation from this policy requires explicit written operator authorization and a reviewed-secure hashing compatibility analysis before implementation.

### 4.4 Crosswalk Artifacts

- `migration-crosswalk.csv` — full crosswalk export; PII-safe version uses `crosswalk_id` only (no email column)
- `migration-crosswalk-pii.csv` — full version with email; restricted access; never committed to repo
- `crosswalk-unresolved.csv` — rows with `identity_confidence = unresolved`; operator review required before wave 4

---

## 5. Import Waves

### Wave 0: Pre-Flight (not a data wave)

Before any data import begins:

- All source exports received and checksums recorded
- Crosswalk draft produced and unresolved rows reviewed
- Staging environment verified healthy
- Rollback plan confirmed executable
- Operator authorization document signed for each wave
- All tooling pinned to a specific commit hash

### Wave 1: Source Inventory and Checksums

**Goal:** Confirm all export artifacts are complete, uncorrupted, and accurately inventoried.

**Steps:**
1. Receive all export files from operator.
2. Compute SHA-256 of each file; record in `migration-inventory.json`.
3. Validate row counts against operator-provided counts.
4. Flag any discrepancy as a blocker.

**Output:** `migration-inventory.json` with file checksums, row counts, source system versions, and export timestamps.

### Wave 2: Identity Crosswalk

**Goal:** Produce a complete, operator-reviewed identity crosswalk before any member records are created.

**Steps:**
1. Parse WordPress users, FluentCRM contacts, Fluent Community users (if export available), Stripe customers, and legacy provisioning rows.
2. Match on normalized email; assign `crosswalk_id` to each merged identity.
3. Flag unresolved, duplicate-email, and multi-Stripe-customer rows for operator review.
4. Operator reviews and resolves all `identity_confidence = unresolved` rows.
5. Freeze crosswalk; compute SHA-256.

**Output:** `migration-crosswalk.csv`, `crosswalk-unresolved.csv`, `crosswalk.sha256`.

### Wave 3: Communication Consent and Suppressions

**Goal:** Import all suppression and consent records before any contact or member record is created.

**Steps:**
1. Run `fluentCrmImporter.ts --mode validate` against FluentCRM suppression export.
2. Run `fluentCrmImporter.ts --mode dry-run`; verify zero surprises.
3. Operator authorization required.
4. Run `fluentCrmImporter.ts --mode apply` for suppression/consent records only.
5. Verify suppression count matches source.

**Output:** Suppression journal, consent audit log.

### Wave 4: Members and Accounts

**Goal:** Create Payload member records for all resolved crosswalk identities.

**Steps:**
1. For each crosswalk row with `identity_confidence != unresolved`: create or update Payload member record.
2. Assign `payload_member_id`; write back to crosswalk.
3. Do not set passwords. Generate invitation tokens (REM-01 pattern) for accounts without active invitations.
4. Staging-guarded; dry-run required before apply.

**Dependencies:** Wave 2 complete and frozen; wave 3 complete.

**Output:** Member import journal, invitation token manifest (operator-controlled, never committed).

### Wave 5: Billing Projections and Entitlements

**Goal:** Reconcile legacy Stripe subscriptions to Payload entitlements; set correct access levels.

**Steps:**
1. Run `stripeSubscriptionInventory.ts` against legacy Stripe account.
2. Map each active subscription to the corresponding `payload_member_id` via crosswalk.
3. Run `stripeSubscriptionExecutor.ts --mode dry-run`; review all entitlement assignments.
4. Operator authorization required.
5. Apply entitlements.

**Dependencies:** Wave 4 complete.

**Output:** Entitlement assignment journal, unmatched subscription report.

### Wave 6: Programme and Course Content

**Goal:** Import all WordPress course content into Payload programme/course collections.

**Steps:**
1. Run `wordpressAdapter.ts` against WXR export.
2. Validate output against `jpv-programme-content.v1` schema.
3. Dry-run import; review slug conflicts and missing taxonomies.
4. Apply in draft-only mode.
5. Operator reviews drafts before publishing.

**Notes:** No media files downloaded in this wave; media references only. Media download is wave 7.

**Dependencies:** Wave 1 complete.

**Output:** Content import journal, draft-only Payload records, media reference manifest.

### Wave 7: WordPress Media

**Goal:** Transfer all WordPress media files to the target media host; update Payload media references.

**Steps:**
1. Media download tooling must be built (not yet implemented).
2. Download each file in the media manifest using attachment GUID/URL.
3. Verify file integrity (size + MIME type).
4. Upload to target storage (Bunny CDN or configured provider).
5. Update Payload media records with new URLs.
6. Produce before/after URL mapping for redirect configuration.

**Blocker:** Media download tooling does not exist. Must be built and tested before this wave can run.

**Dependencies:** Wave 6 complete; media download tooling implemented and rehearsed.

**Output:** Media transfer journal, URL mapping CSV, upload integrity report.

### Wave 8: Course Progress

**Goal:** Import per-member course progress records from legacy system.

**Steps:**
1. Course progress schema mapping must be completed (not yet done).
2. Build course progress importer (not yet implemented).
3. Validate mapping against Payload course progress schema.
4. Dry-run; verify per-member progress records match source.
5. Apply.

**Blocker:** No importer; schema mapping TBD.

**Dependencies:** Wave 4 (members), wave 6 (content) complete.

**Output:** Progress import journal, unmatched progress report.

### Wave 9: Fluent Community Spaces and Memberships

**Goal:** Create Payload community spaces and assign space memberships.

**Steps:**
1. Fluent Community discovery export must be received and reviewed (see section 3.3).
2. Fluent Community adapter must be designed and implemented.
3. Validate space and membership records against crosswalk.
4. Dry-run; verify space structure and member assignments.
5. Apply spaces and memberships.

**Blocker:** No importer. Discovery export must be completed first. Adapter design cannot begin until export structure is known.

**Dependencies:** Wave 2 (crosswalk), wave 4 (members), Fluent Community discovery export received.

**Output:** Space import journal, membership assignment journal, unmatched member report.

### Wave 10: Posts, Comments, Attachments, and Moderation

**Goal:** Import all Fluent Community post and discussion content.

**Steps:**
1. Using the same adapter from wave 9, import posts, comments, replies, reactions.
2. Resolve all author references via crosswalk.
3. Import attachments (files, not inline media — inline media is wave 7).
4. Import moderation events; apply current ban/suspension states.
5. Deleted and suspended records imported as archived/hidden, not destroyed.

**Dependencies:** Wave 9 complete.

**Output:** Post/comment import journal, attachment transfer log, moderation state report.

### Wave 11: FluentCRM Tags and Lists

**Goal:** Import FluentCRM segmentation data; link to Payload member records.

**Steps:**
1. Run `fluentCrmImporter.ts --mode validate` against tags, lists, and membership exports.
2. Dry-run; verify tag/list assignment against crosswalk.
3. Operator authorization required.
4. Apply tag and list records and assignments.

**Dependencies:** Wave 3 (consent), wave 4 (members) complete.

**Output:** Tag/list import journal, unmatched contact report.

### Wave 12: Invitations and Controlled Communications

**Goal:** Send account invitations to all members who do not yet have active Payload credentials.

**Steps:**
1. Query Payload for all member records without verified login.
2. Cross-reference suppression records; exclude suppressed/unsubscribed emails.
3. Generate invitation tokens using REM-01 pattern.
4. Operator reviews invitation list before any email is sent.
5. Operator authorizes send.
6. Dispatch invitations in controlled batches.
7. Record send timestamps and delivery status.

**Dependencies:** Wave 4 (members), wave 3 (suppressions) complete.

**Output:** Invitation dispatch journal, delivery status report, bounce/complaint follow-up list.

### Wave 13: Delta Import After Source Freeze

**Goal:** Capture any records created or modified in source systems after the initial export date.

**Steps:**
1. Operator freezes all source systems (no new writes to WordPress, FluentCRM, Fluent Community).
2. Extract delta records using updated_at timestamps since wave 1 export date.
3. Re-run relevant importers in delta mode (validate, dry-run, apply).
4. Update crosswalk with any new identities.
5. Resolve conflicts between wave 1 records and delta records.

**Dependencies:** All waves 1–12 complete.

**Output:** Delta import journal, conflict resolution log, crosswalk delta patch.

### Wave 14: Reconciliation

**Goal:** Verify that the Payload system accurately reflects all source data.

**Steps:**
1. For each source system: compare source row count to Payload record count.
2. Sample-verify a random subset of records across all collections.
3. Verify all crosswalk `payload_member_id` values are populated.
4. Verify suppression state is enforced in Payload.
5. Verify entitlements match active Stripe subscriptions.
6. Produce reconciliation report; operator signs off.

**Output:** Reconciliation report, discrepancy list, operator sign-off record.

### Wave 15: Rollback and Audit Archive

**Goal:** Package the complete migration audit trail; confirm rollback is executable.

**Steps:**
1. Archive all import journals, checksums, crosswalk files, and evidence artifacts.
2. Confirm `--mode rollback` is executable for each importer that supports it.
3. Test rollback on a staging clone.
4. Archive rollback evidence.
5. Store complete audit archive in a secure, operator-controlled location.
6. Produce final migration completion report.

**Output:** Audit archive package, rollback test evidence, migration completion report.

---

## 6. Validation Requirements Per Wave

Every wave must produce a validation report covering all of the following counters and checks. Zero exceptions.

| Field | Description |
|-------|-------------|
| `input_count` | Total records received from source for this wave |
| `accepted` | Records that passed all validation rules |
| `rejected` | Records rejected; must include rejection reason per record |
| `duplicate` | Records that already exist in target; idempotency gate |
| `manual_review` | Records flagged for operator review before apply |
| `created` | Net-new records created in Payload |
| `updated` | Existing Payload records updated |
| `unchanged` | Records where source and target already matched; no write |
| `orphan` | Records that could not be linked to a crosswalk identity |
| `checksum` | SHA-256 of the input file used; verified before import starts |
| `idempotent_rerun` | Wave must produce identical output on a second run against the same input |
| `rollback_evidence` | Proof that rollback was tested or is confirmed executable |
| `pii_safe_journal` | Journal file strips or replaces PII (email, name) with `crosswalk_id` |
| `source_to_target_reconciliation` | Final count comparison: source input rows vs. target created+updated+unchanged |

All validation reports are stored as JSON in `migration-journals/wave-{N}/validation-report.json`.

---

## 7. Current Tooling Status

### 7.1 WordPress Adapter

**File:** `scripts/content/wordpressAdapter.ts`

**Capabilities:**
- Parses WXR, CSV, and JSON input formats
- Transforms content to `jpv-programme-content.v1` format
- Draft-only output; no content is published automatically
- Media references preserved; no media file download

**Gaps:**
- No real export rehearsal against production or staging WordPress data
- No media download capability (wave 7 blocker)
- No dedicated CLI command or npm package script
- Missing end-to-end integration test with real Payload client

**Required before wave 6:** Real WXR export rehearsal; CLI command added to `package.json`.

### 7.2 FluentCRM Importer

**File:** `scripts/migration/fluentCrmImporter.ts`

**Capabilities:**
- Modes: `validate`, `dry-run`, `apply`, `rollback`
- Accepts CSV and JSON input
- Suppression protection gate (wave 3 must complete before wave 11)
- Journal and resume support
- Tag, list, contact, and consent record support

**Gaps:**
- No real export rehearsal against production or staging FluentCRM data
- No confirmed evidence of approved Payload client integration in apply mode
- Rollback evidence not yet produced for a real apply run

**Required before wave 3:** Real FluentCRM export rehearsal; operator-approved Payload client integration confirmation.

### 7.3 Fluent Community Importer

**Status:** Does not exist.

**Blockers:**
1. Discovery export must be obtained from operator (see section 3.3).
2. Export structure must be reviewed before adapter design can begin.
3. Adapter design, implementation, testing, and rehearsal all required before wave 9.

**No wave 9 or wave 10 work can begin until this importer exists.**

### 7.4 Legacy Relational Migrator

**File:** `scripts/migration/legacyMigration.ts`

**Capabilities:**
- Modes: `extract`, `validate`, `dry-run`, `apply`, `rollback`
- Source: `customer_provisioning` Prisma tables
- Destination: Payload collections
- Staging guard enforced; will not apply to production without explicit override

**Status:**
- 21-row staging apply complete and verified
- Production apply authorization pending

**Required before production apply:** Explicit operator authorization.

### 7.5 Stripe Inventory and Executor

**Files:**
- `scripts/migration/stripeSubscriptionInventory.ts` (read-only; redacted output; DI-capable)
- `scripts/migration/stripeSubscriptionExecutor.ts` (executor; migrate subscriptions)

**Status:**
- Test-mode only; no live-mode apply has been authorized
- Legacy migration apply authorization pending
- Inventory produces redacted output suitable for logging

**Required before wave 5:** Operator authorization for live-mode apply; cross-referenced crosswalk from wave 2.

### 7.6 Member Invitation Reset

**File:** `scripts/migration/runMemberInvitationReset.ts`

**Status:**
- 17/17 tests passing
- 21-member cohort confirmed via dry-run
- Apply authorization pending

**Required before wave 12:** Explicit operator authorization.

### 7.7 Next-Domain Migration Tools

**File:** `scripts/migration/runNextDomainMigrations.ts`

**Coverage:** REM-03 through REM-07

**Status:**
- Built and tested
- Apply authorization pending for all REM items

---

## 8. Missing Tooling Summary

| Tool | Required For | Status |
|------|-------------|--------|
| Media download / upload | Wave 7 | Not implemented |
| Course progress importer | Wave 8 | Not implemented; schema mapping TBD |
| Fluent Community adapter | Waves 9–10 | Not implemented; blocked on discovery export |
| WordPress CLI command | Wave 6 | Missing from package.json |
| Crosswalk builder script | Wave 2 | Not implemented |

---

## 9. Authorization and Governance

Each wave requires a separate operator authorization before apply mode is executed. Authorization must be:

- Recorded in `docs/migration/authorization/wave-{N}-authorization.md`
- Signed by the designated operator (name + date)
- Specific to the wave, the mode (`apply`), and the environment (`staging` or `production`)
- Retained as part of the wave 15 audit archive

No migration tool may run in apply mode on production without a matching authorization document.

---

## 10. PII Handling

- All journal files stored in the repo or CI artifacts must replace PII (email, name, phone) with `crosswalk_id`.
- The full crosswalk with email (`migration-crosswalk-pii.csv`) is stored only in operator-controlled secure storage and never committed to the repo.
- Invitation tokens are never committed to the repo.
- Stripe customer IDs may appear in non-PII journals.
- Any file containing live email addresses must be listed in `.gitignore` before it is written.

---

## 11. Rollback Strategy

Each importer that supports rollback must be tested in rollback mode before its wave's apply is authorized for production. Rollback evidence must include:

- The command run
- The environment targeted
- The count of records reverted
- A timestamp
- The operator who authorized the rollback test

Rollback is not a substitute for dry-run validation. Both are required.

---

## 12. Key Files and References

| File | Purpose |
|------|---------|
| `scripts/migration/legacyMigration.ts` | Relational provisioning migrator |
| `scripts/migration/fluentCrmImporter.ts` | FluentCRM contact/consent importer |
| `scripts/migration/stripeSubscriptionInventory.ts` | Stripe inventory (read-only) |
| `scripts/migration/stripeSubscriptionExecutor.ts` | Stripe subscription executor |
| `scripts/migration/runMemberInvitationReset.ts` | Invitation reset (REM-01) |
| `scripts/migration/runNextDomainMigrations.ts` | REM-03 through REM-07 |
| `scripts/content/wordpressAdapter.ts` | WordPress content adapter |
| `docs/migration/migration-inventory.json` | Source file checksums (to be created in wave 1) |
| `docs/migration/migration-crosswalk.csv` | PII-safe crosswalk (to be created in wave 2) |
| `docs/migration/authorization/` | Per-wave authorization documents |
| `migration-journals/` | Per-wave validation reports and journals |

---

*Document version: 2026-08-02. Update this document when tooling status changes or authorization is granted for any wave.*
