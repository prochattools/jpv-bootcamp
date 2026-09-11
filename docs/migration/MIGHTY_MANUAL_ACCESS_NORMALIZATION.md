# Mighty Manual Access Normalization

## CURRENT PHASE: PRODUCTION RELEASE / INERT-DEPLOYMENT READINESS — 2026-09-11

`THREE-ACCOUNT INTEGRATION GATE: PASS`
`INERT-DEPLOYMENT READINESS GATE: PASS`
`REAL MEMBER MIGRATION: NOT AUTHORIZED`
`PRODUCTION SCHEDULER: DISABLED`
`PRODUCTION DEPLOYMENT: NOT YET AUTHORIZED`
`PRODUCTION MERGE: NOT YET AUTHORIZED`

Only `westhoek@hotmail.com`, `steve@yeshua.academy`, and `info@prochat.tools`
are authorized for exact live reads; only the ordinary test may run the
bounded lifecycle mutation, and it must end restored/allowed. Every other real
identity is off limits. Do not inspect, query, classify, reconcile, dry-run,
create, invite, grant, revoke, restore, or otherwise mutate any other account.
Use synthetic fixtures for all other scenarios. Do not build or refresh a
production migration manifest. The former population rehearsal is historical
and superseded, not a current roster.

The inert-deployment checklist, trigger call graph, post-deploy smoke design,
and application rollback plan are in
`docs/release/MIGHTY_INERT_DEPLOYMENT_READINESS.md`. The bounded ordinary
lifecycle passed for `westhoek@hotmail.com` and ended
restored/allowed. Exact read-only checks for `steve@yeshua.academy` and
`info@prochat.tools` show Plan `2000039` present. No fourth identity was read.

## Current boundary — inert deployment only — 2026-09-11

This procedure is currently a design record only. No real-member population
normalization, automated revocation, Stripe mutation, scheduler enablement,
deployment, or merge is authorized. Host/Admin, unexpected Space, alternate
Plan, identity, and overlap cases remain synthetic/review-only. A future owner
must explicitly authorize exact identities and a bounded operation before this
procedure can be used against any additional member.

## Purpose

This procedure is required before enabling automated Stripe-derived Mighty
revocation. It is read-only until a separate operator approval authorizes a
bounded normalization batch.

During the current silent-build phase, existing real members are intentionally
left unchanged. Direct/no-Plan members are expected legacy state, not an error,
and this procedure must not be used to normalize them yet.

Stripe remains the billing authority. The canonical access path is:

`Stripe entitlement → JPV Member Access Plan (${MIGHTY_ACCESS_PLAN_ID}) → Mighty access`

The application worker currently reconciles only the configured access Plan. It does not
remove other Mighty Plans, direct Network membership, or Space membership.

## HISTORICAL / SUPERSEDED — PHASE E0 POPULATION REHEARSAL — 2026-09-10

Historical population evidence is retained only in repository history and is
superseded. It is not a current roster, was not refreshed in this phase, and
must not be used to inspect or classify additional identities. No current
population result is claimed here; use synthetic fixtures for all other
classification scenarios.

## HISTORICAL / SUPERSEDED — PHASE D ORDINARY-MEMBER CANARY RESULT — 2026-09-10

`PHASE D: PASS` for the explicitly authorized identity
`westhoek@hotmail.com`. Live Stripe inspection resolved one active, paid JPV
subscription and classified the entitlement as `ALLOWED`. The existing Mighty
identity was found and reused as member ID `41580317`, `member_type=full`, with
five Spaces and zero Plans before the test. Plan `2000039` is the hidden,
non-paid, Network-access-only `JPV Member Access` Plan, so its scope is
`PLAN_SCOPE_COMPLETE` for the five Spaces.

The corrected business invariant is:

`Stripe ALLOWED → Plan 2000039 present → Mighty access`

`Stripe DENIED → Plan 2000039 absent → no Mighty Network access`

`Stripe ALLOWED again → normal application ALLOWED path → same account and Plan access restored`

The production-shaped acceptance reused the existing account, granted Plan
`2000039`, independently verified access and exactly one target Plan, and
verified full membership, profile fields, and five Spaces. A repeated grant
returned the provider's duplicate-assignment HTTP 422 while the independent
read remained exactly one target Plan. No direct Network membership was
removed separately.

The same application Plan-removal operation then returned HTTP 204. Plan,
member, and Space reads became unavailable while denied, which is the expected
effective lockout for a Network-access Plan. The member's disappearance from
the active list is therefore accepted behavior, not identity loss. A repeated
denial remained safe.

Critically, without manually re-adding direct/full membership first, the
normal application `ALLOWED` reconciliation path recovered the stored member
after the provider returned 404 for the inactive member. The path used the
safe create/re-provision fallback with `member_type=full` and
`send_welcome_email=false`, received the original ID `41580317`, granted the
Plan, and independently verified access. The recovered account retained full
membership, its profile fields, exactly five Spaces, exactly one target Plan,
and zero purchases. The provider does not expose a history mutation/read
surface in this Admin API response, so no profile/content/history write was
performed and no regression was visible in the available evidence.

The deny → restore cycle was repeated once through the same application
abstraction. Both denial and recovery remained safe and idempotent, with the
same member ID, no duplicate account, one target Plan, full membership, and
five Spaces at the end. The authorized owner remains restored/allowed.

The previous `NORMALIZATION BLOCKED` result was based on an unnecessary
requirement: preserving a separate direct Network source while denied. The
historical `network_membership` probe remains recorded below for auditability;
its `cancel_plans=false` behavior changed the member to `limited`, but that
operation is no longer part of the required migration. For an existing
Stripe-ALLOWED direct member, granting Plan `2000039` is the migration action.
Other Plan overlaps, exceptional Space grants, and staff/admin access remain
separate risks that must be audited before automated revocation.

The new-member invariant is covered by the existing first-provisioning tests:
an absent member is created as a full member without an invitation, receives
the Plan, and later recovery uses the same no-welcome ALLOWED path. The
provider behavior discovered here is handled by exact-email lookup first,
stable stored member IDs, 404-as-inactive access reads, and same-identity
re-provision fallback.

## Read-only audit

Run only from an approved production-data environment with:

```bash
MIGHTY_PROVIDER_ENV=production pnpm mighty:manual-access-audit
```

The command reads only the three authorized emails using exact provider
lookups and member-scoped Plan/Space/purchase endpoints. It prints aggregate
counts only and performs no create, grant, revoke, delete, or update
operation. It is not a population audit and must not be broadened without
new owner authorization.

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
- **Active Stripe record with missing/unsupported subscription state:** cannot
  be safely mapped to Mighty access and must be reconciled against Stripe
  before any roster action.

An existing Mighty member record is not proof of a valid Stripe entitlement,
and removing only the configured access Plan is not proof that every other
access route is closed.

## Future normalization procedure — requires new explicit owner authorization

1. Obtain fresh written owner authorization naming each exact identity and
   operation; do not use a population roster or broad endpoint.
2. Keep the production scheduler disabled and do not run a population
   reconciliation or migration dry run.
3. Resolve the exact Stripe customer/subscription and exact Mighty member;
   stop on identity conflict, privilege, overlap, or provider uncertainty.
4. For an explicitly authorized ordinary identity only, grant or revoke Plan
   `2000039` and verify with an independent member-scoped read.
5. Preserve Host/Admin, direct Space, and alternate-Plan access until a
   separate owner decision addresses the bypass risk.
6. Leave the identity in the explicitly authorized final state and record
   redacted evidence. Never delete an account or mutate live Stripe.

## Controlled migration algorithm

The later member migration must accept one member or a small approved batch,
with a run ID and a durable checkpoint for each member. For each row it must:

1. Resolve a deterministic Stripe entitlement and stable customer/subscription
   identity.
2. Find the existing Mighty member by normalized email and stop on conflicts.
3. Read Network, Plan, and Space access before mutation.
4. Grant Plan `2000039` and verify it with an independent provider read.
5. Do not remove legacy direct Network membership separately. Require explicit
   per-member or per-batch approval before removing any overlapping other-Plan
   or exceptional Space access.
6. Verify expected access after normalization and record a redacted checkpoint.

The runner stops on the first error, resumes from the last confirmed
checkpoint, re-reads provider state before retries, and never creates duplicate
members. A failed or ambiguous row remains pending manual review; it is not
silently treated as denied. The final migration invariant is:

`Stripe ALLOWED → Plan 2000039 present → expected Mighty access`

`Stripe DENIED → Plan 2000039 absent → no paid JPV access through the
Plan-controlled path`

Other Plans and exceptional Space membership can still bypass that Plan
invariant, so they must remain separately reviewed overlaps. Ordinary legacy
direct Network membership is intentionally controlled by adding/removing the
Network-access Plan; no routine billing enforcement may use ban, account
deletion, or “Remove From Everything.”

## Ordinary-member pilot — Phase D result and future procedure

The owner provided and authorized exactly one existing legitimate JPV member,
`westhoek@hotmail.com`. The canary result above is the canonical Phase D
evidence. Do not select or mutate another member automatically. The email is
the only member-selection input; it is not permission to test any other
identity. The successful recovery proves that existing direct members can be
migrated by granting Plan `2000039`; no direct-membership-only transition is
required.

For that one member, stop immediately on any unexpected result and preserve the
read-only evidence:

1. Read current Mighty identity, Network/Space membership, all Plans, and the
   configured Plan `2000039` state.
2. Read the matching Stripe customer/subscription entitlement without
   changing Stripe.
3. Grant Plan `2000039` and verify it with an independent Mighty read.
4. Verify that no duplicate Mighty identity was created and that normal access
   still works.
5. Remove only Plan `2000039` under the explicit pilot approval, then verify
   Plan denial and the expected access result.
6. Re-read Network, Space, and other-Plan access to detect any overlap. Do not
   remove direct access during this pilot.
7. Restore Plan `2000039` through the normal application ALLOWED path and
   verify access is restored without manually re-adding direct membership.
8. Confirm the member's final experience matches the pre-test state, then
   record a redacted checkpoint and stop.

Interpret the result only after the pilot: (A) Plan removal fully denies
access and normal ALLOWED recovery restores the same identity, so the target
Plan is a viable migration control; (B) another Plan or exceptional Space/
staff access remains, so classify that overlap separately; or (C) the provider
cannot prove the boundary, so use a controlled manual transition. No result
authorizes a population-wide change.

## Historical status — superseded; do not execute

Earlier population snapshots are retained only as historical audit context and
are not a current roster. They were not refreshed in this phase. Automated
revocation and population-wide normalization remain disabled; any future
action requires new owner authorization naming exact identities and scope.
