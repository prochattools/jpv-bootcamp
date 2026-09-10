# Mighty Manual Access Normalization

## Purpose

This procedure is required before enabling automated Stripe-derived Mighty
revocation. It is read-only until a separate operator approval authorizes a
bounded normalization batch.

Stripe remains the billing authority. The canonical access path is:

`Stripe entitlement → JPV Member Access Plan (${MIGHTY_ACCESS_PLAN_ID}) → Mighty access`

The application worker currently reconciles only the configured access Plan. It does not
remove other Mighty Plans, direct Network membership, or Space membership.

## Read-only audit

Run only from an approved production-data environment with:

```bash
MIGHTY_PROVIDER_ENV=production pnpm mighty:manual-access-audit
```

The command lists Mighty members and network purchases, compares normalized
emails with currently entitled Stripe records, and prints aggregate counts
only. It performs no create, grant, revoke, delete, or update operation. It
requires the normal Mighty API configuration and the real Plan ID, but does
not require the worker secret or the production mutation guard.

## Risk categories

- **Stripe-entitled, missing configured access Plan:** must receive the canonical Plan
  grant before cutover, subject to the approved provisioning procedure.
- **Stripe-entitled, other Plan overlap:** access may survive a target-Plan
  revocation. Review every other Plan before relying on automated denial.
- **Direct member without a Plan:** Network membership may provide access even
  though no target Plan purchase exists. Review for removal from Everything or
  the Network under a separate approval.
- **Non-entitled member with Plan 2000039:** likely stale access; do not
  revoke automatically until identity and exception status are reviewed.
- **Non-entitled member with another Plan:** outside the Stripe-derived JPV
  entitlement boundary and requires manual classification.

An existing Mighty member record is not proof of a valid Stripe entitlement,
and removing only the configured access Plan is not proof that every other
access route is closed.

## Required normalization procedure

1. Keep the production scheduler disabled and do not run a full automatic
   reconciliation batch.
2. Run the aggregate audit and have a second authorized reviewer record the
   counts and exception categories.
3. Match records by normalized email, then confirm Stripe customer and
   subscription identity before any change. Stop on an identity conflict.
4. For Stripe-entitled members, grant Plan `2000039` where absent. Preserve
   approved staff, sponsor, creator, or other documented exceptions separately.
5. For overlapping non-target Plans or direct/Space membership, obtain an
   explicit per-category approval before removing the older access. Do not
   treat target-Plan removal as sufficient.
6. For members without an active Stripe entitlement, review and remove stale
   JPV access through the appropriate Mighty Plan/Network/Space control. Do not
   delete accounts as part of this procedure.
7. Re-run the read-only audit and verify that every active JPV subscriber has
   Plan `2000039` and no unapproved alternate access route.
8. Only after the aggregate result and exceptions are signed off may automated
   revocation be enabled.

## Current status

No real member population has been migrated or modified. The audit is
implemented but has not been run because the remaining production API values
are not available to this local execution environment.
