# Member Account Action — Reservation/Finalization Design

**Status:** DESIGN SPECIFIED — IMPLEMENTATION NOT AUTHORIZED
**Date:** 2026-08-02
**Classification:** OPEN — DURABLE RESERVATION/FINALIZATION REQUIRED

This document specifies the durable reservation/finalization primitive for one-time
member account actions (invitation, password reset, email-change confirmation). It does
not authorize implementation, schema application, or migration execution. Both
implementation and any schema change require explicit staging authorization through the
normal release migration process.

## Problem statement

The current `findCompletableAction` → mutation → `completeAction` sequence does not
prevent two concurrent requests from both entering the downstream mutation window. For
invitation and password reset this means two workers can attempt to activate the same
account or set the same password independently. For email change the token is consumed
before the member update, meaning update failures permanently consume the action without
completing it. No durable cross-instance lock or lease exists.

Moving `completeAction` earlier or later within a single flow is not a safe concurrency
fix; it only changes which race condition is exposed. A schema-backed reservation state
is required.

## State machine

Each one-time action progresses through the following states:

```
pending → reserved → consumed
                   ↘ released (safe downstream failure recovery)
         ↓ (lease expired, no crash)
       pending (recoverable) or expired (policy-based)
```

| State | Meaning |
| --- | --- |
| `pending` | Action is valid and can be claimed |
| `reserved` | One worker holds an exclusive, time-bounded lease |
| `consumed` | Downstream mutation succeeded; action is permanently closed |
| `released` | Worker failed safely before mutation; action returns to claimable state |
| `expired` | Lease elapsed without consumption; recovery policy applies |

**Invariants:**
- At most one worker may hold an active (non-expired) reservation for a given action.
- Consumption is irreversible.
- A `released` action is observable as `pending` to the next claimant; the `released`
  transition is internal bookkeeping.

## Durable fields

The following fields must be added to the account-action record. Raw tokens must never
be stored.

| Field | Type | Purpose |
| --- | --- | --- |
| `token_digest` | `text NOT NULL` | HMAC-SHA256 of raw token; existing field |
| `purpose` | `text NOT NULL` | Action type (`member_invitation`, `password_reset`, `email_change_confirmation`); existing field |
| `member_id` | reference | Owning member; existing field |
| `token_expiry` | `timestamptz NOT NULL` | When the raw token becomes invalid; existing field |
| `reservation_nonce` | `uuid` | Unique identifier for the current reservation; `NULL` when pending |
| `reserved_at` | `timestamptz` | When the reservation was created; `NULL` when pending |
| `lease_expiry` | `timestamptz` | When the reservation expires if not consumed or released; `NULL` when pending |
| `consumed_at` | `timestamptz` | When consumption succeeded; `NULL` until consumed |
| `result_fingerprint` | `text` | Optional idempotency key set after a successful downstream operation |

Raw token values must not appear in any of these fields, in application logs, or in
error messages. The `token_digest` already satisfies token identity without storing
the raw value.

**Lease duration rationale:** A lease of 30 seconds is proposed. This is long enough
to cover typical downstream mutation latency (email send, database write) and short
enough that a crashed worker does not permanently strand a valid action for more than
one standard retry interval.

## Atomic operations

### validate-and-reserve

```
BEGIN;
SELECT * FROM account_actions
  WHERE token_digest = $digest
    AND purpose = $purpose
    AND token_expiry > NOW()
    AND consumed_at IS NULL
    AND (lease_expiry IS NULL OR lease_expiry < NOW())  -- not actively reserved
  FOR UPDATE;                                           -- cross-instance lock

-- if no row: token invalid, expired, consumed, or actively reserved
-- if row found: update atomically
UPDATE account_actions SET
  reservation_nonce = gen_random_uuid(),
  reserved_at       = NOW(),
  lease_expiry      = NOW() + INTERVAL '30 seconds'
WHERE id = $id;
COMMIT;
-- return reservation_nonce to caller; caller must include it in finalize call
```

This operation is the only entry point. Two workers racing here will both obtain the
FOR UPDATE lock in turn; the second will find `lease_expiry > NOW()` and fail.

### renew-or-recover-expired-reservation

If a caller holds a `reservation_nonce` but the lease has elapsed (e.g. slow network),
the same atomic pattern may be re-entered with the existing nonce for verification. If
the action is still pending or the prior reservation expired, a new lease is issued.

### finalize-consumption

```
BEGIN;
SELECT * FROM account_actions
  WHERE token_digest        = $digest
    AND reservation_nonce   = $nonce   -- only the reservation holder may consume
    AND lease_expiry        > NOW()    -- lease must still be active
    AND consumed_at         IS NULL
  FOR UPDATE;
-- perform downstream mutation here (within same transaction or with
-- compensating idempotency guard for operations that cannot be transactional)
UPDATE account_actions SET
  consumed_at        = NOW(),
  result_fingerprint = $fingerprint   -- optional; aids idempotent replay detection
WHERE id = $id;
COMMIT;
```

For email sending, which cannot be transactionally atomic with the database write,
the intent must be durably persisted (as in `payload_email_events`) before the delivery
attempt, so that a retry can detect an already-sent event by the `result_fingerprint`.

### release-after-safe-failure

If the downstream mutation fails in a way that can be safely retried (network error,
transient database failure), the worker must explicitly release the reservation:

```
UPDATE account_actions SET
  reservation_nonce = NULL,
  reserved_at       = NULL,
  lease_expiry      = NULL
WHERE id = $id AND reservation_nonce = $nonce AND consumed_at IS NULL;
```

This returns the action to `pending` state. A failed worker that cannot reach the
database will have its lease expire naturally; no manual intervention is needed.

### idempotent replay detection

If `finalize-consumption` is called with a nonce that has already been consumed
(`consumed_at IS NOT NULL AND reservation_nonce = $nonce`), return the prior
`result_fingerprint` to the caller without re-executing the downstream mutation.

## Concurrency proof

| Scenario | Outcome |
| --- | --- |
| Two workers call validate-and-reserve simultaneously | FOR UPDATE serializes both; the second sees `lease_expiry > NOW()` and fails with "action reserved" |
| Two invitation attempts arrive | Only one can hold the reservation; the other receives an error before any activation |
| Two password-reset attempts arrive | Same as above; only the reservation holder may call `resetPassword` |
| Two email-change attempts arrive | Same as above; consume no longer precedes update in the new flow |
| Worker crashes between reserve and finalize | Lease expires after 30 seconds; action returns to `pending` |
| Worker fails downstream but releases | `release-after-safe-failure` returns action to `pending`; original token remains valid |
| Already-consumed replay | `result_fingerprint` returned; downstream mutation not re-executed |
| Purpose isolation | Token digest matches a specific purpose; a token for `password_reset` cannot be used for `email_change_confirmation` |

## Flow integration

### Member invitation

1. `validate-and-reserve(digest, 'member_invitation')` → obtain `nonce`
2. Activate member account in `payload.update`
3. `finalize-consumption(digest, nonce, fingerprint)` within or immediately after the
   activation transaction
4. Return activation success to caller

The early idempotency-return path (already-active branch) must check `consumed_at IS
NOT NULL` before attempting reservation; if consumed, return the existing result without
re-entering the state machine.

### Password reset

1. `validate-and-reserve(digest, 'password_reset')` → obtain `nonce`
2. `payload.resetPassword(...)` — performs the actual password change
3. `finalize-consumption(digest, nonce, fingerprint)` after successful reset
4. On reset failure: `release-after-safe-failure(id, nonce)`

### Email-change confirmation

This flow currently consumes the token before the member update. The corrected sequence:

1. `validate-and-reserve(digest, 'email_change_confirmation')` → obtain `nonce`
2. Persist intent (new email address) durably if not already done
3. `payload.update(...)` — update member email
4. `finalize-consumption(digest, nonce, fingerprint)` after successful update
5. On update failure: `release-after-safe-failure(id, nonce)`

This eliminates the current "consumed before update" gap.

## Migration and rollout

### Proposed schema change

```sql
ALTER TABLE account_actions
  ADD COLUMN reservation_nonce    uuid,
  ADD COLUMN reserved_at          timestamptz,
  ADD COLUMN lease_expiry         timestamptz,
  ADD COLUMN consumed_at          timestamptz,
  ADD COLUMN result_fingerprint   text;

CREATE INDEX idx_account_actions_lease_expiry
  ON account_actions (lease_expiry)
  WHERE consumed_at IS NULL;
```

The existing `token_digest`, `purpose`, `member_id`, and `token_expiry` columns are
unchanged. No existing rows are invalidated.

### Compatibility with existing pending actions

Actions created before this migration will have all new columns `NULL`. The
validate-and-reserve query treats a `NULL` `lease_expiry` as "not reserved", so
existing pending actions remain claimable. The `consumed_at IS NULL` guard distinguishes
legacy consumed actions (which previously used a separate completion flag) only if the
existing completion mechanism is migrated; this must be verified during migration
rehearsal.

### Backfill behavior

No backfill is required. Existing pending actions are compatible with the new flow.
Existing completed actions should have `consumed_at` set to a reasonable timestamp
during migration rehearsal if the completion flag being removed is the authoritative
completion marker.

### Rollback plan

The new columns may be dropped without affecting existing behavior if the new code
paths are not yet activated. Rollback must be coordinated with a code deployment
reverting to the pre-reservation flow.

### Phased rollout

1. **Schema first:** apply the migration, deploy no code changes.
2. **Code second (read-only):** deploy new `validate-and-reserve` logic alongside the
   existing flow; both paths active; reservation columns written but old completion
   still authoritative.
3. **Switch:** activate new `finalize-consumption` path; old completion flag becomes
   redundant.
4. **Cleanup:** remove old completion columns and associated legacy code.

Each phase requires a separate staging validation before promotion.

### Required staging authorization before schema application

The schema change described above must not be applied without:

- a separate staging authorization record approved by the release operator
- migration rehearsal evidence on a disposable copy of staging data
- rollback ownership confirmed
- the normal release migration process followed as documented in
  `docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md`

## Behavioral tests required before implementation may be called complete

The following tests must exist and pass before the reservation/finalization
implementation is considered complete. These tests replace the current status guard
(`scripts/member_account_action_completion_hardening_status.test.ts`), which documents
the open gap only.

| Test | Scope | Description |
| --- | --- | --- |
| Success consumes exactly once | unit | Calling finalize twice with the same nonce returns the prior fingerprint; downstream mutation runs once |
| Downstream failure permits safe retry | unit | Release + re-reserve returns a new nonce; mutation succeeds on retry |
| Concurrent attempts produce one winner | integration | Two simultaneous validate-and-reserve calls on the same action; exactly one succeeds, one receives "reserved" error |
| Expired reservation recovery | unit | Lease elapses; next validate-and-reserve succeeds |
| Idempotent replay after downstream success | unit | Re-sending a consumed nonce returns prior fingerprint |
| Purpose isolation | unit | Token for `password_reset` rejected by `email_change_confirmation` validate-and-reserve |
| Expiry enforcement | unit | Token with `token_expiry` in the past is rejected even if not consumed |
| No raw-token persistence or logging | static | Grep confirms no raw token value is written to columns, logs, or error strings |
| Cross-process or cross-instance concurrency fixture | integration | Two process-level workers race validate-and-reserve; exactly one wins |

The status guard remains in the release manifest until all behavioral tests exist and
pass and the schema change has been authorized and applied.
