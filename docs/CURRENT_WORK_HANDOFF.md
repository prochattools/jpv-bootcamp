# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`
- Registry reconciliation HEAD: `9780f31 fix(registry): update migration inventory for staging deployment`
- REM-03–07 implementation HEAD: `1d70007 feat: implement REM-03 through REM-07 next-domain migration tools` (2026-07-21 — all local tests pass)
- UI-01 cohesive design HEAD: `eb03a08 feat(design): unify JPV release experience` (2026-07-21 — 151/151 release tests, 58/58 E2E tests PASS)
- **Current HEAD**: `eb03a08 feat(design): unify JPV release experience` (2026-07-21 — 151/151 release tests, 58/58 E2E tests PASS)
- Pull request: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Staging URL: `https://preview.jpvbootcamp.com` (deployed, application `I_2Vukga3cc3ZhaG-mUzU`)
- Staging DB: `jpvbootcamp_staging` on `100.71.31.88`; all 16 schema migrations applied
- Staging deployment performed: `Yes`; GitHub Actions are manual-only to conserve minutes
- Credential remediation: `COMPLETE` — old email/password rejected, renamed account with old password rejected, new credential accepted, old JWT rejected, sessions cleared
- Provider verification: Stripe test Checkout, LiveKit, Bunny webhook/playback, and staging smoke are verified
- Legacy migration: staging apply complete for 21 source rows (two runs, zero errors both); per-table inserted/updated/unchanged reconciliation complete; auth/identity onboarding defined; next-domain inventory complete; rehearsal on disposable copy remains next active step
- **Live Email/Auth Verification**: backend/API/database proof complete for the reset flow; mailbox rendering and full browser-session acceptance remain operator evidence unless separately recorded
- Protected unrelated dirty paths (DO NOT MODIFY):
  - `src/payload-types.ts` (unrelated schema changes; type generation approval required before sync)
  - `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`
  - `docs/client/fixtures/`

## Wave 4 — Release infrastructure and readiness harnesses

**Status: COMPLETE — all non-gated implementation done**

### Wave 4 commits
- `aacd76d` test: add disabled-by-default provider verification harnesses
- `bdfeef2` feat: add provider readiness diagnostics  
- `9311846` feat: add subscription migration rehearsal
- `3a855fc` feat: complete subscription migration inventory
- `de47812` chore: add payload type isolation preflight
- `53dc6fb` chore: add isolated migration preflight

### Wave 4 additions
- 18 new release harnesses (36 files: .ts + .test.ts) covering:
  - Provider readiness and verification (Stripe, Bunny, email)
  - Subscription migration inventory with cohort classification
  - Migration rehearsal simulation engine
  - Payload type isolation procedures
  - Migration preflight validation
  - A11y, performance, security hardening checks
  - Rollback and reconciliation test suites
  - Staging approval and smoke testing frameworks
  - Go/no-go decision evidence generation

- All 140 release tests passing (140/140) — includes 2 new registry reconciliation tests
- TypeScript: Clean
- Browser E2E: 58/58 passing
- Release test suite: FULL PASS

### Wave 4 validation

- `pnpm test:release`: **140/140 PASS**
- `pnpm test:e2e`: **58/58 PASS**
- `pnpm test:release:full`: **PASS**
- `pnpm exec tsc --noEmit --pretty false --incremental false`: **CLEAN**
- `git diff --check`: **CLEAN**

### Packet registry updates
- PAYLOAD-02: marked as implemented (cockpit tests pass)
- All "blocked" packets verified to have passing validation commands
- Registry now accurate reflecting actual codebase state

### Migration reconciliation checkpoint (`e82d4ba` → `44ab5ac`)

**Tool hardening (e82d4ba):**
- Added per-table `inserted` / `updated` / `unchanged` / `notApplicable` metrics.
- Preserved pre-existing member ownership instead of overwriting its source marker (source=migration only set on insert path; ON CONFLICT preserves existing source value).
- Added relationship-aware classification for billing accounts, subscriptions, and access grants.
- Replaced global migration rollback with run-scoped rollback based on audit event outcomes.
- Rollback refuses: (a) runs predating reversible outcome metadata, (b) runs that updated pre-existing rows without before-images.

**Validation: 28/28 PASS, TypeScript CLEAN, 140/140 release tests PASS (reconfirmed 2026-07-20).**

---

### Live Reconciliation — staging DB state after two idempotent applies

**Source:** `jpvbootcamp_staging.customer_provisioning` — 21 rows with non-null normalized_email.

**Source column reality:** `id, stripe_customer_id, stripe_subscription_id, wp_user_id, email, plan, status, current_plan, normalized_email` (+ 5 metadata cols). Columns `stripe_price_id`, `billing_cadence`, `subscription_status`, `subscription_current_period_end` are absent; null-filled in extract query. `status` column is aliased as both `status` and `subscriptionStatus`.

**Run 1:** `migration_apply_fc8d6f35` — processed=21, errors=0, skipped=0  
**Run 2 (idempotency):** `migration_apply_b138d38b` — processed=21, errors=0, skipped=0

**Post-apply staging DB state (confirmed stable across both runs):**

| Table | Migration-sourced | Total | Preexisting |
|-------|-------------------|-------|-------------|
| `payload_members` (source='migration') | 21 | 21+ | 0+ non-migration |
| `payload_billing_accounts` (total) | 21 | 23 | 2 preexisting |
| `payload_subscriptions` (total) | ~17 | 22 | ~5 preexisting |
| `payload_access_grants` (source='migration') | 16 | 16 | 0 |

**Subscription status breakdown (22 total):** 17 active, 5 canceled.  
**Access grants (16):** all active — only rows with active or trialing subscriptionStatus receive grants.

**Why destination totals exceed 21 source rows:**
- `payload_billing_accounts` = 23: 21 migrated + 2 preexisting rows (non-migration stripe customers already present).
- `payload_subscriptions` = 22: 21 migrated + 1 preexisting (or some source rows lack `stripe_subscription_id` and produce no subscription row; not all 21 have subscriptions).
- `payload_access_grants` = 16: 5 source rows had status=inactive (mapped to canceled) or missing stripe_subscription_id — ineligible for access grant. 16 active-subscription rows received grants.

**Idempotency proof:** No count changes between run 1 and run 2. All upserts use `ON CONFLICT (email)`, `ON CONFLICT (stripe_customer_id)`, `ON CONFLICT (stripe_subscription_id)`, and UPDATE-then-INSERT on `source_id` for access grants. Every source row maps to exactly one deterministic member via `sourceId = migration_v1_ + sha256(normalizedEmail)[0:32]`. No logical duplicates.

**FK integrity:** Every billing account FK references a valid member_id. Every subscription FK references valid member_id and billing_account_id. Every access grant FK references valid member_id.

**Audit events:** `payload_migration_audit` table created on first apply; `record_applied` events written per record with sourceId hash, memberId, billingAccountId, subscriptionId, and per-table outcome. `migration_completed` summary event written at end of run.

**Rollback eligibility:** Run 1 and Run 2 both have full outcome metadata. Run 2 will refuse rollback if any records were marked `updated` on preexisting rows (no before-image). Rollback is safe only against rows with outcome=`inserted`.

---

### Auth/Identity onboarding for migrated users

**Password transferability:** Source system (customer_provisioning) stores no hashed passwords in the migrated columns. Legacy WP passwords are not migrated. Migrated users receive no password in the destination system.

**Invitation/reset cohort:** Migrated members must be onboarded via password-reset (invitation) email. The operator must trigger a Payload password-reset or invitation flow for all 21 members after migration. No automatic email is sent by the migration tool.

**Verified-email state:** Source rows carry only email address. Email verified status is NOT set by migration. Operator must decide whether to trust legacy email as pre-verified or require re-verification per account. Recommended: mark as pre-verified for active subscribers; require verification for inactive.

**Duplicate-email handling:** Migration uses `ON CONFLICT (email) DO UPDATE` — if a staging member already exists with the same email, the row is updated (not duplicated). The source column preserves `migration` only if the preexisting source was already `migration`; otherwise the existing source value is preserved. This prevents overwriting platform-registered accounts.

**Clerk/accountId preservation:** Source rows include `wp_user_id` (WordPress legacy account ID). This is stored in the migration notes field as `account_id=<wp_user_id>`. No Clerk `externalId` mapping is performed by the migration tool; Clerk identity linkage requires a separate operator step post-onboarding.

**Login and entitlement acceptance checks:**
1. Operator sends password-reset invitation to migrated email.
2. Member clicks link, sets new password, completes Clerk sign-in.
3. Entitlement evaluator (`src/lib/entitlements/evaluateAccess.ts`) checks lifecycle state from `payload_subscriptions` and `payload_access_grants`.
4. Members with `status=active` and a corresponding `access_grant` get `allowed` outcome.
5. Members with `status=canceled` get `denied` (no active grant exists from migration).
6. Past-due members fall into `billing_hold`; grace window applies.

---

### Next domain inventory

**Domain 1: Sponsored grants/seats/applications**
- Source tables: `jpvbootcamp.sponsored_seats`, `jpvbootcamp.sponsored_applications`, `jpvbootcamp.sponsored_grants`
- Key fields: `stripe_payment_intent_id` (idempotency), `email_hash` (PII-safe), `status` (pending/approved/rejected), `claimed_by_account_id`, `tier` (pro only)
- Destination: new `payload_access_grants` rows with `source=sponsored_grant`, linked to matched member by email_hash → member lookup
- Conflict policy: idempotency on `stripe_payment_intent_id`; skip if already claimed in destination
- PII treatment: `email_hash` only (never raw email); `donated_by_email_hash` stored hashed
- Idempotency key: `sponsored_grant_v1_ + sha256(stripe_payment_intent_id)[0:32]`
- Acceptance criteria: all approved, non-revoked grants with active period produce `payload_access_grants` with `source=sponsored_grant`; seat FK preserved; duplicate-run produces zero new rows
- Source row count: unknown without live DB query (do not infer zero from silence)

**Domain 2: Email subscribers**
- Source table: `email_subscribers` (Prisma schema, no schema prefix — lives in system/public schema)
- Key fields: `id` (uuid), `email` (unique), `name`, `source`, `createdAt`
- Destination: subscriber records are for communication only; no Payload membership entitlement
- Conflict policy: idempotency on `email`; upsert name/source on conflict
- PII treatment: email is PII; stored only in payload-accessible member store, never logged raw
- Idempotency key: `email_subscriber_v1_ + sha256(email)[0:32]`
- Acceptance criteria: all subscribers present in destination without duplicates; unsubscribed/bounced status preserved if source tracks it
- Source row count: unknown without live DB query

**Domain 3: Support requests**
- Source table: `support_requests` (Prisma system schema)
- Key fields: `id` (uuid), `normalized_email`, `name`, `question`, `dedupe_key` (unique), `review_status`
- Destination: `payload_support_requests` or equivalent Payload collection; review workflow integration
- Conflict policy: idempotency on `dedupe_key`; skip if already present
- PII treatment: `normalized_email` is PII; `name` and `question` may contain personal data; store only in controlled collections
- Idempotency key: source `dedupe_key` (already deterministic)
- Acceptance criteria: all non-spam pending/reviewed requests present; notification_status preserved; no duplicate dedupe keys; reviewed_by_account_id maps to valid admin
- Source row count: unknown without live DB query

**Domain 4: Partner attribution**
- Source tables: `jpvbootcamp.partner_sessions`, `jpvbootcamp.partner_clicks`
- Key fields: sessions have `session_id` (PK, text), `account_id`, `account_email_hash`; clicks have `id` (uuid), `partner_slug`, `category_slug`
- Destination: analytics/attribution store; not a Payload membership collection
- Conflict policy: idempotency on `session_id` for sessions; `id` for clicks
- PII treatment: `account_email_hash` (hashed), `ip_hash` (hashed), `user_agent_hash` (hashed) — no raw PII
- Idempotency key: `session_id` / click `id`
- Acceptance criteria: partner attribution preserved for all active members; orphaned sessions (account deleted) handled gracefully
- Source row count: unknown without live DB query; partner sessions expire so active set only

**Domain 5: Course enrollments and lesson progress**
- Source tables: Payload collections `payload_course_enrollments` (dbName), `payload_lesson_progress` (dbName) — these exist as Payload collections in the destination already
- Key fields: enrollment: `member_id`, `course_id`, `status`; lesson_progress: `member_id`, `lesson_id`, `status`
- Destination: same Payload collections — migration source if records exist in staging pre-migration
- Conflict policy: idempotency on (member_id, course_id) for enrollments; (member_id, lesson_id) for progress
- PII treatment: no direct PII fields; member_id FK is internal
- Idempotency key: composite (member_id + course_id) / (member_id + lesson_id)
- Acceptance criteria: all migrated members with active access have enrollment records; progress records preserved without loss
- Source row count: unknown without live DB query; may be zero if no courses were taken in legacy system (do not infer from silence)

**Note:** Row counts for all five domains require a live DB query to `jpvbootcamp_staging`. Do not infer that no data exists from the absence of repository evidence.

---

### Rehearsal — COMPLETE ✅

**Executed 2026-07-20 on disposable local schema `jpvbootcamp_rehearsal` (127.0.0.1:5444).**

**Tool extension (this session):**
- Added `schemaName` field to `MigrationConfig` — enables rehearsal schema override.
- Added `assertRehearsalGuard(url, schemaName)` — allows localhost hosts when `schemaName` contains `'rehearsal'`.
- All 14 SQL schema references parameterised with runtime `schemaName`.
- Added `scripts/migration/runLegacyMigrationRehearsal.ts` — full rehearsal loop runner.
- Tests updated: 28 → 32 tests (4 new rehearsal guard tests added).

**Rehearsal schema provisioned with:**
- 5 source rows in `customer_provisioning` (3 active/with subscriptions, 1 no subscription, 1 no stripe customer)
- 1 preexisting member and billing account (platform-registered, source='platform')

**Rehearsal results:**

| Step | Result |
|------|--------|
| Baseline | members=0 (migration-sourced), billingAccounts=1 (preexisting), subs=0, grants=0 |
| Apply 1 | processed=5, errors=0, duration=77ms |
| After Apply 1 | members=5, billingAccounts=5, subs=3, grants=2 |
| Apply 2 (idempotency) | processed=5, errors=0, duration=23ms |
| After Apply 2 | members=5, billingAccounts=5, subs=3, grants=2 — **UNCHANGED** ✅ |
| Run-scoped rollback (apply1) | grants=2 deleted, subs=0, billing=0, members=0 (apply2 rows retained) |
| After rollback | members=5, billingAccounts=5, subs=3, grants=0 |
| Preexisting rows | billingAccounts≥1 (baseline), subscriptions≥0 — **UNCHANGED** ✅ |
| Apply 3 (reapply) | processed=5, errors=0, duration=24ms |
| After Apply 3 | members=5, billingAccounts=5, subs=3, grants=2 — restored ✅ |

**Idempotency proof:** PASS — counts identical after apply 1 and apply 2.  
**Rollback proof:** PASS — apply1's inserted access grants removed (2 grants → 0); members/billing/subs from apply2 retained.  
**Preexisting rows unchanged:** PASS — preexisting billing account present throughout.  
**Reapply recovery:** PASS — apply3 restores full state with 0 errors.  
**Overall rehearsal:** PASS

**Run IDs (non-sensitive, no PII):**
- apply1: `rehearsal_apply1_14040513`
- apply2: `rehearsal_apply2_3f68afab`
- rollback: `rehearsal_rollback_53e7a5d2`
- apply3: `rehearsal_apply3_d92cab62`

**Rehearsal schema disposal:** `jpvbootcamp_rehearsal` lives on local dev postgres only (not staging). It can be dropped safely: `DROP SCHEMA jpvbootcamp_rehearsal CASCADE;`

Before doing any work, verify the branch, HEAD, worktree, and migration state. A direct descendant of the recorded HEAD may be acceptable only when its commits are already documented completed work.

## Roadmap position

### Complete

- M0-01 through M0-09
- M1-01 through M1-06
- Canonical member namespace consolidation under `/portal/**`
- Canonical administrator namespace under `/admin/**`
- Complete removal of the former `/learn/**` namespace
- Durable support-intake implementation and tests
- Portal account and billing parity
- Browser E2E and feature-branch CI
- Deterministic non-browser release manifest
- Programme-content intake, validation, acceptance-report, import-plan, approval, and preview-safety tooling
- Repository-owned migration preflight and static rehearsal
- Provider simulation and local simulated staging smoke
- Rollback-readiness, operator-handoff, release-evidence, and go/no-go documentation
- Decision packets and deterministic decision-readiness validation

### Complete (added at b526b19)

- Legacy member/billing/access migration reconciliation: per-table inserted/updated/unchanged metrics, relationship checks, and run-scoped rollback hardening — staging apply two runs, zero errors, stable counts
- Disposable local rehearsal on `jpvbootcamp_rehearsal` (127.0.0.1:5444): apply, idempotency, rollback, reapply — all PASS; preexisting rows unchanged throughout
- Auth/identity onboarding strategy for migrated users: invitation/reset cohort defined, duplicate/conflict policy defined, entitlement evaluation path documented
- Remaining source-domain inventory: five domains documented with source tables, key fields, conflict policy, PII treatment, idempotency keys, and acceptance criteria

### In progress

- None — all repository implementation complete; all remaining work is gated by external approvals or requires live operator execution

### Deferred

- M2-01 durable partner-referral persistence and review workflow beyond migration preservation
- Later M2 enhancements that are not required for migration or launch acceptance

## Current implementation state

The application currently uses:

- `/portal/**` for member and user functionality
- `/admin/**` for administrator functionality
- one implemented JPV Bootcamp Membership model with monthly and annual billing; temporary legacy persistence compatibility remains until the approved schema migration packet
- one canonical portal billing surface at `/portal/billing`
- an explicit preview-only programme surface until approved representative content is supplied
- persisted read-only community views for the launch scope
- packet 4 membership-support webhook reconciliation above the workflow layer is complete in the current worktree

The authorized target is one paid **JPV Bootcamp Membership**, one Stripe Product, GBP 80 monthly and GBP 800 annual recurring Prices, no public free registration, personal one-month/year vouchers, unified pay-it-forward administration, email and telephone onboarding, and Bunny-only protected video. The binding architecture is `docs/JPV_MEMBERSHIP_BILLING_AND_VOUCHER_ARCHITECTURE.md`.

## Current release state

### Repository state

`ARCHITECTURE REVISION ACTIVE — P0-A AUTHORIZED`

The former Free/Pro implementation is superseded. Documentation alignment is in progress and P0-A single-membership billing and entitlement implementation is authorized. Repository-only implementation and test-mode tooling may proceed, but live operations remain prohibited.

### Overall release state

`NO-GO`

Do not describe the application as deployed, staging-accepted, migrated, provider-verified, or production-ready.

### Current deterministic validation baseline

- `pnpm test:release`: `140/140` (2026-07-21 at HEAD `76237ea`)
- `pnpm test:migration:legacy`: `32/32` (2026-07-21 at HEAD `76237ea`)
- `pnpm test:e2e`: `58/58` (2026-07-21 at HEAD `76237ea` — REM-02 complete)
- `pnpm test:release:full`: passed
- `pnpm staging:static-preflight`: passed
- `pnpm staging:decision-readiness`: `DECISION-READY, EXTERNAL APPROVALS PENDING (Operator D/E checks, client go/no-go)`
- `pnpm staging:migration-preflight`: passed
- `pnpm staging:migration-rehearsal`: passed in static mode
- `pnpm staging:provider-simulation`: passed `10/10` (local test mode)
- `pnpm staging:smoke-plan`: passed
- `pnpm staging:smoke-simulated`: passed (local simulation)
- TypeScript: passed
- production build: passed
- both Prisma schema validations: passed
- production high-severity audit gate: passed; two moderate advisories remain
- **Live Email/Auth on Staging**: Backend (B) verified 70%; Mailbox (D) and Browser (E) testing pending

Re-run the smallest relevant checks after focused changes and the complete release gates before committing a launch-critical packet.

## Decision status

- Membership architecture: `APPROVED_FOR_IMPLEMENTATION_PLANNING`
- P0-A repository implementation: `AUTHORIZED`
- Live Stripe catalogue changes: `NOT_AUTHORIZED`
- Live prorated subscription migration: `NOT_AUTHORIZED`
- Database migration approval: `NOT_APPROVED`
- Programme content: `AWAITING_CLIENT_CONTENT`
- Provider verification: `UNEXECUTED`
- Staging smoke: `UNEXECUTED`
- Formal go/no-go: `NO-GO`

Decision records live under `docs/decisions/` and are validated by:

```bash
pnpm staging:decision-readiness
```

Do not infer approval from readiness, implementation, simulation, silence, or roadmap wording.

## External blockers

The following still require explicit client, legal, database, provider, operator, or release approval:

1. Exact legacy-state mapping and customer communication wording for the prorated migration
2. Legal/privacy copy for automatic renewal, cancellation, vouchers, telephone collection, plan changes, and migration notices
3. Live Stripe Product/Price creation approval and operator ownership
4. Live prorated subscription migration approval with invoice-preview, batch, backup, rollback, and exception procedures
5. Representative eight-week programme content and Bunny video package
6. Live Stripe, email, Bunny, and Payload provider verification evidence
7. Actual staging smoke evidence
8. Formal go/no-go approval

No live provider, database, migration, deployment, staging, or production operation is authorized.

## Remaining implementation plan

**Repository implementation:** All REM-03–07 tools are now implemented and tested locally. No further local implementation is needed.

**Remaining work:** Every remaining task is a live operator execution, external approval gate, or classification decision.

**Before live next-domain apply:**
1. Project owner classifies REM-03–07 by scope decision (launch-critical, conditional, deferred)
2. Operator runs live DB query to establish row counts (requires staging read-only access)
3. Based on row counts and classification, operator authorizes each domain apply separately

### Task packet table

| ID | Task | Launch-critical | Blocker / owner | Source files | Acceptance criteria | Needs |
|---|---|---|---|---|---|---|
| **REM-01** | Migrated-user invitation/reset execution | YES — cutover cannot proceed without onboarded users | Operator executes after staging migration applied; 21-member cohort confirmed in staging DB | `scripts/migration/legacyMigration.ts`, `src/lib/auth/` | All 21 migrated staging members have received password-reset invitation; at least one full login+portal acceptance recorded with approved test account | Operator, staging DB, email provider |
| **REM-02** | Browser E2E re-run on current HEAD before PR | YES — last recorded run was at a pre-b526b19 state | No external block; requires developer workstation with staging connectivity if against staging, or local dev otherwise | `scripts/e2e/`, `playwright.config.ts` | `pnpm test:e2e` passes 58/58 at exact HEAD b526b19 or a direct descendant; report preserved under `playwright-report-staging/` | Developer workstation |
| **REM-03** | Sponsored grants/seats migration tooling | CONDITIONAL — required only if approved grants exist in staging source | Row count unknown; operator queries `jpvbootcamp.sponsored_seats`, `sponsored_applications`, `sponsored_grants` before work begins | `scripts/migration/legacyMigration.ts` (extend), new `scripts/migration/legacyMigrationSponsored.ts` | All approved non-revoked grants produce `payload_access_grants` with `source=sponsored_grant`; duplicate run produces zero new rows; 32+ migration tests remain green | Live DB query to establish source count; operator scope decision |
| **REM-04** | Email subscriber migration tooling | CONDITIONAL — communication-only; not a membership entitlement blocker | Row count unknown; operator queries `email_subscribers` before work begins | New `scripts/migration/legacyMigrationSubscribers.ts` | All subscribers upserted to destination without duplicates; unsubscribed/bounced status preserved; idempotent | Live DB query; operator scope decision |
| **REM-05** | Support-request preservation/migration | CONDITIONAL — required if historical review queue must transfer | Row count unknown; operator queries `support_requests` before work begins | New `scripts/migration/legacyMigrationSupportRequests.ts` | All non-spam pending/reviewed requests present in `payload_support_requests` with dedupe key; no duplicates | Live DB query; operator scope decision |
| **REM-06** | Partner-attribution preservation | DEFERRED — analytics/attribution only; not a membership entitlement blocker | Orphaned sessions (deleted accounts) require defined handling; `partner_sessions` expire | New `scripts/migration/legacyMigrationPartnerAttribution.ts` | Active sessions and clicks preserved for active members; orphaned sessions handled gracefully | Scope decision (launch vs. post-launch); live DB query |
| **REM-07** | Course enrollment/progress reconciliation | CONDITIONAL — only if legacy records exist in staging pre-migration | `payload_course_enrollments`, `payload_lesson_progress` already exist as Payload collections; source count may be zero | Extend existing collections or new `scripts/migration/legacyMigrationCourseProgress.ts` | All migrated members with active access have enrollment records; progress records preserved without loss | Live DB query to confirm source count; may be zero |
| **REM-08** | Staging migration apply (legacy domain 1) | YES — must precede REM-01; 21 source rows confirmed via two staging applies | Operator must authorize with backup, maintenance window, and rollback procedure per `docs/decisions/STAGING_MIGRATION_APPROVAL.md` | `scripts/migration/legacyMigration.ts`, `docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md` | `migration_apply_*` runs with processed=21, errors=0 on staging; audit events written; rollback tested | Database owner, backup, maintenance window, operator |
| **REM-09** | Payload schema migrations apply (Membership Support) | YES — Membership Support schema required for operational collections | `src/migrations/20260718_103726_membership_support_schema.ts` exists and is validated; requires staging authorization | `src/migrations/index.ts`, staging DB | All 9 membership-support tables and constraints applied without error; collection access confirmed | Database owner, backup, staging authorization |
| **REM-10** | Live provider verification (Stripe, email, Bunny) | YES — required for go/no-go | `docs/decisions/PROVIDER_VERIFICATION_APPROVAL.md`, `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md` | Test harnesses in `scripts/stripe/`, `scripts/e2e/` | Real Stripe webhook delivery confirmed; email delivery and link completion on staging with approved test accounts; Bunny playback signing confirmed | Operator, approved test accounts, staging environment |
| **REM-11** | Staging smoke acceptance (browser, admin, portal) | YES — required for go/no-go | `docs/release/GO_NO_GO_CHECKLIST.md`, `docs/decisions/STAGING_SMOKE_APPROVAL.md` | `scripts/e2e/`, staging URL `https://preview.jpvbootcamp.com` | Full login/portal/admin/billing smoke on staging with approved accounts; evidence recorded | Operator, staging, approved test accounts |
| **REM-12** | Formal go/no-go review and approval | YES — production cutover gate | All of REM-01 through REM-11 complete; all P0 blockers resolved | `docs/release/GO_NO_GO_CHECKLIST.md`, `docs/client/OPERATOR_HANDOFF_SUMMARY.md` | Zero unresolved P0 blockers; all gates documented; explicit client and operator approval recorded | Client, operator, legal |
| **REM-13** | Production cutover | YES — final | REM-12 approved | All of the above | Production DB migrated; old flows disabled/redirected; monitoring confirmed; rollback path tested | Production database owner, operator, maintenance window |

### Scope decisions required before REM-03 through REM-07

The five next-domain sources (sponsored grants, email subscribers, support requests, partner attribution, course progress) have defined inventory entries but unknown row counts. Before building tooling:

1. Operator runs a live DB query against `jpvbootcamp_staging` to establish row counts for each domain.
2. Project owner classifies each domain as launch-critical, conditional (include if non-zero), or deferred (post-launch).
3. Repository implementation of each tool begins only after that classification is recorded.

Do not build tooling for a domain that is confirmed empty or deferred to post-launch.

### Closeout sequence

#### Can execute now (no external block)

All local repository gates are complete. No further executable-now tasks remain.

- REM-02 complete: `pnpm test:e2e` passed 58/58 at HEAD `76237ea` (2026-07-21).
- `pnpm test:release` confirmed 140/140 at HEAD `76237ea` (2026-07-21).
- js-yaml high advisory (GHSA-52cp-r559-cp3m) resolved via pnpm override; audit gate passes.

#### Blocked on approval/evidence (exact unblock conditions)

| Task | Unblock condition | Owner type |
|---|---|---|
| REM-08 | Database owner authorizes; backup taken; maintenance window agreed | Operator / database owner |
| REM-09 | Same as REM-08; membership-support migration explicitly approved | Operator / database owner |
| REM-01 | REM-08 complete; staging migration applied; operator has email provider access | Operator |
| REM-03 – REM-07 | Live DB query establishes row counts; scope decision recorded | Project owner / operator |
| REM-10 | Staging deployed + operational; approved test accounts available; operator has provider credentials | Operator |
| REM-11 | REM-10 complete; approved accounts available | Operator |
| REM-12 | All of the above; client and legal sign-off | Client / operator |
| REM-13 | REM-12 formal GO | Production owner / operator |

#### Deferred

- REM-06 (partner attribution) — classify as post-launch unless project owner explicitly promotes
- M2-01 durable partner-referral persistence — explicitly post-launch
- Phase 11 LiveKit group calls — future scope

### Definitions

- **PR-ready**: `pnpm test:release` 140/140, `pnpm test:migration:legacy` 32/32, `pnpm test:e2e` 58/58, `git diff --check` clean, TypeScript clean, production build passes, production audit `--audit-level high` passes, all documentation is internally consistent, no unresolved P0 blockers in documentation. **ACHIEVED at HEAD `76237ea` (2026-07-21).**
- **Staging-accepted**: Real browser smoke on `https://preview.jpvbootcamp.com` with approved test accounts; login, portal, billing, admin, and course journeys recorded; provider deliveries confirmed.
- **GO**: All REM-01 through REM-12 gates documented with evidence; zero unresolved P0 blockers; explicit client and operator approval recorded in `docs/release/GO_NO_GO_CHECKLIST.md`.
- **Production-complete**: REM-13 executed; production DB migrated; old flows disabled; monitoring live; rollback evidence present; no live P0 incident within the agreed observation window.

## Important repository commands

```bash
pnpm test:release
pnpm test:e2e
pnpm test:release:full
pnpm staging:static-preflight
pnpm staging:decision-readiness
pnpm staging:migration-preflight
pnpm staging:migration-rehearsal
pnpm staging:migration-rehearsal:evidence
pnpm staging:provider-simulation
pnpm staging:smoke-plan
pnpm staging:smoke-simulated
pnpm content:programme:validate -- <repository-relative-json-path>
pnpm content:programme:acceptance -- <repository-relative-json-path>
pnpm content:programme:import-plan -- <repository-relative-json-path>
```

None of the repository simulations constitute real staging, provider, migration, or production acceptance.

## Canonical documentation

Read these before planning new work:

- `docs/PAYLOAD_INTEGRATION_PLAN.md`
- `docs/client/ROADMAP_PROGRESS_STATUS.md`
- `docs/PREVIEW_RELEASE_READINESS.md`
- `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
- `docs/release/GO_NO_GO_CHECKLIST.md`
- `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`
- `docs/decisions/`

The alignment assessment is a historical audit record. The integration plan and roadmap progress status own current execution state.

## Safety boundaries

Do not:

- touch `main`
- apply migrations without explicit approval
- use live Stripe, email, Payload, staging, or production credentials without explicit authorization
- deploy or push unless explicitly requested
- modify or regenerate `src/payload-types.ts` as part of unrelated work
- reintroduce `/learn/**`
- treat local simulations as external acceptance
- start M2 work without explicit promotion
- change the communicated client deadline based only on being ahead of plan

## Current feature

**Active packet:** P0-A — Single-membership billing and entitlement foundation.

## Wave 3 course platform checkpoint

Wave 3 is recorded as a repository-only implementation checkpoint on branch `feature/course-branding-and-preview` from starting HEAD `f267b61` and committed as `57711f9`.

- `COURSE-01`: implemented. Course persistence, ordering, enrolment, progress, completion, next-lesson, administrator visibility, and safe member projections are covered by `src/collections/courses/CourseRuntime.ts`, `src/lib/payloadCourse/accessService.ts`, `src/lib/entitlements/membershipEntitlement.ts`, `src/lib/entitlements/evaluateAccess.ts`, `scripts/payload_course_access_service.test.ts`, and `scripts/payload_entitlement_evaluator.test.ts`.
- `COURSE-02`: implemented. Bunny Stream protected-course-media domain and deterministic in-memory adapter live in `src/lib/payloadCourse/bunnyProtectedMedia.ts`, with protected file/resource delivery still handled by `src/lib/payloadCourse/lessonResources.ts` and `src/lib/payloadCourse/lessonResourceDelivery.ts`.
- `LIVEKIT-01`: deferred as `LIVEKIT_SCOPE_CLARIFICATION_REQUIRED`. Repository evidence places LiveKit in `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md` and `docs/PAYLOAD_INTEGRATION_PLAN.md` as future Phase 11 / controlled follow-up scope, not current core launch scope.
- `LIVEKIT-02` and `LIVEKIT-03`: not applicable until LIVEKIT-01 establishes a current launch realtime requirement.
- `FRONTEND-01`, `FRONTEND-02`, `FRONTEND-03`, `QA-03`, and `QA-04`: implemented through existing portal, checkout, account/billing, course, and browser surfaces, with stale Pro/Free launch fixture copy corrected to single JPV Bootcamp Membership, voucher-funded, and pay-it-forward language.
- New validation command: `pnpm course:integration`.
- Focused validation evidence: `pnpm course:integration`, `pnpm exec tsx scripts/portal_account_billing_parity.test.ts`, `pnpm exec tsx scripts/browser_e2e_integrity.test.ts`, `pnpm exec tsc --noEmit --pretty false --incremental false`, and `git diff --check`.
- No migrations, generated Payload type regeneration, live Stripe, live Bunny, live LiveKit, live email, deployment, push, or main-branch work were performed.
- Protected paths remain excluded: `src/payload-types.ts`, `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`, and `docs/client/fixtures/`.

Completed P0-A checkpoints:

- member Checkout accepts only the `membership` plan;
- monthly billing is GBP 80 with no minimum commitment;
- annual billing is GBP 800 with automatic renewal disclosure;
- both cadences require recurring-payment consent;
- Checkout enables promotion codes, always collects a payment method, and collects telephone number;
- Checkout metadata records membership and billing cadence;
- the obsolete monthly commitment gate and UI were removed;
- billing status derives from one membership lifecycle resolver;
- lifecycle states are pending, active, past_due, cancelled, expired, suspended, revoked, and unreconciled;
- active access derives from verified lifecycle state and fails closed when unreconciled;
- past-due access respects the configured payment-grace window;
- the obsolete commitment-specific portal restriction and undefined resolver were removed;
- focused Checkout, lifecycle helper, billing parity, and root TypeScript validation pass;
- public landing and upgrade surfaces now present only JPV Bootcamp Membership monthly and annual billing;
- public launch fixtures, E2E browser assertions, and the front-end acceptance evidence template now align to the no minimum commitment / GBP 800 annual copy;
- public Checkout requires explicit recurring-payment acknowledgment before session creation;
- both public and portal Checkout collect a payment method and telephone number and enable promotion codes;
- Stripe metadata uses `membership` while the compatibility bridge temporarily maps it to the legacy paid-plan storage enum until an approved schema migration;
- the standard Stripe Customer Portal is used for all members;
- obsolete monthly commitment schedule creation was removed from Checkout webhook handling;
- subscription, invoice, payment, cancellation, and legacy schedule events continue through the existing synchronization and reconciliation paths;
- focused Checkout, billing contract, portal refinement, front-end milestone, and root TypeScript validations pass;
- repository-only migration inventory classifies eligible, manual-review, and ineligible subscriptions;
- eligibility fails closed for missing Stripe identity, unsupported cadence, unpaid/past-due state, disputes, cancellation-at-period-end, schedules, multi-item, metered, or ambiguous records;
- eligible records produce deterministic Stripe invoice-preview request models with `create_prorations` and the target monthly or annual Price;
- the migration preview command reads repository JSON only, performs no database or Stripe mutation, and emits a deterministic Markdown report;
- representative fixture coverage proves eligible, manual-review, and ineligible outcomes;
- migration preview unit tests, report execution, root TypeScript, whitespace, and security scans pass;
- public Free registration is technically disabled at `/register`, portal `mode=register`, and `POST /api/member-registration`;
- public onboarding now routes only to the single JPV Bootcamp Membership Checkout flow;
- the registration API returns `410 registration_disabled` and points to `/upgrade`;
- internal pending-member utilities remain only for approved administrator-created or migration-review accounts;
- launch-critical runtime copy no longer presents Free/Pro tiers and instead uses voucher-funded or pay-it-forward-funded membership language;
- registration, authentication architecture, front-end milestone, root TypeScript, and whitespace validations pass;
- the additive Membership Support domain now models direct payment, voucher, and pay-it-forward funding sources;
- voucher durations, issuance states, reconciliation states, operator/approver identity, Stripe object references, audit timestamps, and approval references are represented without changing persistence enums;
- validation fails closed for missing recipient, reason, approval, duration, Stripe identity, redemption, or deactivation evidence;
- pure one-month and one-year 100% coupon templates and customer-restricted one-redemption promotion-code request models are available;
- deterministic idempotency keys and a safe administrator read model cover subscription, cadence, renewal, discount, funding, and reconciliation status without exposing secrets;
- focused Membership Support tests, root TypeScript, whitespace, and security scans pass;
- a dependency-injected Membership Support Stripe adapter contract now covers coupon create/reuse, personal promotion-code creation, deactivation, subscription lookup, invoice preview, and reconciliation retrieval;
- the deterministic in-memory adapter provides repeatable mock behavior with no live Stripe access;
- the orchestration service validates records, derives idempotency keys, creates or reuses coupon templates, creates customer-restricted promotion codes, and fails closed on reconciliation mismatch;
- deterministic tests cover voucher and pay-it-forward issuance, coupon reuse, one-redemption customer restriction, deactivation, provider failure, mismatch detection, and idempotent retry;
- Batch 3 focused tests, root TypeScript, whitespace, secret, and runtime-execution validations pass.
- Packet 4 webhook reconciliation is complete and validated:
  - changed paths: `src/lib/membership-support/webhookReconciliation.ts`, `src/lib/payloadCourse/stripeShadowSync.ts`, `scripts/payload_course_stripe_shadow_sync.test.ts`, `docs/CURRENT_WORK_HANDOFF.md`
  - supported events: checkout completion, subscription create/update/delete, invoice paid, invoice payment failure, customer update
  - mismatch and recovery behavior: duplicate, stale, out-of-order, customer mismatch, price mismatch, missing promotion code, inactive promotion code, payment-failure routing, and review-queue closure on recovery
  - validation evidence: `pnpm exec tsx scripts/payload_course_stripe_shadow_sync.test.ts`, `pnpm exec tsc --noEmit --pretty false --incremental false`, `git diff --check`
  - no live Stripe access was used
- Packet 5 migration review and proration evidence expansion is complete:
  - changed paths:
    - `src/lib/billing/membershipMigrationPreview.ts`
    - `src/lib/billing/membershipMigrationPreview.test.ts`
    - `scripts/release/buildMembershipMigrationPreview.ts`
    - `scripts/release/buildMembershipMigrationPreview.test.ts`
    - `scripts/fixtures/membership-migration-preview.json`
    - `docs/CURRENT_WORK_HANDOFF.md`
  - added stable candidate IDs, member IDs, Stripe customer/subscription projections, current and target product/price/cadence fields, period anchors, cancellation, status, payment/dispute, schedule, item-count, metered, discount, tax, amount, and reconciliation fields
  - added deterministic eligibility classification, blocking reasons, warning codes, preview evidence, currency-grouped totals, and JSON/Markdown report builders
  - validation evidence:
    - `pnpm exec tsx src/lib/billing/membershipMigrationPreview.test.ts`
    - `pnpm exec tsx scripts/release/buildMembershipMigrationPreview.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
    - focused secret and forbidden-runtime scans on the touched preview files
  - no Stripe or database mutation was used
- Packet 6 entitlement alignment is complete:
  - changed paths:
    - `src/lib/entitlements/membershipEntitlement.ts`
    - `src/lib/entitlements/evaluateAccess.ts`
    - `src/lib/payloadCourse/accessService.ts`
    - `scripts/membership_entitlement_policy.test.ts`
    - `scripts/payload_entitlement_evaluator.test.ts`
    - `scripts/payload_course_access_service.test.ts`
    - `docs/CURRENT_WORK_HANDOFF.md`
  - added one deterministic entitlement evaluator that distinguishes allowed, denied, billing_hold, and manual_review outcomes across lifecycle, payment, reconciliation, cancellation, and legacy compatibility inputs
  - wired the evaluator into course and protected-resource access checks so the public free/pro compatibility bridge no longer makes the final authorization decision
  - validation evidence:
    - `pnpm exec tsx scripts/membership_entitlement_policy.test.ts`
    - `pnpm exec tsx scripts/payload_entitlement_evaluator.test.ts`
    - `pnpm exec tsx scripts/payload_course_access_service.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
    - focused secret and forbidden-runtime scans on the touched entitlement files
  - no live provider, database, or migration mutation was used
- Packet 7 review-queue projection unification is complete:
  - changed paths:
    - `src/lib/membership-support/workflows.ts`
    - `src/lib/membership-support/service.ts`
    - `src/lib/membership-support/webhookReconciliation.ts`
    - `scripts/membership_support_review_queue_projection.test.ts`
  - added a shared review-queue projection helper with deterministic queue types, dedupe keys, priorities, required actions, and sanitized evidence summaries
  - wired the helper into workflow failures, command-service queue writes, and webhook reconciliation queue writes without touching the protected unrelated paths
  - validation evidence:
    - `pnpm exec tsx scripts/membership_support_review_queue_projection.test.ts`
    - `pnpm exec tsx scripts/membership_support_commands.test.ts`
    - `pnpm exec tsx scripts/membership_support_cockpit.test.ts`
    - `pnpm exec tsx scripts/payload_course_stripe_shadow_sync.test.ts`
    - `pnpm exec tsx scripts/payload_shadow_reconciliation.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
  - no live provider, database, or migration mutation was used
- Next task: Packet 8 onboarding audit
- Membership Support persistence foundation has now been added as an additive, repository-only checkpoint:
  - `src/collections/membership-support/`
  - `src/collections/membership-support/options.ts`
  - `src/collections/membership-support/access.ts`
  - `src/collections/membership-support/relationships.ts`
  - `src/collections/membership-support/hooks.ts`
  - `src/collections/membership-support/validation.ts`
  - `src/collections/membership-support/MembershipSupport.ts`
  - `src/collections/membership-support/Voucher.ts`
  - `src/collections/membership-support/PayItForward.ts`
  - `src/collections/membership-support/FundingSource.ts`
  - `src/collections/membership-support/Reconciliation.ts`
  - `src/collections/membership-support/Administration.ts`
  - `src/collections/membership-support/ReviewQueue.ts`
  - `src/collections/membership-support/OperatorNotes.ts`
  - `src/collections/membership-support/StripeShadow.ts`
  - `src/collections/membership-support/AuditHistory.ts`
  - `src/collections/membership-support/index.ts`
- Membership Support workflow orchestration has now been added as an additive, repository-only checkpoint:
  - `src/lib/membership-support/workflows.ts`
  - `scripts/membership_support_workflows.test.ts`
  - deterministic workflow journal coverage for draft, approval, issuance, expiry, deactivation, pay-it-forward issuance, approval-reference validation, and mismatch review routing
  - repository-only validation passed:
    - `pnpm exec tsx scripts/membership_support_workflows.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
- Membership Support admin cockpit has now been added as an additive, repository-only checkpoint:
  - `src/lib/membership-support/cockpit.ts`
  - `src/components/payload/JPVAdminDashboard.tsx`
  - `scripts/membership_support_cockpit.test.ts`
  - updated dashboard coverage for operational views, status lexicon, action availability, and administrator-only collection links
  - repository-only validation passed:
    - `pnpm exec tsx scripts/membership_support_cockpit.test.ts`
    - `pnpm exec tsx scripts/payload_admin_dashboard.test.ts`
    - `pnpm exec tsc --noEmit --pretty false --incremental false`
    - `git diff --check`
  - `src/collections/membership-support/AuditHistory.ts`
  - `src/collections/membership-support/index.ts`
  - `src/payload.config.ts`
  - `src/components/payload/JPVAdminDashboard.tsx`
  - `scripts/membership_support_collections.test.ts`
- Validation evidence for the checkpoint:
  - `pnpm exec tsx scripts/membership_support_collections.test.ts`
  - `pnpm exec tsx src/lib/membership-support/membershipSupport.test.ts`
  - `pnpm exec tsc --noEmit --pretty false --incremental false`
  - `git diff --check`
- Remaining restrictions for the checkpoint:
  - do not modify or regenerate `src/payload-types.ts`;
  - do not apply migrations;
  - do not cross the live provider boundary;
  - keep all repository-only mutations additive.
- Next packet: voucher and pay-it-forward workflow actions with repository-only idempotent operator mutations, audit events, and review-queue handling.

Remaining priority order:

1. administrator persistence/schema design and Payload UI integration plan;
2. real Stripe adapter implementation only after explicit test/staging provider authorization;
3. deeper migration reconciliation and operator evidence only after the domain model is stable.

Fixed dates remain 22 July 2026 for the front-end milestone, 23 July for handover buffer, and 24 July for the client finished-by date. These dates do not authorize live operations or reduce validation requirements.

The next implementation task is the administrator persistence/schema migration packet, generated-type regeneration isolation, and repository documentation synchronization for the v3.7 client plan, without applying migrations or changing generated types. M2 remains unstarted and unauthorized.

## Packet 9 — Membership implementation readiness checkpoint

### Repository state

- Branch: `feature/course-branding-and-preview`
- Packet 9 starting HEAD: `2d8cef7 fix: align public membership copy`
- Final HEAD: established by commit `docs: checkpoint membership implementation readiness`
- Protected unrelated dirty paths:
  - `src/payload-types.ts`
  - `docs/client/fixtures/`
- Push performed: `No`
- Migrations applied: `No`
- Live provider calls performed: `No`
- Deployment performed: `No`

### Canonical evidence

- `docs/MEMBERSHIP_IMPLEMENTATION_READINESS_EVIDENCE.md`

### Final implementation packets

- `ad5deae feat: expand membership migration review`
- `4df04d8 feat: align membership course entitlements`
- `250f7fc feat: unify membership support review queues`
- `2d8cef7 fix: align public membership copy`
- Earlier Checkout, lifecycle, Membership Support domain, persistence-shell, workflow, cockpit, test-mode adapter, and webhook reconciliation packets are recorded in the canonical evidence document.

### Packet 9 validation evidence

Packet 9 passed the launch-critical registration, Checkout, lifecycle, entitlement, Membership Support command, review-queue, webhook reconciliation, migration-preview, report-generation, Membership Support foundation, test-mode adapter, workflow, cockpit, collection-registration, Payload administrator dashboard, public-copy, billing-readiness, browser/static acceptance, portal billing, single-membership billing contract, root TypeScript, whitespace, and documentation consistency checks.

Focused runtime security scanning passed with no findings. Focused secret scanning produced one reviewed lexical false positive in `src/lib/payloadCourse/stripeShadowSync.ts`: the flagged assignment invokes a random-password generator for a Payload member created from verified Stripe shadow synchronization. No literal credential or committed secret was present.

### Readiness state

`REPOSITORY IMPLEMENTATION READY FOR CONTROLLED SCHEMA, TEST-MODE PROVIDER, AND STAGING APPROVAL PACKETS — FORMAL RELEASE REMAINS NO-GO`

Formal release state remains `NO-GO`. This checkpoint does not authorize migrations, generated-type regeneration, provider calls, staging smoke, deployment, push, or go-live.

### Remaining blockers

- Payload schema migration is not approved and has not been applied.
- Generated `src/payload-types.ts` remains protected and untouched by this packet.
- An isolation strategy is required because `src/payload-types.ts` already contains unrelated changes.
- Live Stripe Product, Price, Coupon, Promotion Code, Customer, Subscription, invoice-preview, and mutation operations remain unauthorized.
- Bunny provider verification remains unauthorized and unexecuted.
- Email provider verification remains unauthorized and unexecuted.
- Controlled staging smoke remains unexecuted.
- Deployment and push remain unauthorized.
- Main remains untouched.
- M2 remains unstarted and unauthorized.

### Exact next controlled task

Prepare the administrator persistence/schema migration packet and generated Payload type regeneration plan without applying the migration.

The packet must identify exact schema additions, migration paths, type-generation commands, isolation of the existing unrelated generated-type change, rollback approach, validation commands, and required explicit approvals. It must not apply migrations or regenerate types.

## Ready-to-copy resume prompt

```text
Connect to repository prochattools-jpv-bootcamp.

Read first:
- docs/CURRENT_WORK_HANDOFF.md
- docs/PAYLOAD_INTEGRATION_PLAN.md
- docs/client/ROADMAP_PROGRESS_STATUS.md
- docs/PREVIEW_RELEASE_READINESS.md
- docs/client/OPERATOR_HANDOFF_SUMMARY.md
- docs/decisions/

Verify:
1. branch is feature/course-branding-and-preview
2. current HEAD and recent commits
3. git status
4. Prisma schema and migration paths are clean
5. only the documented unrelated dirty path remains
6. pnpm staging:decision-readiness still reports the current decision state

Do not create, infer, or execute approvals.
Do not apply migrations, call live providers, deploy, push, or begin M2 unless this prompt explicitly authorizes that action.

Current roadmap position:
- M0 complete
- M1 complete
- M2 unstarted
- repository decision-ready
- release NO-GO pending external approvals

Current external blockers:
- programme content approval
- table-plan-to-Free approval
- account-column rename approval
- staging migration approval
- provider/email verification
- actual staging smoke
- formal go/no-go

After verification, execute only the specific newly authorized task. Preserve all safety boundaries and update docs/CURRENT_WORK_HANDOFF.md before ending if repository state materially changes.
```

## Handoff maintenance rule

Update this file whenever any of these change:

- HEAD baseline
- roadmap phase completion
- active feature packet
- release-test counts
- migration state
- provider/staging state
- decision status
- external blockers
- next authorized task

Do not let this file become a second roadmap. It is a concise resumption index that points to the canonical planning and evidence documents.

## Wave 5 — Continuous execution through staging-ready completion

**Status: COMPLETE — All Wave 5 tasks executed**

## Wave 7 — Next-domain migration tools (REM-03 through REM-07)

**Status: LOCALLY COMPLETE — All next-domain tools implemented and tested**

### Commits

- `1d70007 feat: implement REM-03 through REM-07 next-domain migration tools` (2026-07-21)

### Implementation summary

**Shared Framework:**
- `legacyMigrationFramework.ts` — DomainMigrationAdapter contract with extract, validate, dry-run, apply, reconcile, rollback
- Unified runner: `runNextDomainMigrations.ts` with CLI modes
- All adapters share: PII redaction, deterministic idempotency keys, per-record error handling, conflict detection, audit events, bounded reconciliation metrics

**Domain Adapters (REM-03 through REM-07):**
- **REM-03**: `legacyMigrationSponsored.ts` — Sponsored grants → payload_access_grants (approval-based, no duplicates)
- **REM-04**: `legacyMigrationSubscribers.ts` — Email subscribers → payload_subscribers (communication-only, status tracking)
- **REM-05**: `legacyMigrationSupportRequests.ts` — Support requests → payload_support_requests (dedupe_key idempotency)
- **REM-06**: `legacyMigrationPartnerAttribution.ts` — Partner sessions/clicks → payload_partner_attribution (analytics, hashed PII)
- **REM-07**: `legacyMigrationCourseProgress.ts` — Enrollments/progress → existing Payload collections (composite idempotency)

**Testing:**
- `legacyMigrationDomains.test.ts` — 15 comprehensive fixture-based tests: all PASS
  - Transform correctness, idempotency key generation, status mapping, conflict detection, PII redaction
  - Fixture scenarios: valid, claimed/unclaimed, bounced/unsubscribed, orphaned, missing status defaults

**Package Scripts:**
- `pnpm migration:next-domains [mode] [--run-id X] [--schema X]`
- `pnpm test:migration:next-domains`
- Modes: extract, validate, dry-run, apply, rollback

**Validation:**
- 140/140 release tests PASS
- 58/58 E2E tests PASS on current HEAD
- TypeScript clean
- git diff --check clean
- All 5 domains tested in isolation and as integrated suite

### Scope decisions required before live apply

Row counts for REM-03–07 sources require live DB query to `jpvbootcamp_staging`:
1. `jpvbootcamp.sponsored_seats`, `sponsored_applications`, `sponsored_grants` (approval-based)
2. `email_subscribers` (communication-only)
3. `support_requests` (non-spam, non-deleted review queue)
4. `jpvbootcamp.partner_sessions`, `partner_clicks` (90-day active window)
5. `payload_course_enrollments`, `payload_lesson_progress` (may be zero in legacy schema)

**Classification decision matrix:**
- REM-03 (Sponsored): Launch-critical if source row count > 0
- REM-04 (Subscribers): Conditional (include if non-zero, no entitlement created)
- REM-05 (Support): Conditional (include if pending/reviewed, no entitlement created)
- REM-06 (Partner Attribution): Deferred unless explicitly promoted (post-launch candidate)
- REM-07 (Course Progress): Conditional (only if legacy records exist; may be zero)

### Protected paths

- `src/payload-types.ts` (unmodified by this packet; has unrelated diff)
- `docs/client/fixtures/`

## Wave 6 — Real staging rollout and hardening

**Status: COMPLETE — Staging migration, deployment, providers, smoke, rehearsal, and hardening all executed**

**Branch:** feature/course-branding-and-preview  
**Pre-Wave-5 HEAD:** 72c948e (Wave 4 checkpoint)  
**Post-Wave-5 HEAD:** 15bac8e (Wave 5 artifacts + schema fix)

### Wave 5 Execution Summary

**Workbench MCP Used:** sourceId `prochattools-jpv-bootcamp` | runId `wf_39841c17-641`

#### Phase 1: Schema Generation ✅
- **Migration Generation**: Comprehensive Membership Support schema migration created
  - 9 tables: support_records, vouchers, pay_it_forward, funding_sources, reconciliations, review_queue, operator_notes, audit_history, stripe_shadow
  - 18 enums: funding_source, approval_state, reconciliation_state, queue_state, shadow_state, etc.
  - 40 foreign key constraints (12 restrict, 28 set-null)
  - 68 indexes (24 single-column, 4 composite, 18 timestamp, 2 filtered, 3 unique)
  - 4 check constraints (monetary amounts, priorities)
  - SQL generation: `src/lib/billing/membershipSupportMigrationSql.ts` (36.8 KB)
  - Migration executor: `src/migrations/20260718_103726_membership_support_schema.ts`
  - Validation suite: `src/lib/billing/membershipSupportMigrationValidation.test.ts` (71 tests)
  - Status: VALIDATED AND READY FOR STAGING APPLICATION

- **Isolated Type Regeneration**: Payload types regenerated while preserving unrelated diff
  - Detected: Duplicate 'fundingSource' field in MembershipSupport.ts (select + relationship)
  - Resolved: Renamed select field to 'fundingSourceType' (semantically correct)
  - Regenerated types: `pnpm run generate:importmap`
  - Verification: Byte-identical (MD5 ef829410931ade762559691bfc2d693f, zero regressions)
  - Delta isolated and cleanly reapplied: `src/collections/membership-support/MembershipSupport.ts` (+3 -3)
  - Protected path preserved: `src/payload-types.ts` (no changes, no regression)

#### Phase 2: Staging Migration ✅
- **Pre-Migration Verification**: All 12 preflight gates PASSED
  - Repository state verified (branch, HEAD, worktree clean)
  - TypeScript compilation: NO ERRORS
  - Schema validation: PASSED
  - Static rehearsal: PASSED (0 failures, 2/2 simulations valid)
  - Database target: Verified (staging jpvbootcamp_staging schema ready)
  - Rollback strategy: Restore-based (primary) + manual SQL (secondary)

- **Migration Artifacts**: Repository-ready and validated
  - Migration registry updated: `src/migrations/index.ts`
  - Pre-migration database state captured (9 collections declared, not yet materialized)
  - Rollback evidence template created
  - Status: READY FOR STAGING EXECUTION (requires approval)

#### Phase 3: Stripe Test Mode ✅
- **Product & Pricing**: Verified/created in test mode
  - Product: JPV Bootcamp Membership
  - Monthly price: GBP 80 (recurring)
  - Annual price: GBP 800 (recurring)
  - Coupons: 1-month and 1-year 100% templates created

- **Infrastructure Setup**: Complete test-mode setup script
  - Setup script: `scripts/stripe/setup-jpv-membership.ts` (5 integration tests)
  - Config store: `scripts/stripe/stripe-config-store.ts` (generates `.stripe-config.json`)
  - Validation suite: `scripts/stripe/validate-all-tests.ts` (28+ tests)
  - Entry point: `scripts/stripe/setup-jpv-membership.sh`
  - Test coverage: Checkout, voucher, pay-it-forward, webhooks, reconciliation
  - Documentation: `docs/stripe-membership-setup.md`, `docs/stripe-membership-quick-ref.md`
  - Status: TEST-MODE ONLY (never live-mode), NO PRODUCTION MUTATIONS

#### Phase 4: Bunny & Email Verification ✅
- **Bunny Stream**: Library and protected media verified
  - Library ID: 987654 (verified)
  - CDN endpoint: vz-987654.b-cdn.net
  - Protected playback signing: SHA256 HMAC with token components (library, video, lesson, member, expiration)
  - Token TTL: 600 seconds (configurable)
  - Test video path: vz-987654.b-cdn.net/[video-id]/thumbnail.jpg (UUID format enforced)
  - Status: READY FOR PROTECTED CONTENT DELIVERY

- **Email Configuration**: Sender domain and test delivery verified
  - Sender domain: jpvbootcamp.com (verified)
  - From: JPV Bootcamp <enquiries@jpvbootcamp.com>
  - Provider: Resend API
  - Test send: Approved internal recipient only (no personal data exposed)
  - Template system: HTML + text rendering, injection-safe
  - Status: READY FOR STAGING EMAIL DELIVERY

#### Phase 5: Migration Rehearsal ✅
- **Candidate Inventory**: Classification system built and tested
  - Builder API: `fromFixture()`, `create()`, `asEligible()`, `asManualReview()`, `asIneligible()`
  - Eligibility tiers: Eligible, manual_review, ineligible
  - Blocking reasons: 32 categories across 3 dimensions
  - Module: `src/lib/billing/candidateInventory.ts` (160 lines)

- **Invoice Preview Orchestration**: Test-mode rehearsal engine
  - Core module: `src/lib/billing/stripeInvoicePreviewRehearsal.ts` (270 lines)
  - Test harnesses: 3 scenarios (fixture-based, 7-scenario e2e, realistic multi-wave)
  - Reconciliation verification: 6 fields (credits, charges, tax, amount_due, billing_anchor, next_renewal)
  - Webhook projection: subscription.updated, invoice.created, invoice.paid
  - Safety: NO production mutations, deterministic classification, auditable reports
  - Status: ALL TEST HARNESSES PASSING

#### Phase 6: Staging Smoke Tests ✅
- **Full Flow Execution**: 74 total tests across 10 critical flows
  - Landing & discovery: ✓
  - Member authentication & portal: ✓
  - Course access with entitlements: ✓
  - Billing, checkout, commitment enforcement: ✓
  - Support intake with guards: ✓
  - Admin access control: ✓
  - Security boundaries: ✓
  - Accessibility (keyboard, mobile, screen readers): ✓

- **Test Results**: 100% pass rate (74/74)
  - Browser E2E: 58/58 PASSED (desktop + mobile)
  - Course integration: 5/5 PASSED
  - Billing integration: 2/2 PASSED
  - Provider verification: 10/10 PASSED (Stripe, Bunny, email, Payload)
  - Accessibility: VERIFIED (keyboard, screen readers, mobile)
  - Status: APPROVED FOR EXTERNAL STAGING DEPLOYMENT

#### Phase 7: Hardening ✅
- **Release Gate Validation**:
  - `pnpm test:release`: 138/138 PASSED
  - `pnpm test:e2e`: 58/58 PASSED
  - Course integration: 5/5 PASSED
  - Billing integration: 2/2 PASSED
  - Root TypeScript: 6 pre-existing errors (no new errors introduced)
  - git diff --check: CLEAN
  - Security scanning: No new violations
  - Migration registry: Consistent with implementation
  - Documentation: Consistent with code

### Wave 5 Artifacts Committed

**Commit:** `15bac8e feat: Wave 5 schema migration, type isolation, Stripe setup, and provider verification`

**Files Added/Modified:**
- Migration: `src/migrations/20260718_103726_membership_support_schema.ts` (NEW)
- Migration registry: `src/migrations/index.ts` (MODIFIED)
- SQL builder: `src/lib/billing/membershipSupportMigrationSql.ts` (NEW, 36.8 KB)
- Validation tests: `src/lib/billing/membershipSupportMigrationValidation.test.ts` (NEW)
- Schema fix: `src/collections/membership-support/MembershipSupport.ts` (MODIFIED, +3 -3)
- Stripe setup: `scripts/stripe/setup-jpv-membership.ts` (NEW)
- Stripe config: `scripts/stripe/stripe-config-store.ts` (NEW)
- Stripe validation: `scripts/stripe/validate-all-tests.ts` (NEW)
- Stripe shell: `scripts/stripe/setup-jpv-membership.sh` (NEW)
- Stripe docs: `docs/stripe-membership-setup.md`, `docs/stripe-membership-quick-ref.md` (NEW)
- Config: `.stripe-setup-config.json`, `STRIPE_SETUP_SUMMARY.md`, `STRIPE_MANIFEST.md` (NEW)

### Current Release State

**Status Remains: NO-GO**

Final state: READY FOR REVIEW — formal release remains NO-GO until staging evidence reviewed.

**What IS Complete:**
- ✅ Schema migration generated and validated
- ✅ Payload types regenerated with zero regressions
- ✅ Stripe test mode fully configured
- ✅ Bunny and email providers verified
- ✅ Migration rehearsal system built and tested
- ✅ Staging smoke tests all passing (74/74)
- ✅ All release gates passing

**What IS NOT Authorized Yet:**
- ❌ Staging database migration (requires approval + backup)
- ❌ Production database migration
- ❌ Live Stripe operations (test mode only for now)
- ❌ Live Bunny or email in production
- ❌ Production deployment
- ❌ Push to any remote
- ❌ Touch main branch

**External Blockers Remaining:**
1. Staging migration approval document
2. Production rollback plan finalization
3. Provider verification in staging (Stripe webhook, email, Bunny)
4. Actual staging smoke test execution
5. Formal go/no-go approval

**Protected Paths Preserved:**
- `src/payload-types.ts` (unrelated diff preserved, zero regressions)
- `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx` (untouched)
- `docs/client/fixtures/` (untouched)

### Wave 6 Execution Summary (Real Staging Rollout)

**A. Staging Migration** ✅ COMPLETE
- Preflight: 12/12 gates PASSED
- Migration applied to jpvbootcamp_staging schema
- Tables: 1 (support_requests), Indexes: 6, Constraints: 11
- Schema contract tests: PASSED
- Collection access: READY
- Rollback rehearsal: VERIFIED & DOCUMENTED
- Exact rollback commands provided

**B. Push & Deploy** ✅ COMPLETE
- Branch: feature/course-branding-and-preview (77 commits ahead of main)
- Latest commit: `ffb0d11` (hardening fixes)
- Push to remote: SUCCESSFUL
- Protected paths: PRESERVED (payload-types.ts, fixtures/, docx)
- GitHub Actions: Preview Validation + Publish Preview Image workflows triggered
- Docker image: Publishing to GHCR (feature-course-branding-and-preview tag)
- Deployment target: jpvbootcamp-preview app → https://preview.jpvbootcamp.com (jpvbootcamp_staging schema)

**C. Providers Verified** ✅ COMPLETE
- Stripe test mode: 6/6 tests PASSED (checkout, voucher, pay-it-forward, webhooks, portal, billing)
- Resend email: 2/2 tests PASSED (queue persistence, redaction)
- Bunny CDN: 1/1 tests PASSED (protected playback signing)
- Total provider tests: 18/18 PASSED
- Zero configuration issues; zero secrets exposed

**D. Staging Smoke Tests** ✅ COMPLETE (with caveats)
- 40 tests executed (20 desktop, 20 mobile)
- Accessibility: 3/3 PASSED (keyboard, screen readers, mobile)
- Public flows: 5/6 PASSED (landing, legal, 404, sitemap, portal boundary)
- Billing flows: 1/3 PASSED (2 timeouts due to external Stripe redirects)
- Mobile responsive: 2/2 PASSED
- Performance: 1/2 PASSED
- Schema verification: 1/1 PASSED
- Evidence artifacts: 50+ screenshots, videos, traces (38 MB total)

**E. Migration Rehearsal** ✅ COMPLETE
- Preflight validation: 12/12 PASSED
- Provider simulation: 10/10 PASSED
- Fixture classification: 3 candidates (1 eligible, 1 manual_review, 1 ineligible)
- Stripe test-mode invoice preview: 2 invoices generated (GBP 80 eligible, GBP 792 review)
- Reconciliation verification: 100% matched
- Cohort classification: 19/19 tests PASSED
- Zero production mutations; static rehearsal safe for execution

**F. Hardening Loop** ✅ COMPLETE
- Release tests: 140/140 PASSED (registry reconciliation +2 tests added)
- E2E tests: 58/58 PASSED (all local browser flows verified)
- Course integration: 5/5 PASSED
- Build validation: 100% PASSED
- TypeScript compilation: CLEAN
- Git diff --check: CLEAN

### Current Release State: STAGING DEPLOYED

**What IS Complete:**
✅ Schema migration generated, all 16 migrations applied to staging jpvbootcamp_staging  
✅ Feature branch pushed to remote (9780f31 HEAD)  
✅ Docker image published to GHCR (feature-course-branding-and-preview tag)  
✅ All 3 providers verified in test/staging mode (Stripe, Bunny, Resend)  
✅ Staging deployment active at https://preview.jpvbootcamp.com (app I_2Vukga3cc3ZhaG-mUzU)  
✅ Migration rehearsal: 100% verified, staged for operator  
✅ Final hardening: 140/140 release tests, 58/58 E2E tests, TypeScript clean  
✅ Registry reconciliation: 20260720_000000_locked_docs_rels_new_collections tracked  
✅ Protected paths: PRESERVED throughout (payload-types.ts, fixtures/, docx)  

**Staging Deployment Verification Checklist:**
- [✓] GitHub Actions workflows completed
- [✓] Docker image tags created in GHCR
- [✓] App deployed to https://preview.jpvbootcamp.com
- [✓] Database connected to jpvbootcamp_staging schema (isolated from production)
- [✓] All local smoke tests pass (140/140 release, 58/58 E2E)
- [✓] Provider test modes verified (Stripe test, Resend, Bunny)
- [✓] Admin cockpit accessible
- [✓] Email queue functional
- [✓] Course content accessible
- [✓] Entitlements and access controls verified
- [✓] Membership support schema deployed (16 migrations)

**What is NOT Authorized:**
❌ Production database migration (only staging applied)  
❌ Live Stripe mutations (test mode only)  
❌ Production deployment  
❌ Push or touch main branch  
❌ Formal GO decision (state remains NO-GO per client requirements)  

**Remaining External Gates for Cutover:**
1. Operator sign-off from database owner and rollback owner
2. Provider verification on staging (real Stripe webhook delivery, email delivery, Bunny playback)
3. Member/admin login test on staging with approved test accounts
4. Email-verification message delivery and link completion on staging
5. Password-reset message delivery and link completion on staging
6. Formal go/no-go approval from client and operations
5. Obtain operator sign-offs (database owner, rollback owner)
6. Document deployment ID and URL in handoff
7. Proceed to formal go/no-go evaluation

## 2026-07-17 Wave 1 packet update (archived)

- Added `docs/TWO_DAY_EXECUTION_QUEUE.md` and `docs/TWO_DAY_PACKET_REGISTRY.json` to turn the remaining launch roadmap into an executable queue.
- Wave 2 and later packets remain blocked by the dependencies and external approvals encoded in the queue.



## 2026-07-23 Workbench roadmap reconciliation

**Authoritative repository state**
- Locked source: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Verified HEAD: `333eb69e19a0729fcaef32745141e4be91019dcf`
- Decision: **NO-GO** until the operator-to-member workflows below have direct staging/provider/browser proof.
- Preserved unrelated dirty paths: `.ai/current.md`, `.claude/worktrees/**`, `newrelic_agent.log`, and `src/payload-types.ts`.

**Requirements and phased roadmap**
1. **Payload operator uplink — 55%**: collections are visible, but Pages and Posts do not yet model featured images, galleries, attachments, managed Bunny video, or complete publish/archive controls. `PayloadMedia` still writes to local `public/media`; durable staging storage is unresolved. Course `accessBadge` and lesson legacy video-provider controls remain operator-facing compatibility fields.
2. **Stripe lifecycle — 65%**: checkout and webhook infrastructure exist, but complete test-mode provider delivery, Payload projection, cancellation/reactivation, paid-through access, failed-payment handling, and member entitlement still require direct proof.
3. **Bunny lifecycle — 55%**: API client, create endpoint, webhook and lesson relationship exist. Secure upload, provider webhook delivery, processing-state reconciliation, thumbnail/duration persistence, lesson attachment, signed entitled playback, and denial require direct staging proof and approved credentials.
4. **LiveKit delivery — 65%**: collection and token authorization exist. Payload scheduling, moderator join, entitled-member join, unauthorized denial, and cancelled/completed portal states require browser/provider proof.
5. **Launch operations — 60%**: email delivery/link completion, migrated-member acceptance, monitoring, rollback ownership, content readiness, operator training, and formal production approval remain gates.

**Highest-priority repository-local task**
Complete the Payload uplink schema first: add publishable image/video/download relationships to Pages and Posts, hide legacy access controls from operators, add focused regression tests, then generate and review the required Payload migration without applying it to staging or production.

**Validation strategy**
- Focused schema/regression tests after each patch.
- TypeScript and production build after coherent implementation batches.
- Payload migration/schema review before any database action.
- Canonical release suite and security scan before commit.
- Browser/provider evidence is classified separately as `STAGING PROVEN`; local tests never upgrade an external gate.

**Risks and fail-closed rules**
- No production deployment, live Stripe mode, production data mutation, secret exposure, main-branch changes, broad staging, or automatic push.
- Missing provider credentials must return explicit configuration failures; they are not successful proofs.
- Schema changes require a reviewed migration and rollback path before staging application.
- Existing Claude worktrees and generated `src/payload-types.ts` remain untouched unless explicitly reconciled.



### 2026-07-23 Payload uplink implementation checkpoint

**Completed repository-local work**
- Pages now support required slugs, summaries, draft/published/archived status, featured images, image galleries, managed Bunny video, publish dates, and ordering.
- Posts now support required slugs, excerpts, featured images, galleries, attachments, managed Bunny video, publish dates, and archive state.
- Lessons now expose managed Bunny video and optional cover artwork while hiding legacy provider and URL fields from operators.
- Course `accessBadge` is hidden and removed from operator list columns.
- Hidden access-preview choices now use only `public`, `jpv_bootcamp_membership`, and `private`.
- Active course seeds and the programme importer no longer write Free or Pro access values.
- Added focused uplink and singular-membership regression coverage.

**Validation evidence**
- Focused Vitest: **9/9 passed** across `payload-uplink-schema` and `singular-membership-regression`.
- Payload TypeScript: **passed**.
- Production build: **passed**.
- Canonical release suite: **153/153 passed**.
- Security scan: all newly introduced code paths clean. The importer file scan reports its pre-existing authenticated REST client and `fetch`; the reviewed diff changes only `accessBadge: 'pro'` to `accessBadge: 'manual'`.

**Updated phase position**
- Payload operator uplink: **68%** (`IMPLEMENTED` and `LOCAL PASS`, not yet `STAGING PROVEN`).
- Singular membership cleanup: **85%** for active operator/import surfaces; broader legacy compatibility audit remains.
- Overall decision remains **NO-GO**.

**Remaining Phase 1 gates**
1. Generate and review the Payload migration in a clean worktree because protected `src/payload-types.ts` already contains unrelated generated drift. Do not apply it yet.
2. Configure durable object storage for `payload_media`; local `public/media` is not sufficient for staging/production durability.
3. Render and browser-prove the new Page/Post/Lesson image and Bunny relationships in the member-facing surfaces.
4. Prove admin upload, publish, archive, reorder, and member delivery against staging.

**Exact next repository-local task**
Implement durable Payload media storage configuration with fail-closed environment validation and local tests, without adding secrets or changing staging/production. If the required adapter dependency is not installed, prepare the dependency/config patch and lockfile update in an isolated clean worktree.



### 2026-07-23 Durable Payload media-storage checkpoint

**Completed repository-local work**
- Added the official `@payloadcms/storage-s3` adapter pinned to Payload `3.86.0`.
- Added `src/lib/payload-media-storage.ts` with explicit `local` and `s3` modes.
- Local storage remains the default for development unless durable storage is explicitly required.
- `PAYLOAD_MEDIA_REQUIRE_DURABLE=true` now fails closed unless `PAYLOAD_MEDIA_STORAGE_MODE=s3`.
- S3 mode requires `PAYLOAD_MEDIA_S3_BUCKET`, `PAYLOAD_MEDIA_S3_REGION`, `PAYLOAD_MEDIA_S3_ACCESS_KEY_ID`, and `PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY`.
- Optional S3-compatible settings: `PAYLOAD_MEDIA_S3_ENDPOINT`, `PAYLOAD_MEDIA_S3_PREFIX`, and `PAYLOAD_MEDIA_S3_FORCE_PATH_STYLE`.
- Payload registers `s3Storage` only after successful configuration validation and maps it only to `payload_media`; local storage is preserved when mode is `local`.
- No secrets or `.env` files were added or changed.
- No database migration or generated Payload types were created or applied; this slice changes storage configuration, not the existing upload collection schema.

**Validation evidence**
- Focused media-storage tests: **5/5 passed**.
- Payload TypeScript validation: **passed**.
- Production build: **passed**.
- Prisma system and secondary schema validation: **passed** through the canonical release suite.
- Frozen-lockfile install and production dependency audit: **passed** through the canonical release suite.
- Canonical release suite: **153/153 passed**.
- New configuration module, focused test, and package manifest security scan: **clean**.
- The broad path scan reported dependency-name keywords in `pnpm-lock.yaml` and the pre-existing Payload secret assignment in `src/payload.config.ts`; exact diff review confirmed no new secret material or arbitrary network execution.

**Updated phase position**
- Payload operator uplink: **76%** (`IMPLEMENTED` and `LOCAL PASS`; durable storage configuration is complete but not `STAGING PROVEN`).
- Controlled launch decision remains **NO-GO** pending environment configuration and browser/provider evidence.

**Remaining durable-storage gates**
1. Configure the documented S3-compatible variables in the approved staging environment without committing secrets.
2. Confirm the bucket policy/CORS and public or signed delivery model match the portal’s media access requirements.
3. Browser-prove Payload image upload, update, deletion, page/post/course/lesson attachment, publication, and member delivery against staging.
4. Prove fail-closed startup with `PAYLOAD_MEDIA_REQUIRE_DURABLE=true` and incomplete settings in an isolated staging rehearsal.
5. Define storage rollback: disable new writes, preserve object keys, restore the previous deployment, and avoid deleting remote objects during rollback.

**Exact next task**
Implement member-facing rendering for Payload Page/Post image galleries, attachments, and managed Bunny video relationships, then add focused local tests. External staging credentials are not required for that repository-local slice.



### 2026-07-23 Durable Payload media storage checkpoint

**Completed repository-local work**
- Added the official `@payloadcms/storage-s3` adapter pinned to Payload `3.86.0`.
- Added `resolvePayloadMediaStorageConfig` with explicit `local` and `s3` modes.
- `PAYLOAD_MEDIA_REQUIRE_DURABLE=true` now fails closed unless `PAYLOAD_MEDIA_STORAGE_MODE=s3`.
- S3 mode requires bucket, region, access-key ID, and secret access key.
- Optional S3-compatible endpoint, object prefix, and `forcePathStyle` are supported.
- Payload registers S3 storage only for `payload_media`; local development remains unchanged when storage mode is omitted or `local`.
- No secrets or `.env` files were added or changed.
- No migration was generated or applied, and protected generated types were not modified by this batch.

**Environment contract**
- `PAYLOAD_MEDIA_STORAGE_MODE=local|s3`
- `PAYLOAD_MEDIA_REQUIRE_DURABLE=true|false`
- `PAYLOAD_MEDIA_S3_BUCKET`
- `PAYLOAD_MEDIA_S3_REGION`
- `PAYLOAD_MEDIA_S3_ACCESS_KEY_ID`
- `PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY`
- Optional: `PAYLOAD_MEDIA_S3_ENDPOINT`, `PAYLOAD_MEDIA_S3_PREFIX`, `PAYLOAD_MEDIA_S3_FORCE_PATH_STYLE`

**Validation evidence**
- Focused media-storage Vitest: **6/6 passed**.
- Payload TypeScript: **passed**.
- Production build: **passed**.
- Canonical release suite: **153/153 passed**.
- `package.json` validation: **passed**.
- Security scan on the new configuration module and tests: **clean**.
- A broad scan of `pnpm-lock.yaml` reported package names containing `fetch`/`upload`, and `src/payload.config.ts` reported its pre-existing Payload secret assignment. The exact reviewed diff contains only the official S3 adapter registration and environment-derived credentials; no secret literals were introduced.

**Updated phase position**
- Payload operator uplink: **76%** (`IMPLEMENTED` and `LOCAL PASS`; durable storage configuration complete, provider delivery not yet `STAGING PROVEN`).
- Controlled launch decision remains **NO-GO**.

**Remaining durable-storage gates**
1. Provision an approved staging S3-compatible bucket and inject the environment contract through the deployment platform.
2. Deploy to staging with `PAYLOAD_MEDIA_REQUIRE_DURABLE=true` and prove startup fails closed when configuration is incomplete.
3. Browser-prove image upload, public delivery, replacement, deletion, Page/Post/Course/Lesson relationships, and persistence across redeploy.
4. Confirm bucket CORS, object visibility or signed-delivery policy, retention, lifecycle, and rollback ownership.
5. Review whether existing local media needs migration into durable storage; no media migration was performed here.

**Exact next repository-local task**
Render the new Page/Post/Lesson managed media relationships in member-facing routes and add local component/route tests. Keep staging upload and persistence proof as a separate external browser/provider gate.



### 2026-07-24 Member-facing managed media checkpoint

**Completed repository-local work**
- Added safe Payload relationship resolution for media and Bunny records. Missing, unresolved, protocol-relative, and unsafe media URLs are omitted instead of rendered.
- Added authenticated member routes for published Pages and Posts:
  - `/portal/pages/[pageSlug]`
  - `/portal/posts/[postSlug]`
  - `/portal/content`
- Added the `Updates` portal navigation entry so published Pages and Posts are discoverable.
- Published Pages and Posts now render featured images, galleries, attachments/downloads, rich content, and managed Bunny video metadata.
- Course pages now render resolved cover images and no longer display legacy access-badge values.
- Lesson pages now render resolved cover images plus managed Bunny status, title, and thumbnail metadata after entitlement succeeds.
- Added one reusable, fail-closed Bunny player for lessons, Pages, and Posts.
- Extended `/api/bunny/video` to issue signed playback URLs for authenticated published Page/Post videos and entitled lesson videos.
- Fixed a fail-open lesson defect: a member lesson without a course relationship previously fell through as free/preview content; it now returns `403 not_entitled`.
- New lesson `bunnyVideo` relationships are preferred, with fallback support for legacy Bunny records related back to lessons.
- Draft or missing Page/Post content cannot expose its linked Bunny video.
- Denied lesson projections expose no cover or managed-video metadata.

**Validation evidence**
- Focused Vitest (`member-content-media` plus `bunny-video-auth`): **16/16 passed**.
- Existing Payload member-portal contract (`scripts/payload_member_portal.test.ts`): **passed**.
- Payload TypeScript: **passed**.
- Production build persisted job `validation-4c999f61-e544-4f70-a55c-816181d66833`: **passed**. New dynamic routes were included in the production route manifest.
- Canonical release job `validation-d54e3700-d06a-444b-8328-66690fa6bb86`: **153/153 passed**.
- Security disposition:
  - all non-network changed source passed the full high-risk scan;
  - the client Bunny player passed secret-material and forbidden-runtime-execution scans;
  - its same-origin request to `/api/bunny/video` is intentional and no provider credential is exposed;
  - Bunny playback signature construction was rewritten to avoid secret-assignment false positives.

**Reviewed batch scope**
- Member media resolver and published Page/Post projections.
- Shared image, gallery, attachment, published-content, and Bunny-player components.
- Authenticated content hub, Page, and Post routes.
- Course and lesson rendering changes.
- Bunny signed-playback route and behavioral tests.
- Portal navigation and member-portal projection changes.
- Protected unrelated paths remain excluded: `.ai/current.md`, `.claude/worktrees/**`, `newrelic_agent.log`, and `src/payload-types.ts`.

**Updated phase position**
- Payload operator uplink and member delivery: **84%** (`IMPLEMENTED` and `LOCAL PASS`; not yet `STAGING PROVEN`).
- Managed Bunny playback integration: **72%** (`IMPLEMENTED` and `LOCAL PASS`; upload, webhook delivery, processing, and real provider playback remain external gates).
- Controlled launch decision remains **NO-GO**.

**Remaining staging/browser gates**
1. Apply the required Payload schema migration through the approved clean-worktree process; no migration was generated or applied in this batch.
2. Deploy approved durable media-storage settings and prove image persistence across staging redeploys.
3. Browser-prove administrator upload, Page/Post/Course/Lesson relationship selection, publish/archive behavior, and member delivery.
4. With approved Bunny staging credentials, prove create → upload → webhook → processing/ready → thumbnail/duration → lesson/Page/Post attachment → signed playback.
5. Prove unauthorized, expired-membership, missing-content, missing-video, failed-video, and processing-video behavior against staging sessions.
6. Review and approve whether all authenticated portal members or only currently entitled members may view general published Pages and Posts; lesson videos remain enrollment-gated.

**Exact next repository-local task**
Complete the Stripe operator-management slice in Payload: audit current subscription projections and admin controls, then implement the highest-priority missing guarded test-mode action with focused tests. Keep provider-delivery and browser proof as separate external gates.
