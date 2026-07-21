# JPV Bootcamp Operator Execution Packet

**Packet ID:** OPERATOR-READY-2026-07-21  
**Branch:** `feature/course-branding-and-preview`  
**HEAD:** `49adee9fbd63ff7d66e5c9ccf77ba33cb8bf3f41` (2026-07-21 07:42 UTC)  
**State:** NO-GO (formal) → READY FOR APPROVAL SEQUENCE  
**Applicant:** Haiku 4.5 (evidence-driven audit only — no live execution performed)

---

## Executive Summary

**CRITICAL P0 CONFLICT DISCOVERED:**

The ROADMAP_PROGRESS_STATUS documents an **exposed staging credential that is CONFIRMED VALID** (HTTP 200 login success) and mandates operator immediate action to disable/revoke before remediation is complete. **However, no formal decision gate exists for credential remediation**, and it is not listed as a prerequisite to any other gate.

**Next gate:** **CREDENTIAL REMEDIATION VERIFICATION** (new gate zero) must be resolved **before** any migration, provider, or smoke work. This packet establishes the literal gate order from repository evidence and prepares the operator authorization block.

---

## 1. GATE ZERO: CREDENTIAL REMEDIATION VERIFICATION

**Status:** UNVERIFIED — P0 BLOCKING ALL OTHER GATES  
**Owner:** Operator (database or admin UI access required)  
**Reference:** ROADMAP_PROGRESS_STATUS line 29–30; CURRENT_WORK_HANDOFF.md line 38  

### Exact Precondition

```
ROADMAP_PROGRESS_STATUS:
  Security Status: "Exposed credential CONFIRMED VALID (HTTP 200 login); 
                   account disable/revocation PENDING operator immediate action 
                   (no Workbench admin/DB access available)"
  Release State: "FORMAL NO-GO — Exposed staging credential remains active; 
                 operator must disable via admin UI, database, or email reset 
                 before remediation complete"
```

### What Must Be Verified

The operator must **verify AND record** that the exposed staging credential is **no longer valid**:

1. **Login attempt fails** — HTTP 200 → 401/403 or forced redirect
2. **Account disabled** — via admin UI, or database account state set to `disabled`/`revoked`
3. **Password reset sent** — if identity recovery is in scope, or email-reset flow completed

### Evidence to Capture

- **Login attempt result** — timestamp, endpoint, HTTP status code (must be ≠ 200)
- **Account state** — admin UI screenshot or DB query result showing account status
- **Method used** — admin UI disable, database UPDATE, or email reset completion
- **Timestamp** — when remediation was confirmed

### Success Criterion

**Exposed credential no longer grants access.** No login, no bypass, no session acceptance.

### Abort Condition

If HTTP 200 login succeeds after credential remediation is claimed, **STOP ALL FURTHER WORK**. Escalate to security owner.

### Next Gate

→ **Gate 1: Read-Only Staging Preflight** (if remediation verified)

---

## 2. VERIFIED APPLIED/PENDING MIGRATION MATRIX

### A. Payload Migrations (Payload CMS schema — `src/migrations/`)

**Status: 16/16 APPLIED TO STAGING** ✅

| Order | File | Name | Applied | Staging | Notes |
|-------|------|------|---------|---------|-------|
| 1 | 20260620_213328 | Course system init | ✓ | ✓ | Base courses/lessons |
| 2 | 20260621_194424 | Course system phase 1 | ✓ | ✓ | Course runtime |
| 3 | 20260622_093852 | Course private media | ✓ | ✓ | Bunny/lesson resources |
| 4 | 20260627_010700 | Structured community attachments | ✓ | ✓ | Community files |
| 5 | 20260630_100730 | Affiliate reporting | ✓ | ✓ | Partner tracking |
| 6 | 20260630_190000 | Payload preferences constraint | ✓ | ✓ | Preferences FK fix |
| 7 | 20260701_201500 | Member email verification | ✓ | ✓ | Email verified flag |
| 8 | 20260702_001500 | Member account action purposes | ✓ | ✓ | Password reset tokens |
| 9 | 20260703_000000 | Partner affiliate operations | ✓ | ✓ | Partner UI collections |
| 10 | 20260704_090000 | Partner schema reconciliation | ✓ | ✓ | Partner FK cleanup |
| 11 | 20260707_130000 | Remove table-plan enum | ✓ | ✓ | Legacy tier removal |
| 12 | 20260718_103726 | Membership support schema | ✓ | ✓ | Vouchers/pay-it-forward |
| 13 | 20260718_000000 | Live sessions | ✓ | ✓ | Session tracking |
| 14 | 20260718_110000 | Bunny videos | ✓ | ✓ | Protected video catalog |
| 15 | 20260719_150000 | Subscription schema columns | ✓ | ✓ | Stripe sync fields |
| 16 | 20260720_000000 | Locked docs rels collections | ✓ | ✓ | Final schema lock |

**Staging record:** CURRENT_WORK_HANDOFF.md line 15 — "all 16 schema migrations applied"

---

### B. Legacy Member/Billing/Access Migration (Domain 1 only)

**Status: APPLIED TO STAGING, VERIFICATION RECORDED** ✅

| Metric | Value | Evidence |
|--------|-------|----------|
| Source rows | 21 | `customer_provisioning` table, 21 non-null `normalized_email` rows |
| Run 1 | processed=21, errors=0 | `migration_apply_fc8d6f35` |
| Run 2 (idempotency) | processed=21, errors=0 | `migration_apply_b138d38b` — UNCHANGED counts confirm idempotent |
| Payload members (source='migration') | 21 | Inserted, no duplicates |
| Payload billing accounts | 23 | 21 migrated + 2 preexisting (non-migration) |
| Payload subscriptions | 22 | 17 active, 5 canceled |
| Payload access grants | 16 | Only active/trialing subscriptions granted |
| Audit table | Created | `payload_migration_audit` with record and summary events |
| Rollback tested | PASS | Run 1 grants deleted (2→0), preexisting rows unchanged |
| Reapply tested | PASS | Run 3 restored grants (0→2) with zero errors |

**Staging record:** CURRENT_WORK_HANDOFF.md lines 88–114 (live reconciliation with exact run IDs)

---

### C. Prisma Migrations (System Database — `prisma/migrations/`)

**Status: 2 PENDING** ⏳

| Order | File | Name | Status | Owner Decision | Notes |
|-------|------|------|--------|----------------|-------|
| 1 | 20260707_120000 | Rename account identity columns | **PENDING** | TABLE_PLAN_TO_FREE_APPROVAL + ACCOUNT_COLUMN_RENAME_APPROVAL | Renames `wp_*` cols to `account_*` |
| 2 | 20260712_151700 | Add support requests | **PENDING** | STAGING_MIGRATION_APPROVAL (depends on 20260707) | Support intake schema |

**Repository state:** All files exist in `prisma/migrations/` but have not been executed against any database.

**Preconditions for execution:**
- Explicit approval from table-plan and column-rename decision owners
- Backup taken on target database
- Maintenance window agreed
- Runbook commands verified with `pnpm staging:migration-preflight`

---

## 3. LITERAL NEXT GATE ORDER (FROM REPOSITORY EVIDENCE)

### Prerequisite Decision Status (as of 2026-07-21)

| Decision | File | Status | Blocker |
|----------|------|--------|---------|
| **GATE 0: Credential Remediation** | *(new gate zero — not in current docs)* | **UNVERIFIED** | **YES — P0 BLOCKING ALL** |
| TABLE_PLAN_TO_FREE | docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md | NOT_APPROVED | YES — required for column rename |
| ACCOUNT_COLUMN_RENAME | docs/decisions/ACCOUNT_COLUMN_RENAME_APPROVAL.md | NOT_APPROVED | YES — required for support requests |
| ROLLBACK_READINESS | docs/decisions/ROLLBACK_READINESS_APPROVAL.md | NOT_APPROVED | YES — required for REM-08/09 |
| STAGING_MIGRATION | docs/decisions/STAGING_MIGRATION_APPROVAL.md | NOT_APPROVED | YES — gates REM-08/09 execution |
| PROVIDER_VERIFICATION | docs/decisions/PROVIDER_VERIFICATION_APPROVAL.md | UNEXECUTED | YES — gates REM-10 |
| STAGING_SMOKE | docs/decisions/STAGING_SMOKE_APPROVAL.md | UNEXECUTED | YES — gates REM-11 |
| CORE_GO_LIVE | docs/decisions/CORE_GO_LIVE_DECISION.md | NOT_APPROVED | YES — gates REM-12 |

### Canonical Gate Sequence (Newly Established)

1. **GATE-0: Credential Remediation Verification** (NEW — P0 blocker)
2. **GATE-1: Read-Only Staging Preflight Queries** (verification only)
3. **GATE-2: Decision Owner Approvals** (table-plan, column-rename, rollback-readiness)
4. **GATE-3: Backup & Maintenance Window Confirmation**
5. **GATE-4: REM-08 Legacy Member/Billing/Access Migration Rehearsal Confirmation** (if anything remains)
6. **GATE-5: REM-09 Prisma Schema Migrations Authorization** (support requests)
7. **GATE-6: Invitation/Reset Cohort (REM-01) Execution**
8. **GATE-7: Scope Decision for REM-03–REM-07** (sponsored grants, subscribers, support, attribution, progress)
9. **GATE-8: REM-10 Provider Verification (Stripe, email, Bunny)**
10. **GATE-9: REM-11 Staging Browser Smoke**
11. **GATE-10: REM-12 Formal Go/No-Go Review**

---

## 4. DETAILED OPERATOR SEQUENCE WITH EXACT COMMANDS

### GATE-0: Credential Remediation Verification

**Owner:** Operator (admin UI or database access)  
**Prerequisite:** None  
**Approval required:** None (verification only)

**Action:**

```
1. Access admin UI at staging deployment OR database with appropriate privileges
2. Locate the exposed staging test account (credentials not reproduced here)
3. Verify current state: attempts to log in must fail (HTTP ≠ 200)
4. If still valid:
   - Disable account via admin UI, OR
   - Update database: UPDATE payload_members SET ... WHERE ... SET disabled=true, OR
   - Send password reset and force change
5. Record evidence:
   - Timestamp of remediation attempt
   - Login result (HTTP 401/403 or redirect)
   - Account state after remediation
```

**Success criterion:** Login attempt fails with HTTP 401, 403, or forced redirect.

**Evidence to capture:**
- Screenshot of admin UI showing account disabled, OR
- DB query result showing account state changed, OR
- Email reset completion timestamp

**Next gate:** GATE-1 (if remediation verified)

---

### GATE-1: Read-Only Staging Preflight Queries

**Owner:** Operator (read-only database access)  
**Prerequisite:** GATE-0 remediation verified  
**Approval required:** None (verification only)  
**Command:**

```bash
cd /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp
pnpm staging:migration-preflight 2>&1 | tee ./GATE_1_PREFLIGHT_RESULT.txt
```

**Expected output:** All checks PASS (no mutations, read-only queries only)

**Evidence to capture:**
- Full `pnpm staging:migration-preflight` output to file
- Row counts from each domain (payload_members, billing_accounts, subscriptions, access_grants, etc.)

**Abort conditions:**
- Any preflight check fails
- Row counts unexpected or migration already applied

**Next gate:** GATE-2

---

### GATE-2: Decision Owner Approvals

**Owner:** Release operator (document approvals)  
**Prerequisite:** GATE-1 preflight passed  
**Approval required:** YES — from three decision owners  

**Required approvals:**

1. **TABLE_PLAN_TO_FREE_APPROVAL**
   - File: `docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md`
   - Owner: Client product/database
   - Approval text: "Legacy `table_plan` enum values approved to map to Free access tier"

2. **ACCOUNT_COLUMN_RENAME_APPROVAL**
   - File: `docs/decisions/ACCOUNT_COLUMN_RENAME_APPROVAL.md`
   - Owner: Database owner + client
   - Approval text: "Approved to rename `wp_account_id` to `account_id`, `wp_account_email` to `account_email`, and indexes"

3. **ROLLBACK_READINESS_APPROVAL**
   - File: `docs/decisions/ROLLBACK_READINESS_APPROVAL.md`
   - Owner: Rollback owner + database
   - Approval text: "Rollback strategy approved: restore from backup [REF], manual SQL remediation available"

**Evidence to capture:**
- Signed decision record (email, Slack, or commit signature)
- Approval timestamp for each decision
- Backup reference if applicable

**Next gate:** GATE-3

---

### GATE-3: Backup & Maintenance Window Confirmation

**Owner:** Database owner + operator  
**Prerequisite:** GATE-2 approvals recorded  
**Approval required:** YES — from database owner

**Action:**

```
1. Confirm backup/snapshot taken on target database (jpvbootcamp_staging)
2. Confirm backup reference/ID recorded in decision docs
3. Confirm maintenance window duration (usually 1-2 hours minimum)
4. Confirm maintenance window has been communicated
5. Confirm rollback owner is on-call during window
```

**Evidence to capture:**
- Backup ID and timestamp
- Maintenance window time window (start/end UTC)
- Rollback owner name and contact

**Success criterion:** Backup verified to exist and be valid for restore.

**Next gate:** GATE-4

---

### GATE-4: REM-08 Legacy Member/Billing/Access Migration Rehearsal Confirmation

**Owner:** Migration operator  
**Prerequisite:** GATE-3 backup confirmed  
**Approval required:** None (repository-owned rehearsal only)

**Command:**

```bash
cd /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp
pnpm staging:migration-rehearsal 2>&1 | tee ./GATE_4_REHEARSAL_RESULT.txt
pnpm staging:migration-rehearsal:evidence 2>&1 | tee ./GATE_4_REHEARSAL_EVIDENCE.txt
```

**Expected output:**
- `migration-rehearsal`: Static mode validation passes (no database mutation)
- `migration-rehearsal:evidence`: Markdown report generated

**Evidence to capture:**
- Full rehearsal output
- Generated evidence markdown report

**Interpretation:**
- If staging legacy migration is already applied (per GATE-1 row counts), REM-08 is complete; record in handoff that "REM-08 staging apply already verified on 2026-07-20; idempotency confirmed across runs 1–2"
- If not yet applied in staging: use GATE-4 rehearsal output to guide the operator through applying the legacy migration

**Next gate:** GATE-5

---

### GATE-5: REM-09 Prisma Schema Migrations Authorization

**Owner:** Database owner + operator  
**Prerequisite:** GATE-4 rehearsal confirmed  
**Approval required:** YES — explicit authorization to apply Prisma migrations

**Exact migration sequence:**

```bash
# Pre-apply validation
cd /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp

echo "=== MIGRATION 1: Rename account columns ==="
./node_modules/.bin/prisma migrate deploy --schema=prisma/system.prisma 2>&1

echo "=== Post-apply validation ==="
./node_modules/.bin/prisma validate --schema=prisma/system.prisma
./node_modules/.bin/prisma validate --schema=prisma/schema.prisma
```

**Required evidence before execution:**
- Backup reference from GATE-3
- Approval recorded in decision docs
- Target database confirmed

**Evidence to capture:**
- Exact timestamp of `prisma migrate deploy` execution
- Full output (including any warnings or schema drift detected)
- Post-apply schema validation result (must PASS)

**Success criterion:**
- Migration applied without errors
- `support_requests` table created with all required indexes
- Schema validation passes

**Abort conditions:**
- Schema validation fails
- Foreign key constraints violated
- Unexpected schema drift detected

**Next gate:** GATE-6

---

### GATE-6: REM-01 Invitation/Reset Cohort Execution

**Owner:** Operator (email provider access required)  
**Prerequisite:** GATE-5 migrations applied  
**Approval required:** None (repository-owned workflow)

**Action:**

```
For all 21 migrated members in payload_members where source='migration':
1. Trigger password-reset or invitation email workflow
2. Record number of emails sent
3. Record timestamp of batch send
4. Verify at least one email delivered successfully
5. Verify reset link is valid and accepts new password
```

**Evidence to capture:**
- Timestamp of invitation batch send
- Number of emails sent (must be 21)
- Screenshot or log of at least one successful email delivery
- Evidence of password reset completion for at least one test account

**Success criterion:** All 21 migrated members have received password-reset/invitation email; at least one full login + portal acceptance verified.

**Next gate:** GATE-7

---

### GATE-7: Scope Decision for REM-03–REM-07 (Next Domains)

**Owner:** Project owner + operator  
**Prerequisite:** GATE-6 REM-01 complete  
**Approval required:** YES — classification decision required

**Decision point:**

For each of five next domains, query staging database and classify:

```sql
-- DOMAIN 1: Sponsored grants/seats
SELECT COUNT(*) FROM jpvbootcamp.sponsored_seats WHERE status IN ('approved', 'pending')
SELECT COUNT(*) FROM jpvbootcamp.sponsored_applications WHERE status = 'approved'
SELECT COUNT(*) FROM jpvbootcamp.sponsored_grants WHERE status NOT IN ('revoked', 'expired')

-- DOMAIN 2: Email subscribers
SELECT COUNT(*) FROM email_subscribers WHERE unsubscribed_at IS NULL

-- DOMAIN 3: Support requests
SELECT COUNT(*) FROM support_requests WHERE review_status IN ('pending', 'reviewed')

-- DOMAIN 4: Partner attribution
SELECT COUNT(*) FROM jpvbootcamp.partner_sessions WHERE expires_at > NOW()
SELECT COUNT(*) FROM jpvbootcamp.partner_clicks

-- DOMAIN 5: Course enrollments/progress
SELECT COUNT(*) FROM payload_course_enrollments
SELECT COUNT(*) FROM payload_lesson_progress
```

**Classification for each domain:**
- **Launch-critical:** Include in this cutover (non-zero rows required to proceed)
- **Conditional:** Include if non-zero; skip if zero
- **Deferred:** Post-launch; do not include

**Decision record:** Update `docs/decisions/NEXT_DOMAIN_INVENTORY_DECISION.md` with counts and classification

**Evidence to capture:**
- SQL query results with row counts
- Classification decision document
- Approval signature

**Next gate:** GATE-8

---

### GATE-8: REM-10 Provider Verification (Stripe, Email, Bunny)

**Owner:** Operator (provider credentials required)  
**Prerequisite:** GATE-7 domain scope decided  
**Approval required:** YES — provider verification approval

**Commands (repository-owned simulation first):**

```bash
cd /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp

echo "=== Provider simulation (repository-owned mocks) ==="
pnpm staging:provider-simulation 2>&1 | tee ./GATE_8_PROVIDER_SIM.txt
```

**Real provider verification (live execution required):**

Follow `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md` for:

1. **Stripe test verification:**
   - Checkout flow with test card
   - Webhook delivery confirmation (real Stripe webhook to staging)
   - Subscription state synchronized

2. **Email verification:**
   - Password reset email sent and delivered
   - Link valid and accepts new password
   - Email header/footer branding correct

3. **Bunny CDN verification:**
   - Protected video URL generated
   - Token signature valid
   - Playback works (HTTP 200, video served)

**Evidence to capture:**
- Timestamp of each provider test
- Pass/fail for each area (Stripe, email, Bunny)
- Screenshots or logs (no credentials)
- Any failures and recovery actions taken

**Success criterion:** All three providers (Stripe, email, Bunny) verified to work on staging with approved test accounts.

**Next gate:** GATE-9

---

### GATE-9: REM-11 Staging Browser Smoke

**Owner:** Operator (browser access to staging URL)  
**Prerequisite:** GATE-8 providers verified  
**Approval required:** YES — staging smoke approval

**Commands (repository-owned plan first):**

```bash
cd /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp

echo "=== Smoke test plan (repository-owned) ==="
pnpm staging:smoke-plan 2>&1 | tee ./GATE_9_SMOKE_PLAN.txt

echo "=== Simulated local smoke (repository-owned) ==="
pnpm staging:smoke-simulated 2>&1 | tee ./GATE_9_SMOKE_SIM.txt
```

**Real staging smoke (live execution required):**

Follow `docs/client/STAGING_SMOKE_CHECKLIST.md` for:

1. **Public flows:**
   - Landing page accessible
   - Legal pages (/terms, /privacy) present and correct
   - Sitemap valid

2. **Member flows:**
   - Sign in works (with test account from REM-01)
   - Portal home page loads
   - Billing page shows subscription state
   - Course enrollment and lesson access work
   - Support intake form submits

3. **Admin flows:**
   - Admin login works (with admin credentials)
   - Dashboard loads without errors
   - All navigation links present
   - Member/billing/course admin panels functional

4. **Provider flows:**
   - Checkout initiates Stripe session
   - Email notifications send (verify in mailbox)
   - Protected video play works (Bunny CDN tokens valid)

**Evidence to capture:**
- Screenshots of each major flow
- Video recordings (if available)
- Network requests (no PII)
- Timestamps of testing
- Any errors and resolution steps

**Success criterion:** All 10 critical flows (public, member, admin, provider) pass with approved test accounts. No unresolved P0 blockers.

**Next gate:** GATE-10

---

### GATE-10: REM-12 Formal Go/No-Go Review

**Owner:** Client + release operator + production owner  
**Prerequisite:** All GATE-0 through GATE-9 complete with evidence  
**Approval required:** YES — explicit GO or CONDITIONAL GO decision

**Required evidence summary (all gates must be recorded):**

- ✓ Credential remediation verified (GATE-0)
- ✓ Preflight queries passed (GATE-1)
- ✓ Decision approvals recorded (GATE-2)
- ✓ Backup confirmed (GATE-3)
- ✓ Migration rehearsal passed (GATE-4)
- ✓ Schema migrations applied (GATE-5)
- ✓ 21 invitations sent, at least one login verified (GATE-6)
- ✓ Next-domain scope classified (GATE-7)
- ✓ Providers verified (Stripe, email, Bunny) (GATE-8)
- ✓ Staging browser smoke passed (GATE-9)

**Update:** `docs/release/GO_NO_GO_CHECKLIST.md`

```
Identity:
- Branch: feature/course-branding-and-preview
- Commit: [exact HEAD]
- Release candidate label: JPV-2026-07-21
- Date: 2026-07-21 [time]
- Operator: [name]
- Approvers: [names + roles]
- Rollback owner: [name]

Decision:
- GO / CONDITIONAL GO / NO-GO: [decision]
- Reason: [evidence summary]
- Blockers resolved: [list any P0 items]
```

**Go/No-Go decision criteria:**

- **GO:** All gates passed, zero unresolved P0 blockers, all three providers verified, staging smoke complete, client approval recorded.
- **CONDITIONAL GO:** One or more gates passed with caveats (e.g., "conditional on REM-03 sponsor grants being zero").
- **NO-GO:** Any P0 blocker unresolved, provider verification failed, critical smoke test failed, or client approval not given.

**Evidence to capture:**
- Signed approval (email, Slack, GitHub, or commit signature)
- Approval timestamp
- Final blocker list (should be empty for GO decision)
- Monitoring readiness confirmed

---

## 5. AUTHORIZATION BLOCK (Copy/Paste for Operator)

**The operator should provide the exact following approval text before proceeding to each gate:**

---

### AUTHORIZATION 1: Credential Remediation Verification

```
AUTHORIZATION: Credential Remediation Verification (GATE-0)

I confirm that I have verified the exposed staging credential no longer grants access:
- Login attempt result: [HTTP status code — must be ≠ 200]
- Account state after remediation: [disabled/revoked/reset]
- Method used: [admin UI / database / email reset]
- Timestamp: [UTC date/time]
- Evidence recorded: [yes/no — must be yes]

Approved by: [name] [date/time]
```

---

### AUTHORIZATION 2: Decision Approvals

```
AUTHORIZATION: Table-Plan-to-Free & Account-Column Rename (GATE-2)

I approve the following decisions:

1. TABLE_PLAN_TO_FREE:
   Decision ID: table-plan-to-free
   Approval: Legacy table_plan enum values approved to map to Free access tier
   Approved by: [name] [date/time]

2. ACCOUNT_COLUMN_RENAME:
   Decision ID: account-column-rename
   Approval: Approved to rename wp_account_id → account_id, wp_account_email → account_email
   Approved by: [name] [date/time]

3. ROLLBACK_READINESS:
   Decision ID: rollback-readiness
   Backup reference: [backup ID / snapshot name]
   Rollback strategy: restore from backup [REF]
   Rollback owner confirmed: [name]
   Approved by: [name] [date/time]
```

---

### AUTHORIZATION 3: Backup & Maintenance Window

```
AUTHORIZATION: Backup & Maintenance Window (GATE-3)

I confirm the following for the staging migration window:

Backup details:
- Backup ID: [reference]
- Timestamp: [UTC date/time]
- Verified valid for restore: [yes/no — must be yes]

Maintenance window:
- Start: [UTC date/time]
- End: [UTC date/time]
- Window duration: [e.g., 2 hours]
- Maintenance communication sent: [yes/no — must be yes]

Rollback owner:
- Name: [name]
- Contact: [email/phone]
- Available during window: [yes/no — must be yes]

Approved by: [database owner name] [date/time]
```

---

### AUTHORIZATION 4: Prisma Schema Migrations

```
AUTHORIZATION: Apply Prisma Schema Migrations (GATE-5)

I approve the application of Prisma migrations to [target database]:
- Database: jpvbootcamp_staging
- Migration 1: 20260707_120000_rename_account_identity_columns
- Migration 2: 20260712_151700_add_support_requests

Pre-apply validation passed:
- pnpm staging:migration-preflight: [PASS/FAIL]
- Both Prisma schema validations: [PASS/FAIL]
- Backup confirmed: [yes/no]

Post-apply validation required:
- pnpm validate --schema=prisma/system.prisma: [must be PASS]
- pnpm validate --schema=prisma/schema.prisma: [must be PASS]

Approved by: [database owner name] [date/time]
```

---

### AUTHORIZATION 5: Provider Verification

```
AUTHORIZATION: Provider Verification Complete (GATE-8)

I confirm the following providers are verified working on staging:

Stripe:
- Checkout flow tested: [yes/no]
- Webhook delivery confirmed: [yes/no]
- Subscription state synchronized: [yes/no]
- Result: [PASS/FAIL]
- Timestamp: [UTC date/time]

Email:
- Password reset email sent and delivered: [yes/no]
- Link valid and accepts new password: [yes/no]
- Branding correct: [yes/no]
- Result: [PASS/FAIL]
- Timestamp: [UTC date/time]

Bunny CDN:
- Protected video URL generated: [yes/no]
- Token signature valid: [yes/no]
- Playback works (HTTP 200): [yes/no]
- Result: [PASS/FAIL]
- Timestamp: [UTC date/time]

Provider verification approval: [yes/no — must be yes]
Approved by: [operator name] [date/time]
```

---

### AUTHORIZATION 6: Staging Browser Smoke

```
AUTHORIZATION: Staging Browser Smoke Complete (GATE-9)

I confirm the following flows passed on staging at [URL]:

Public flows: [PASS/FAIL]
- Landing page: [yes/no]
- Legal pages: [yes/no]
- Sitemap: [yes/no]

Member flows: [PASS/FAIL]
- Sign in with test account: [yes/no]
- Portal home: [yes/no]
- Billing page: [yes/no]
- Course/lesson access: [yes/no]
- Support intake: [yes/no]

Admin flows: [PASS/FAIL]
- Admin login: [yes/no]
- Dashboard: [yes/no]
- Member/billing/course panels: [yes/no]

Provider flows: [PASS/FAIL]
- Stripe checkout: [yes/no]
- Email notifications: [yes/no]
- Bunny video playback: [yes/no]

Unresolved P0 blockers: [none / list any]
Smoke approval: [yes/no — must be yes]
Approved by: [operator name] [date/time]
```

---

### AUTHORIZATION 7: Formal Go/No-Go

```
AUTHORIZATION: Formal Go/No-Go Review (GATE-10)

I have reviewed all gate evidence and make the following decision:

Evidence summary:
- All 10 gates (GATE-0 through GATE-9) complete: [yes/no — must be yes]
- Credential remediation verified: [yes/no]
- Migrations applied: [yes/no]
- Providers verified: [yes/no]
- Staging smoke passed: [yes/no]
- All P0 blockers resolved: [yes/no]
- Client approval recorded: [yes/no]

Decision:
- GO: [yes/no]
- CONDITIONAL GO: [yes/no — if yes, list conditions]
- NO-GO: [yes/no — if yes, list blockers]

Monitoring readiness confirmed: [yes/no]
Production rollback plan accepted: [yes/no]

Approved by: [client representative] [date/time]
Approved by: [database owner] [date/time]
Approved by: [production owner] [date/time]
```

---

## 6. PRESERVED DIRTY FILES (DO NOT MODIFY)

The following unrelated dirty files are preserved and must not be staged/committed:

```
 M .ai/current.md                    — session handoff (expected, will be overwritten)
 D playwright-report-staging/**      — test artifacts (expected, deletions OK)
 M src/payload-types.ts              — PROTECTED: unrelated schema changes, type regen isolation required
 ?? .ai/SESSION_*.md                 — session reports (expected, artifacts only)
 ?? .migration-rehearsal-checkpoints/ — local rehearsal state (safe to preserve)
```

**Critical:** Do NOT regenerate `src/payload-types.ts` or apply any unrelated schema changes as part of this operator packet work.

---

## 7. FINAL FORMAL STATE

**Repository state:** `NO-GO` (formal) → Ready for approval sequence  
**Branch:** `feature/course-branding-and-preview` (unchanged)  
**HEAD:** `49adee9` (unchanged from goal start)  
**Changes made by this packet:** Documentation only (no code/migration mutations)  
**Dirty state:** Preserved (no reset, no stash, no clean)  
**Commit status:** No commit performed (documentation-only audit)

---

## 8. COMPLETION CRITERIA FOR THIS PACKET

This operator execution packet is **internally consistent and executable** when:

1. ✓ Credential remediation gate is established as GATE-0 (blocking all others)
2. ✓ 16 Payload migrations verified as applied to staging (per ROADMAP evidence)
3. ✓ 2 Prisma migrations identified as pending with exact runbook commands
4. ✓ 10 sequential gates defined with exact commands, prerequisites, and approvals
5. ✓ Exact authorization text provided for operator copy/paste (7 blocks, one per gate)
6. ✓ No mutations performed (repository-owned audit only)
7. ✓ Dirty files preserved (no reset/stash/clean)
8. ✓ Formal state documented (NO-GO, ready for approvals)
9. ✓ Branch/HEAD unchanged from goal start
10. ✓ Next gate stated: **GATE-0 Credential Remediation Verification**

---

## 9. NEXT IMMEDIATE ACTION FOR OPERATOR

**The operator should now:**

1. Read this entire packet (you are here).
2. Review the **AUTHORIZATION 1: Credential Remediation Verification** block above.
3. Access the staging environment (admin UI or database).
4. Verify the exposed credential no longer works (HTTP ≠ 200).
5. Provide the signed **AUTHORIZATION 1** text.
6. Only after that: proceed to GATE-1 and beyond.

**Do NOT proceed past GATE-0 without credential remediation verified and documented.**

---

**Packet generated:** 2026-07-21 with Haiku 4.5  
**Evidence source:** Repository at HEAD `49adee9`  
**Validation:** git diff --check CLEAN, no code changes, documentation-only audit  
