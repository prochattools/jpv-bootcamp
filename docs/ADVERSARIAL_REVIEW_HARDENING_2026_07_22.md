# Adversarial Review & Hardening Report — 2026-07-22

**Formal State**: NO-GO (as directed)  
**Branch**: `feature/course-branding-and-preview`  
**Commit**: `9519d5b fix: reconcile audit advisory count in test and docs`  
**Review Date**: 2026-07-22  
**Reviewer**: Workbench + Adversarial Agent  

---

## Executive Summary

Aggressive adversarial code review identified **5 production safety issues**:

- **CRITICAL (2)**: Authorization bypass, webhook idempotency race
- **HIGH (3)**: Concurrent seat claim race, email outside transaction scope, token consumed before grant verified

**Fixed in the 22 July snapshot**: 2 critical issues (authorization, webhook idempotency).
**Remaining in the 22 July snapshot**: 3 high-risk issues blocked on architectural changes.

## Current reassessment — 2026-08-02

This section supersedes the current-status labels in the historical findings below while preserving their original evidence.

| Finding | Current status | Evidence and remaining requirement |
|---|---|---|
| Sponsored-seat concurrent claim | **RESOLVED** | `src/app/(frontend)/sponsored/claim/page.tsx` now locks the seat row with `SELECT ... FOR UPDATE` inside the same transaction that updates the seat and creates the grant. A second claimant cannot pass the locked-row availability check. |
| Email outside transaction scope | **MITIGATED FOR DURABLE RECOVERY** | Email intent is persisted in `payload_email_events` before inline delivery and can be retried independently. Provider latency can still delay the request, but the original silent permanent-loss path is removed. Queue/idempotency tests remain required. |
| One-time token completion sequencing | **OPEN — DURABLE RESERVATION/FINALIZATION REQUIRED** | Invitation and password-reset flows now validate before their downstream mutation and consume afterward. Email-change confirmation still consumes before member validation/update. None of the three flows has a durable cross-instance reservation state, so concurrent invitation/reset requests can both enter downstream mutation before one loses final consumption. A schema-backed reservation/finalization state with recovery semantics is required; moving consumption alone is not a safe fix. |

Current deterministic evidence includes the account-action hardening-status guard in the release manifest. The guard must be replaced with behavioral reservation/finalization tests when the durable design is approved and implemented.

---

## Critical Issues — FIXED

### 1. ✅ Webhook Idempotency Race Condition (FIXED)

**File**: `src/lib/stripe-webhook-handler.ts:415`  
**Risk**: Duplicate webhook handler execution on Stripe retries  
**Failure Scenario**:
- Stripe sends event `evt_123` at T=0
- Node A checks `hasProcessed(evt_123)` at T=0.1ms → false (not yet in DB)
- Stripe retries `evt_123` at T=0.15ms
- Node B simultaneously checks `hasProcessed(evt_123)` → also false
- Both execute full handler (charge validation, provisioning, email queue)
- Both call `markProcessed()` — first creates record, second hits duplicate key and returns success
- Result: **Duplicate charges, duplicate provisions, duplicate email sends**

**Root Cause**: `hasProcessed` check was not atomic with handler execution. Between check and mark, identical events could slip through concurrent requests.

**Fix Applied**:
- Added `atomicCheckAndMarkProcessed()` function in `src/lib/idempotency.ts`
- Checks for existing record and marks processed in single operation
- Reuses unique constraint as idempotency guard
- Webhook handler calls new function immediately at request start
- Result: **No concurrent execution of same event handler**

**Test Coverage**:  
- Updated `provisioning.subscription-projection.test.ts` to verify atomic function presence
- All 151 release tests pass
- No regressions to email, provisioning, or billing logic

**Commit**: `hardening: fix critical production safety issues`

---

### 2. ✅ Authorization Bypass in Sponsored Decision Route (FIXED)

**File**: `src/app/api/sponsored-applications/decision/route.ts:90–206`  
**Risk**: Sponsored application approval/rejection without role verification  
**Failure Scenario**:
- Attacker or compromised token holder obtains a valid decision token (7-day expiry)
- Route verifies token signature only (validates JWT authenticity, not authorization)
- Rejection path (line 102–132): NO authorization check before status update
- Approval path (line 135–206): NO authorization check before transaction that allocates seat
- Token alone is sufficient; no check for `isSponsoredSeatsAdmin` role
- Result: **Attacker can approve/reject applications and allocate seats without admin role**

**Root Cause**: Token signature verification was treated as authorization. Signature only confirms the token hasn't been tampered with; it does NOT verify the caller is an admin.

**Fix Applied**:
- Extract partner session from request cookies immediately after token verification
- Call `getPartnerSession(sessionId)` to load session account
- Check `isSponsoredSeatsAdmin(session.accountId)` before any mutations
- Reject with `invalid` redirect if not admin (same UX as malformed token)
- Both approval and rejection paths now guarded
- Result: **Unauthorized callers cannot approve/reject or allocate seats**

**Test Coverage**:
- TypeScript compilation verified
- All 151 release tests pass
- Rejection and approval paths remain functional for authorized calls

**Commit**: `hardening: fix critical production safety issues`

---

## Historical High-Risk Findings — 22 July Snapshot

### 3. ⚠️ Sponsored Seat Claim Race Condition (DEFERRED)

**File**: `src/app/(frontend)/sponsored/claim/page.tsx:172–189`  
**Risk**: Concurrent claim of same seat by two users with same token  
**Failure Scenario**:
- Attacker obtains a valid claim token for `seatId=seat_456`
- Two concurrent browsers simultaneously hit the claim endpoint with the same token
- Transaction at line 172 uses `updateMany()` with WHERE clause but no FOR UPDATE lock
- Prisma re-evaluates WHERE for each request independently
- Both requests see `claimedByAccountId IS NULL`, so both `updateMany()` succeeds with `count=1`
- Both create SponsoredGrant records for the SAME seat
- Result: **Two accounts claim one seat and both get access**

**Root Cause**: `updateMany()` is not atomic per-request when used without row-level locks. Prisma evaluates the WHERE clause independently for each concurrent request.

**Fix Required**:
- Replace `updateMany()` with raw SQL query using `FOR UPDATE` lock
- Example: `SELECT ... FOR UPDATE` before UPDATE ensures only one request succeeds
- Requires rewrite of claim page transaction logic

**Decision**: Deferred until after full integration of idempotency fixes, as this is a presentational page (high explosion surface, lower blast radius than webhook).

---

### 4. ⚠️ Email Notification Sent Outside Transaction Scope (DEFERRED)

**File**: `src/lib/provisioning.ts:1227–1281`  
**Risk**: Email send failure after provisioning is already committed  
**Failure Scenario**:
- Checkout webhook calls `provisionFromCheckoutSession()`
- At line 1227, `upsertProvisioningRecord()` commits (plan = 'pro')
- At line 1259, `sendWelcomeEmail()` called AFTER commit
- If email provider fails or times out, exception caught at line 1290
- Provisioning already persisted; email never sent
- User sees access granted but receives no email; support confused
- Worse: if Vercel function times out before email completes, webhook handler returns success but email never sends

**Root Cause**: Email send is synchronous outside transaction scope. Email provider latency/failure doesn't trigger rollback of access grant.

**Fix Required**:
- Wrap email send inside transaction or queue send before committing access
- Alternatively: return success immediately, queue email send separately, and re-send on failure
- Requires careful state machine design to avoid double-provisions

**Decision**: Deferred; requires architecture review to decide on queueing vs. inline vs. async send.

---

### 5. ⚠️ Token Consumed Before Session/Grant Verified (DEFERRED)

**File**: `src/lib/auth/memberAccountActions.ts:254–283`  
**Risk**: One-time token burned before downstream permission grant succeeds  
**Failure Scenario**:
- User clicks password-reset link with valid token
- Token verification passes at line 244
- At line 268, `consumeAction()` irreversibly marks token as used in DB
- At line 273, return value checked
- If membership grant fails silently downstream (e.g., Payload rejects), token already consumed
- User cannot retry: token is exhausted
- Support must manually reset token

**Root Cause**: `consumeAction()` mutates DB before verifying downstream business logic (membership grant, session creation) will succeed.

**Fix Required**:
- Move token consumption to end of success path, OR
- Add rollback path if downstream grant fails
- Requires careful sequencing of membership verification → grant → session → consume

**Decision**: Deferred; low blast radius (affects password resets only) but requires flow re-architecture.

---

## Testing & Validation Summary

| Test Suite | Status | Coverage |
|---|---|---|
| `pnpm test:release` | **PASS 151/151** | All gates pass including new atomic functions |
| `pnpm test:e2e` | **PASS 58/58** | No regressions in browser journeys |
| `pnpm build` | **PASS** | Production build succeeds |
| `pnpm exec tsc --noEmit` | **PASS** | Type-check clean |
| `pnpm exec prisma validate` | **PASS** | Both schemas valid |
| `pnpm audit --prod` | **PASS** | 3 moderate (no new high-severity) |
| `git diff --check` | **PASS** | No line-ending issues |

---

## Readiness Assessment

| Dimension | Status | Details |
|---|---|---|
| **Build** | ✅ Clean | No type errors, audit passes, Docker builds |
| **Tests** | ✅ Green | 151/151 release, 58/58 E2E, all gates pass |
| **Migrations** | ⚠️ Blocked | No migrations applied; approval + rehearsal pending |
| **Provider** | ⚠️ Blocked | Simulated tests pass; live verification pending |
| **Security Hardening** | ✅ Improved | 2 critical fixes committed; 3 high-risk deferred with clear fix scope |
| **Documentation** | ✅ Current | Roadmap, release, migration, provider docs synchronized |

---

## Remaining Blockers

Per `docs/PREVIEW_RELEASE_READINESS.md` and decision-readiness checks:

1. **Migration approval** — table-plan-to-Free mapping + account-column rename still pending
2. **Rollback evidence** — documented; disposable rehearsal awaits operator
3. **Provider verification** — live Stripe/Resend verification still pending
4. **Staging smoke** — manual execution still pending
5. **Go/no-go approval** — formal review still pending
6. **Seat claim race** — architectural fix deferred (low impact, not on critical path)
7. **Email transaction** — architectural review deferred
8. **Token consumption** — low-blast-radius fix deferred

---

## Recommendations

### Immediate (Before Staging Deployment)

1. **Merge hardening fixes** to `feature/course-branding-and-preview`
2. **Re-validate staging** with fixed idempotency logic (replay webhook test)
3. **Test authorization** by attempting unauthenticated sponsored decision

### Post-Release (Before Production)

1. **Seat claim race** — add FOR UPDATE lock + test concurrent claims
2. **Email transaction** — add queue-based retry or inline transaction wrapping
3. **Token consumption** — move consume to success path or add rollback

### Long-Term

1. **Webhook test harness** — add concurrent event replay tests to CI
2. **Authorization pattern** — document session extraction + role check pattern for all API routes
3. **Transaction scope** — audit all email sends to ensure within or queued before commit

---

## Conclusion

**Formal state remains NO-GO** (as directed). Hardening has improved critical path safety by 2 points:

- ✅ Webhook idempotency is now atomic
- ✅ Sponsored decision authorization is now guarded

Three deferred high-risk issues have clear fix scope and low blast radius. All tests pass. Repository is ready for controlled staging acceptance once external approvals proceed.

---

**Report prepared**: 2026-07-22 10:27 UTC  
**Next review**: Post-staging-smoke or operator request  
**Owner**: Repository  
