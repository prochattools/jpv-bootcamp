# Member Account Action — Reservation and Finalization

**Status:** IMPLEMENTED IN SOURCE — SHARED STAGING MIGRATION NOT YET AUTHORIZED
**Implementation date:** 2026-08-04
**Migration:** `20260804_050000_member_account_action_reservations`
**Deployed staging baseline:** `9c045fa5a5c327014c20fe9377f7d5368b550573` still uses the preceding schema.

## Scope

This design governs one-time member invitations, password resets, and email-change confirmations. The repository implementation is complete locally, including the schema migration source, atomic SQL, service APIs, caller integration, behavioral concurrency tests, and release guards. The migration has not been applied to the shared staging database, and no live member action was used during implementation or validation.

## State model

An account action is represented by one of three durable states:

- **pending:** `consumed_at`, `reservation_nonce`, `reserved_at`, and `lease_expires_at` are null;
- **reserved:** `reservation_nonce`, `reserved_at`, and `lease_expires_at` are all non-null while `consumed_at` and `invalidated_at` remain null;
- **consumed:** `consumed_at` is non-null and the reservation fields are cleared. New completions persist a non-sensitive `result_fingerprint`.

A safe pre-mutation failure releases the action by clearing the three reservation fields, returning it to `pending`. An expired lease may be atomically reclaimed with a new nonce. A consumed or invalidated action cannot be reopened.

Existing columns remain authoritative:

- `token_digest`
- `purpose`
- `member_id`
- `email`
- `expires_at`
- `consumed_at`
- `invalidated_at`

The migration adds:

- `reservation_nonce varchar(64)`
- `reserved_at timestamp(3) with time zone`
- `lease_expires_at timestamp(3) with time zone`
- `result_fingerprint varchar(64)`

Raw tokens, passwords, password-derived material, and raw email addresses are never stored in the new fields.

## Invariants

1. At most one unexpired reservation exists for an action.
2. Reservation ownership is demonstrated by an unguessable nonce.
3. Reservation, finalization, and release are purpose-scoped.
4. Token expiry, invalidation, and consumption are checked before reservation.
5. Only the current nonce owner can finalize or release.
6. Finalization requires an active lease and clears reservation fields.
7. A stale nonce cannot finalize or release after lease reclaim.
8. Active reservations cannot be replaced by a newly issued action.
9. A result fingerprint is permitted during a reserved mutation-intent state or after consumption; release clears it before returning the action to pending.
10. Finalization must match the exact result fingerprint recorded by the current reservation owner.
11. Result fingerprints are SHA-256 values derived from the token digest, purpose, and a non-sensitive purpose-specific result key.

## Atomic operations

### Reserve

`buildReserveMemberAccountActionSql` uses one schema-qualified statement with positional parameters:

- select the eligible action by `token_digest` and `purpose`;
- require `consumed_at IS NULL`, `invalidated_at IS NULL`, and `expires_at > now()`;
- require no active lease, while permitting an expired lease;
- acquire the candidate with `FOR UPDATE SKIP LOCKED`;
- set `reservation_nonce`, `reserved_at = now()`, and `lease_expires_at` using database time;
- return only member ID, target email, reservation metadata, optional prior fingerprint, and whether a lease was reclaimed.

Two workers racing for the same action cannot both receive a reservation. The loser cannot enter the downstream mutation.

### Finalize

`buildFinalizeMemberAccountActionSql` requires:

- token digest;
- purpose;
- current reservation nonce;
- an unexpired lease;
- an unconsumed, non-invalidated action.

It sets `consumed_at`, persists the result fingerprint, clears reservation state, and returns only allow-listed completion data.

### Release

`buildReleaseMemberAccountActionSql` clears reservation state only when token digest, purpose, and nonce match and the action is still unconsumed and non-invalidated. This operation is used only after a failure proven to have occurred before the downstream mutation.

### Completed-result lookup

`buildFindCompletedMemberAccountActionSql` retrieves the completed result by token digest and purpose. The service compares result fingerprints using timing-safe equality. A matching replay returns idempotent success without repeating the mutation; a conflicting result is rejected.

## Flow integration

### Invitation

1. Reserve `member_invitation`.
2. Load and validate the pending member.
3. Activate the member once.
4. Finalize with the `member-active` result key.
5. Write audit, security, and email side effects after durable success.

Safe member-load or unchanged-state activation failures release the reservation. A thrown update whose durable member state is already active is recovered and finalized. An arbitrary pre-existing active member is not accepted as this action's completion.

### Password reset

1. Reserve `password_reset`.
2. Validate the member.
3. Prepare Payload's reset token.
4. Call Payload `resetPassword` once.
5. Classify a thrown call through read-only reset-token state:
   - token still prepared: safe failure, release;
   - token cleared: uncertain success, finalize;
   - unknown state: retain the lease for later recovery.
6. Finalize with `password-reset-completed`.
7. Write audit and confirmation side effects after finalization.

No password or password-derived value is used in the result fingerprint.

### Email change

1. Reserve `email_change_confirmation`.
2. Validate the member and target-email availability.
3. Update the member email.
4. Finalize using a key containing only the normalized email's SHA-256 fingerprint.
5. Write security, audit, and notification side effects after finalization.

Duplicate-email and unchanged-state update failures release safely. A thrown update whose durable member state already contains the intended address is recovered and finalized. The previous consume-before-update defect is removed.

## Failure guarantees

- **Crash after reservation, before mutation:** the lease expires and can be reclaimed.
- **Safe failure before mutation:** the nonce owner releases immediately and the original action can be retried.
- **Crash or timeout after mutation, before finalization:** the action is not blindly released. After lease expiry, the next attempt verifies purpose-specific durable state and finalizes idempotently.
- **Lease expires during a slow mutation:** a stale nonce cannot finalize after another worker reclaims the lease. Callers must use durable-state recovery rather than claiming exactly-once execution.
- **Failure after finalization:** audit and notification side effects are best effort and do not reopen or revert the completed action.

The implementation provides one active reservation plus idempotent recovery. It does not claim a globally transactional exactly-once guarantee across Payload mutations and external providers.

## Behavioral concurrency evidence

Repository-local behavioral tests cover:

- one reservation winner and one blocked concurrent attempt;
- invitation activation called once;
- password reset called once;
- email update called once;
- active lease rejection;
- expired lease reclaim;
- stale-nonce finalization and release rejection;
- safe release and successful re-reservation;
- consumed, expired, invalidated, malformed, and wrong-purpose rejection;
- matching completed replay and conflicting-result rejection;
- raw-token, password, and raw-email non-disclosure.

These tests use deterministic in-memory repositories, injected clocks, synthetic records, and deferred concurrent calls. They do not connect to the shared staging database.

## Migration and rollback

The forward migration:

- adds four nullable columns;
- adds all-or-none reservation-state and result-state checks;
- validates those checks;
- creates a partial active-lease index;
- creates a partial result-fingerprint index;
- performs no row update or data backfill.

The down migration drops only the two new indexes, two new constraints, and four new columns. It does not alter `token_digest`, `purpose`, `member_id`, `email`, `expires_at`, `consumed_at`, or `invalidated_at`.

`ALTER TABLE ... ADD COLUMN` and constraint installation take PostgreSQL table locks. The nullable columns require no table rewrite. Constraint validation scans the account-action table, and ordinary index creation takes a share lock while building. The table is expected to be small, but shared-staging execution still requires an explicit operator window, backup evidence, and rollback ownership.

## Deployment boundary

Source implementation and local behavioral validation do not prove the shared staging schema. **Staging migration authorization remains pending.** Before pushing a commit whose normal preview deployment may apply this migration, an operator must explicitly authorize:

`Apply the account-action reservation/finalization migration to the shared staging database through the normal feature-branch preview deployment.`

After authorization, acceptance requires exact-SHA CI success, migration evidence for the new columns and constraints, exact-SHA staging health, and an approved non-destructive staging verification. Until then, the finding is resolved in source but remains operationally unverified on shared staging.
