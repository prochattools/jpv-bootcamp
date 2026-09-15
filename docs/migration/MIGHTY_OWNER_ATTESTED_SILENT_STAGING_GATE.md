# Owner-attested silent existing-member Plan staging gate

This gate is a migration-only safety primitive. It is empty by default and is
not enabled by environment configuration, the ordinary lifecycle, the worker,
or the scheduler.

The source registry is `src/lib/mighty/silentMigrationAuthorizations.ts`.
It initially contains zero authorizations. A future reviewed source change may
add exactly one owner-attested existing-member authorization, bound to:

- normalized email and exact Mighty member ID;
- the exact immutable manifest SHA-256;
- the exact SHA-256 of a positive owner-attestation artifact (the unresolved
  role-review artifact is never sufficient);
- role `ORDINARY`;
- Plan `2000039`;
- action `GRANT_PLAN_ONLY` and batch size `1`.

The authorization has no email, member-creation, revoke, content, Space,
profile, role, login, Stripe-write, or arbitrary-Plan capability. Before a
future grant, the runner must re-check exact Stripe entitlement, exact Mighty
identity, target Plan absence, other Plans, purchases, Spaces, and identity
evidence. A missing member, identity drift, entitlement drift, overlap, or
uncertain verification stops for review. It never creates a member or removes
a Plan as generic rollback.

## Required owner statement

```text
OWNER ATTESTATION:

email:
<exact email>

Mighty member ID:
<exact ID>

classification:
ORDINARY

I confirm this identity is not:
Host
Owner
Admin
Administrator
Staff

I authorize this identity to be considered an ordinary member for the bounded
JPV Mighty silent-staging migration only.

No other identity is covered.
```

The first preferred candidate after a valid attestation is
`adaumoudit@gmail.com` / Mighty `41566725`, subject to a fresh manifest and
entitlement re-check. `happyalamss@gmail.com` remains a later candidate because
its valid 100%-coupon entitlement is allowed but still needs the same role
attestation. `amechiclarangozi2022@gmail.com` remains blocked by its independent
Stripe customer ambiguity.
