# Mighty Manual Access Normalization

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

## Current Phase D ordinary-member canary result — 2026-09-10

The owner-authorized canary for `westhoek@hotmail.com` was executed only for
that identity and is **BLOCKED**. Live Stripe inspection resolved exactly one
matching JPV customer with one active monthly JPV subscription, current period
ending `2026-09-23`, and a paid latest invoice; the effective Stripe
classification was `ALLOWED`. The existing Mighty identity was found and
reused as member ID `41580317`, `member_type=full`, with `Network Access:
Direct`, five direct Spaces (Activity Feed, Chat, Course, Events, and JPV
Resource Library), no Plan memberships, and no purchase rows. The Mighty admin
surface showed `Full Member`, not Host/Admin.

Plan `2000039` is hidden, non-paid, and configured for Network access only.
Mighty documents that Network access includes the entire Network and all
Spaces, so the scope is `PLAN_SCOPE_COMPLETE` for this member's five Spaces.
The API does not expose a separate per-Space bundle because one is not needed
for a full-Network Plan. No direct Space membership was removed.

The bounded Plan lifecycle was tested without normalization: grant returned
HTTP 200 and an independent read showed exactly one target Plan; the repeated
grant returned HTTP 422 with exact response `User already has access to this
plan`, and the independent read still showed exactly one target Plan.
Plan-only revoke returned HTTP 204, and subsequent Plan, Space, and member
lookups returned HTTP 404 while the admin UI reported that the person was no
longer a member. This matches Mighty’s documented behavior for removing a
non-paid Plan that includes Network access: the member loses Network access and
is removed from the active member list. No legacy/direct bypass was observed,
but this is not a nondestructive way to remove only the old direct Network
source.

The original account was restored without creating a duplicate: re-adding the
same email returned HTTP 201 with the original member ID and
`send_welcome_email=false`. The five original Space memberships were already
present after rejoin (direct-add retries returned "already a member"), and
independent reads plus the admin member list confirmed the same `Full Member`,
`Direct` access, five Spaces, zero Plans, and zero purchases. No profile,
content, or history operation was performed. The final state matches the
pre-canary state.

`NORMALIZATION BLOCKED`: the Plan scope is complete, but the member had legacy
direct Network access and Mighty exposes only the destructive Network-level
"Remove From Everything" operation for removing that source. The Plan-member
DELETE is an effective access denial, not a safe direct-source normalization
operation; restoring the member requires re-adding Network membership, which
recreates the legacy state. Effective denial was observed for the
pre-normalization state but was not accepted as a post-normalization proof.
No other member may be used for a follow-up batch until a nondestructive
normalization and rollback mechanism is resolved.

## Read-only audit

Run only from an approved production-data environment with:

```bash
MIGHTY_PROVIDER_ENV=production pnpm mighty:manual-access-audit
```

The command lists Mighty members, member Plan memberships, and network
purchases, compares normalized emails with currently entitled Stripe records,
and prints aggregate counts only. It also reports active Stripe provisioning records whose subscription
status or identity fields are incomplete, rather than silently treating them
as non-entitled. It performs no create, grant, revoke, delete, or update
operation. It requires the normal Mighty API configuration and the real Plan
ID, but does not require the worker secret or the production mutation guard.

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

## Controlled migration algorithm

The later member migration must accept one member or a small approved batch,
with a run ID and a durable checkpoint for each member. For each row it must:

1. Resolve a deterministic Stripe entitlement and stable customer/subscription
   identity.
2. Find the existing Mighty member by normalized email and stop on conflicts.
3. Read Network, Plan, and Space access before mutation.
4. Grant Plan `2000039` and verify it with an independent provider read.
5. Require explicit per-member or per-batch approval before removing any
   overlapping direct/other-Plan/Space access.
6. Verify expected access after normalization and record a redacted checkpoint.

The runner stops on the first error, resumes from the last confirmed
checkpoint, re-reads provider state before retries, and never creates duplicate
members. A failed or ambiguous row remains pending manual review; it is not
silently treated as denied. The final migration invariant is:

`Stripe ALLOWED → Plan 2000039 present → expected Mighty access`

`Stripe DENIED → Plan 2000039 absent → no paid JPV access through the
Plan-controlled path`

Direct Network/Space membership can still bypass that Plan invariant, so it
must remain a separately reviewed overlap until nondestructive removal is
proven safe. No routine billing enforcement may use ban, account deletion, or
“Remove From Everything.”

## Ordinary-member pilot — Phase D result and future procedure

The owner provided and authorized exactly one existing legitimate JPV member,
`westhoek@hotmail.com`. The canary result above is the canonical Phase D
evidence. Do not select or mutate another member automatically. The email is
the only member-selection input; it is not permission to test any other
identity.

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
6. Re-read Network, Space, and other-Plan access to detect any legacy direct
   bypass. Do not remove or ban that access during this pilot.
7. Restore Plan `2000039` and verify access is restored.
8. Confirm the member's final experience matches the pre-test state, then
   record a redacted checkpoint and stop.

Interpret the result only after the pilot: (A) Plan removal fully denies
access, so the target Plan is a viable migration control; (B) direct or other
access remains, so use the smallest nondestructive per-member normalization
approved after review; or (C) the provider cannot prove the boundary, so use a
controlled manual transition. No result authorizes a population-wide change.

## Current status

The pre-acceptance read-only audit ran against the production database and JPV
Mighty Network without mutation. It found 6 active Stripe provisioning records,
all 6 requiring manual review because `subscriptionStatus` is missing; Mighty
reported 9 members, 0 Plan purchases, 8 direct members without a Plan, and the
authorized owner identity in Plan `2000039`.
The authorized test identity was subsequently granted Plan `2000039` and is
kept restored; it is not part of the real member population. The audit now also
enumerates each member's Plan memberships so a nonpaid Plan grant cannot be
mistaken for a direct no-Plan member. Because the Stripe records are not
currently deterministically entitled, no real-member normalization or
revocation is authorized. Space-level membership remains a separate review
item.
