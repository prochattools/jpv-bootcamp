# Room creator and member access fixes — 2026-08-31

## Scope

- Every Room creator with a linked active member identity is included in the
  resolved audience, even when the administrator did not select themselves.
- Room reconciliation creates the creator's durable access grant and runs the
  same idempotent member invitation email and in-app notification path used for
  other recipients.
- Existing Rooms remain visible to their creator when an older Room has no
  creator grant; the next normal reconciliation can add the missing ledger row.
- A stale, recoverable `incomplete` or pending-reconciliation billing
  projection is checked against the current operational provider state. An
  active/trialing provider subscription unlocks course lessons and the shared
  community reaction/bookmark authorization path. Terminal local billing states
  remain fail-closed.

## Safety

No database migration, production data rewrite, or backfill was added. The
change is application-only and preserves the existing room/member unique
constraints and email/notification dedupe keys.

## Verification

The release candidate includes dedicated creator-invitation coverage in
`scripts/room_creator_invitation.test.ts`, stale billing activation coverage,
the existing Rooms and engagement tests, TypeScript compilation, the release
test manifest, and browser verification before shipping.
