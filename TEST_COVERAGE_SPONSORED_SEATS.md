# Sponsored Seats Concurrency Test Coverage

## Overview

The sponsored seats concurrency test suite verifies that the seat allocation mechanism is protected against race conditions and double-claims through PostgreSQL's `FOR UPDATE SKIP LOCKED` locking mechanism.

**Test File:** `src/tests/sponsored-seats-concurrency.test.ts`
**Run Command:** `pnpm test:sponsored-seats-concurrency`

## What This Tests

The test suite ensures that when multiple approval requests occur concurrently (e.g., from Stripe webhook + admin manual action), exactly **one** seat is claimed per application, never zero and never two.

### Key Protection Mechanism

The critical SQL pattern that prevents double-claims:

```sql
UPDATE sponsored_seats
SET reserved_by_application_id = $applicationId,
    reserved_at = $now
WHERE id = (
  SELECT id
  FROM sponsored_seats
  WHERE claimed_by_account_id IS NULL
    AND reserved_by_application_id IS NULL
    AND tier = $tier
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED    <-- CRITICAL: This prevents race conditions
  LIMIT 1
)
RETURNING id
```

**How it works:**
- `FOR UPDATE`: Acquires an exclusive lock on selected rows
- `SKIP LOCKED`: Doesn't wait for locked rows; skips them instead
- **Result:** Only one transaction can claim a seat; others find it locked and skip to no results

## Test Scenarios

### Scenario 1: Same Application, Concurrent Approvals

**Situation:**
- 1 available seat
- 1 application in pending state
- 2 concurrent approval requests to the same application
- (Real-world: Stripe webhook + admin manually approved simultaneously)

**Expected Outcome:**
- Exactly 1 request succeeds → seat is claimed
- Exactly 1 request fails → "no_seat_available" error
- Application marked approved with the winner's seat

**Assertions:**
- ✓ `succeeded.length === 1`
- ✓ `failed.length === 1`
- ✓ `failed[0].error === 'no_seat_available'`
- ✓ `application.status === 'approved'`
- ✓ `application.seatId === winner_seat_id`
- ✓ `seat.reserved_by_application_id === app_id`

**Coverage:** Proves that `FOR UPDATE SKIP LOCKED` prevents the same seat from being claimed twice by locking it after the first SELECT.

### Scenario 2: Different Applications, Limited Seats

**Situation:**
- 1 available seat
- 2 different applications, both in pending state
- 2 concurrent approval requests (different apps)
- (Real-world: Admin approves two applicants simultaneously)

**Expected Outcome:**
- Exactly 1 application gets approved and claims the seat
- Exactly 1 application approval fails with "no_seat_available"
- Only 1 row in `sponsored_applications` table has `status='approved'`

**Assertions:**
- ✓ `succeeded.length === 1`
- ✓ `failed.length === 1`
- ✓ `approvedCount === 1`
- ✓ `seat.reserved_by_application_id !== null`
- ✓ `claimedSeats === 1` (no extra seats allocated)

**Coverage:** Proves seat exclusivity under competitive allocation; only one winner per seat.

### Scenario 3: High-Concurrency Atomicity Proof

**Situation:**
- 1 available seat
- 2 applications
- 10 concurrent UPDATE attempts (5 from each app)
- (Real-world: Heavy load, multiple retry handlers, webhook retries)

**Expected Outcome:**
- At most 1 of 10 updates succeeds (others find the seat locked)
- Final state: exactly 1 seat is reserved
- Seat cannot be "double-reserved" or partially updated

**Assertions:**
- ✓ `successes.length <= 1`
- ✓ `finalSeat.reserved_by_application_id !== null`
- ✓ `claimedByApps === 1` (not 2, not 3, exactly 1)

**Coverage:** Proves atomicity under high contention; the lock mechanism scales even with many concurrent attempts.

## Technical Details

### Transaction Structure

Each approval attempt follows this pattern:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock the application (to prevent duplicate processing)
  const locked = await tx.$queryRaw(
    Prisma.sql`SELECT id, status FROM sponsored_applications WHERE id = ... FOR UPDATE`
  )

  // 2. Try to claim a seat (FOR UPDATE SKIP LOCKED ensures atomicity)
  const claimed = await tx.$queryRaw(
    Prisma.sql`UPDATE sponsored_seats SET reserved_by_application_id = ... WHERE ...`
  )

  // 3. Update application status (only if seat was claimed)
  if (!claimed[0]?.id) throw new Error('no_seat_available')
  await tx.sponsoredApplication.update(...)

  return { success: true, seatId: claimed[0].id }
})
```

### Atomicity Guarantees

1. **All-or-nothing:** Either the seat is claimed AND the app is updated, OR both fail
2. **Mutual exclusion:** Only one transaction can hold the seat lock
3. **Non-blocking:** Competing txns don't wait; they fail fast with SKIP LOCKED
4. **Deterministic:** The "winner" is determined by lock order, not timing luck

## How to Run

### Run All Tests

```bash
pnpm test:sponsored-seats-concurrency
```

### Run Individual Scenarios

To run specific scenarios, modify the test file to use `.only`:

```typescript
describe.only('Scenario 1: FOR UPDATE lock prevents double-claim', () => {
  it('should claim each seat only once under concurrent approvals', async () => {
    // ...
  })
})
```

### Requirements

- PostgreSQL database running (required for FOR UPDATE locking)
- Prisma client configured and migrations applied
- Node.js 20.9+
- Vitest (when added to project dependencies)

## Expected Test Output

```
✓ Scenario 1: FOR UPDATE lock prevents double-claim
  ✓ should claim each seat only once under concurrent approvals

✓ Scenario 2: Limited seats force winner-take-all
  ✓ should allocate only one seat when multiple applications compete

✓ Scenario 3: Race condition prevention evidence
  ✓ should prove FOR UPDATE SKIP LOCKED prevents double-claim

3 passed (1.2s)
```

## Common Failures & Debugging

### Test Fails with "no_seat_available" for all attempts

**Cause:** Seat is already claimed or locked before test starts.
**Fix:** Check `beforeEach` cleanup; ensure `sponsoredSeat.deleteMany()` runs.

### Test Fails with "already_processed"

**Cause:** Application status was not pending at start of test.
**Fix:** Check `beforeEach` cleanup; ensure `sponsoredApplication.deleteMany()` runs.

### Test Hangs or Times Out

**Cause:** FOR UPDATE without SKIP LOCKED can cause deadlock if not properly released.
**Fix:** Verify all queries use `FOR UPDATE SKIP LOCKED` (not just `FOR UPDATE`).

### Concurrency Not Working on SQLite/MySQL

**Note:** This test requires PostgreSQL. SQLite and MySQL handle `FOR UPDATE SKIP LOCKED` differently.

## Deployment Verification

Before deploying any changes to seat claim logic:

1. Run full test suite: `pnpm test:sponsored-seats-concurrency`
2. All three scenarios must pass
3. No timeouts or deadlocks
4. Database cleanup works (no orphaned test data)

## Related Code

- **Seat allocation handler:** `src/lib/sponsoredSeats/approveSeat.ts`
- **Application model:** `prisma/schema.prisma` → `SponsoredApplication`
- **Seat model:** `prisma/schema.prisma` → `SponsoredSeat`
- **Approval API:** `src/app/api/admin/applications/[id]/approve/route.ts`

## References

- [PostgreSQL FOR UPDATE Documentation](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [Prisma Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Concurrency Safety in Production](https://brandur.org/postgres-atomicity)
