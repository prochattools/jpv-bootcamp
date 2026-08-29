# JPV Bootcamp Ownership Decisions v1

**Status:** CURRENT A5.1 ARCHITECTURE DECISIONS — A6 LIVE EVIDENCE GATED

**Date:** 2026-08-28

This is the compact decision record for the A5.1 architecture hold. It names
business authorities and directional projections; it does not authorize a
migration, reconciliation, provider write, or production deployment.

## Identity and access

- Payload `payload_users` remains the administrator identity authority.
- Payload `payload_members` and `payload_member_profiles` remain the portal
  member identity/profile authority.
- `resolveAdministratorMemberIdentity()` is read-only and is used by ordinary
  portal actor resolution. `ensureAdministratorMemberIdentity()` is an
  explicit provisioning/backfill path only.
- An administrator may have an explicit `portalMember` relationship and a
  member-facing profile, but remains `kind: 'admin'`; the relationship never
  creates a subscription, entitlement, or subscribed-member count.

## Billing and identity matching

- Stripe is the commercial truth for customers, subscriptions, invoices,
  payment state, and provider-side lifecycle.
- Payload `payload_billing_accounts`, `payload_subscriptions`, and
  `payload_payments` are the canonical local billing projection/read model.
  `stripeShadowSync` is the one-way projection owner.
- Prisma `customer_provisioning` is an operational checkpoint and legacy
  compatibility surface. It may enrich operational status, but it is not a
  second local billing projection authority.
- Conflict precedence is Stripe provider state, then the canonical Payload
  projection when the provider event has been projected. Manual block/hold
  reasons are never overwritten by an automatic identity match.
- Matching order is: Stripe customer ID; explicit internal member link;
  normalized email only when exactly one candidate exists; otherwise
  `review-required`. Unknown, duplicate, inactive, and wrong-environment
  matches are never silently assigned, and reconciliation never creates a
  member in read-only mode.

## Support

- Prisma `support_requests` is the canonical intake and operator-review
  ledger, including review status and reviewer information.
- Payload membership-support records are one-way projections for membership
  and billing operations; they are not a competing support inbox.
- `src/lib/support/persistence.ts` owns support persistence. Routes parse and
  authorize, then call the service. Existing dedupe keys and notification
  handling remain unchanged.

## Sponsored access

- Prisma `sponsored_seats` owns funded seat inventory and reservation/claim
  state.
- Prisma `sponsored_applications` owns applicant review state and the
  application-to-seat relationship.
- Prisma `sponsored_grants` and the transaction in
  `src/lib/sponsored/claimSponsoredSeat.ts` own grant issuance and its
  idempotent race handling.
- Payload membership-support/funding/review records are administrative
  projections. Stripe is the recipient's billing truth when a sponsored
  recipient is converted into a normal subscription.
- The claim token, application, and reserved seat must agree. A repeated
  claim by the same account is an idempotent success; an unavailable or
  mismatched seat is a failure requiring review.

## Partner and affiliate

- Payload partner/affiliate collections own partner, referral, application,
  and delivery business facts.
- Prisma `partner_sessions` and `partner_clicks` retain hashed session/click
  telemetry. The stable join is the explicit partner/application identifier
  and, where present, internal account ID; hashed telemetry is not a business
  identity key.
- Telemetry retention is operational and time-bounded. A missing or expired
  telemetry row is recovered from the Payload business record or reported as
  unavailable; it cannot alter membership or partner state.

## Email and outbox

- Resend is the provider delivery-status authority.
- Payload `payload_email_events` is the current canonical outbox/delivery
  ledger. Its `dedupeKey` owns idempotency, and the Payload email worker owns
  retry/lease state.
- Prisma `email_events` and `src/lib/email.ts` remain an intentionally
  isolated legacy compatibility path for older workflows. New Payload domain
  events must not be mirrored into it, and the two paths must not double-send.

## Persistence and A6 gate

- Route/page persistence moved by A5.1 is support persistence and sponsored
  claim persistence. Those transports now parse, authorize, call a named
  server-only service, and format the response.
- A5.1 leaves no architecture ambiguity. A6 still must provide exact
  production database/schema identity, read-only Stripe/Payload/member
  inventory reconciliation, deployed-SHA health, provider configuration and
  delivery proof, and rollback evidence before any apply operation.
