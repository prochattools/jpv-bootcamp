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

## Current Phase E0 manifest — 2026-09-10

The authoritative deployed identity-dry-run ran in live Stripe mode and found
17 active subscriptions, all matched to active Payload members:
`ALLOWED: 17`, `DENIED: 0`, `AMBIGUOUS: 0`, `UNMATCHED: 0`. No member, Stripe
object, scheduler, deployment, or merge was changed.

The read-only Mighty inventory classified the current Stripe-ALLOWED set as:

| Classification | Identities |
| --- | --- |
| `PHASE_D_CANARY_COMPLETE` | `westhoek@hotmail.com` / Mighty `41580317` |
| `OWNER_OR_ADMIN_EXCLUDED` | `steve@yeshua.academy` / Mighty `41580680` |
| `ELIGIBLE_ORDINARY_BATCH_CANDIDATE` | `Missaquadri@gmail.com` / `41567828`; `adaumoudit@gmail.com` / `41566725`; `amechiclarangozi2022@gmail.com` / `41567964`; `happyalamss@gmail.com` / `41566259`; `ronyaa@live.co.uk` / `41568214`; `Katherinecd7@yahoo.com` / `41585608` |
| `PRIVILEGED_OR_EXCEPTION_ACCESS_REVIEW` | `tosinotubanjo@gmail.com` / `41582168` — extra `FIRST FOUNDATION` Space |
| `IDENTITY_MISMATCH_REVIEW` | `anita13steve@gmail.com`, `info@yeshua.academy`, `kem.okupa@gmail.com`, `marek_bed@yahoo.com`, `nsgonza2@gmail.com`, `prince.okoroego@gmail.com`, `samuel.roy.edward.hill@gmail.com`, `vimbaimt@gmail.com` |
| `OTHER_PLAN_OVERLAP_REVIEW` | None observed |
| `DUPLICATE_IDENTITY_REVIEW` | None observed; masked email-prefix collisions are not duplicate proof |

The smallest proposed next batch is one identity only:
`Missaquadri@gmail.com` / Mighty `41567828`. It is a full member with the five
standard JPV Spaces, zero Plans and purchases, and no known privilege
exception. It remains unmodified. Fresh owner authorization naming this exact
identity is required before granting Plan `2000039`.

The older six-record unmatched snapshot is historical. The two records cannot
be named from that redacted evidence, while the current authoritative live set
has zero unmatched and zero ambiguous identities. The eight current exact
Mighty misses remain excluded; no account creation is implied by this report.

## Current Phase D ordinary-member canary result — 2026-09-10

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
4. For Stripe-entitled members, grant Plan `2000039` where absent and record
   the member as `PLAN_CONTROLLED`. Preserve approved staff, sponsor, creator,
   or other documented exceptions separately.
5. Do not separately delete legacy direct Network membership as part of this
   migration. Continue to audit overlapping non-target Plans, exceptional
   Space grants, and staff/admin access; obtain explicit approval before
   removing any such alternate access path.
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

## Current status

The older pre-acceptance audit found six active provisioning records with
missing local subscription status; that snapshot is retained as historical
evidence only. The current authoritative live identity-dry-run resolves all
17 active Stripe subscriptions with no unmatched or ambiguous identity. The
Phase D canary remains restored, and no additional real member has been
migrated. Phase E0 prepared one proposed next batch row,
`Missaquadri@gmail.com` / Mighty `41567828`, but did not execute it.

Before that row is touched, obtain fresh owner authorization for that exact
identity, record a run ID and checkpoint, re-read Stripe and Mighty state, and
then use the existing Plan-only grant/verify path. Stop on any identity,
Plan, Space, privilege, or provider-state discrepancy. Automated revocation
and population-wide normalization remain disabled.
