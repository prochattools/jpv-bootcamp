# JPV Bootcamp Stripe → Mighty Architecture

**Status:** Approved migration architecture; implementation started on
`feature/mighty-stripe-migration`  
**Date:** 2026-09-09  
**Production billing authority:** Existing Stripe integration  
**Student platform target:** Mighty Networks

## Current implementation gate — inert-deployment readiness — 2026-09-11

Phase D and E0 evidence are complete. The current branch work is integration
hardening and inert-deployment validation only. The three-account integration
gate and inert-deployment readiness gate pass. No real member population is
being migrated, no Stripe object is being changed, the production scheduler
remains disabled, and this work is not being deployed or merged.

The only live mutation identities permitted by the bounded acceptance are
`westhoek@hotmail.com` (ordinary), `steve@yeshua.academy` (administrator), and
`info@prochat.tools` (owner/Host). All other members—including the historical
proposed `Missaquadri@gmail.com` candidate—remain untouched and unauthorized.
Provider role `null` is not inferred to mean ordinary; unresolved roles,
Hosts, administrators, unexpected Spaces, and other Plan overlaps fail closed
to review.

The complete inert-deployment trigger audit, owner checklist, smoke-test design,
rollback procedure, and call graph are canonical in
`docs/release/MIGHTY_INERT_DEPLOYMENT_READINESS.md`. That document overrides
older future-migration execution prose below until a new owner authorization is
recorded.

## Canonical decision

Stripe remains the sole billing authority. Existing Stripe products, prices,
subscriptions, Checkout, webhooks, support, sponsored membership, public sales,
and operator/admin workflows remain in place. No Stripe membership is recreated,
and Mighty billing or native Mighty checkout is not enabled.

Mighty owns the student-facing account and learning experience: student login,
profile, courses, progress, community, Spaces, and member-facing content. The
existing custom student portal remains available during the controlled
cutover-preparation phase, but it is no longer the target student destination.
Payload remains an internal/operator system for the functionality that still
uses it; it is not the future student-facing course/community authority.

## Runtime flow (future worker model; currently inert)

```text
Public website
    ├── Sign In → https://jpv-community.mn.co/sign_in?from=...
    └── Join → existing #pricing → existing monthly/annual Stripe Checkout
                                      │
                                      ▼
                         existing JPV Stripe webhook/application
                                      │
                                      ▼
                    one canonical Stripe-derived local Mighty desired-state row
                                      │
                                      ▼
                    authenticated Mighty Admin API worker
                                      │
                                      ├── resolve one Mighty member by normalized email/ID
                                      ├── grant existing non-paid JPV access Plan
                                      └── revoke/restore only the target Plan from Stripe state
```

The webhook persists the desired state locally and does not synchronously call
Mighty. Provider outage therefore cannot corrupt Stripe webhook processing or
cause duplicate provider writes. The worker owns retries and reconciliation.

`deriveMightyDesiredAccess` is the canonical entitlement function used by
Stripe event projection and the entitlement summary. It has an explicit
`ALLOWED`/`DENIED` state machine: active/trialing paid state and confirmed
payment recovery allow access; failed/action-required/refunded/disputed or
ended subscription state denies access immediately; scheduled cancellation
does not deny access before the paid period ends.

The staging worker is scheduled by
`.github/workflows/staging-mighty-access-sync.yml`. It runs every five minutes
against the fixed `https://staging.jpvbootcamp.com` origin, uses the dedicated
`staging-mighty-sync` environment secret, and never accepts a target URL input.
The production schedule remains a separate, future, explicitly authorized
cutover task.

## Mighty API contract

The implementation uses the documented Mighty Admin API operations only:

- `GET /admin/v1/networks/{network_id}/members/by_email?email={email}` to
  resolve exactly one normalized email; network-wide member enumeration is not
  part of the current implementation;
- `POST /admin/v1/networks/{network_id}/members` with
  `send_welcome_email: false` when a member is absent;
- `POST /admin/v1/networks/{network_id}/plans/{plan_id}/members?user_id={id}`
  to grant an existing free/non-paid access Plan immediately, without an
  invitation;
- `GET /admin/v1/networks/{network_id}/members/{member_id}/plans` to verify
  target Plan membership independently;
- `GET /admin/v1/networks/{network_id}/purchases?member_id={id}&plan_id={id}`
  to inspect any legacy purchase overlap;
- `DELETE /admin/v1/networks/{network_id}/plans/{plan_id}/members/{id}/` to
  remove the target Plan membership immediately after a failed payment or an
  ended subscription. Legacy target-plan purchase rows are removed only when
  present; other Plans, direct membership, Spaces, profiles, history, and
  accounts are not deleted.

The access Plan must already exist in Mighty. The application never creates or
archives a production Network, Space, Plan, or billing object.

## Configuration boundary

Production configuration is environment-only and fails closed when any value is
missing or invalid:

| Variable | Meaning |
| --- | --- |
| `MIGHTY_API_BASE_URL` | Documented Admin API base, normally `https://api.mn.co/admin/v1` |
| `MIGHTY_NETWORK_ID` | Existing Mighty Network ID or supported network identifier |
| `MIGHTY_ACCESS_PLAN_ID` | Existing non-paid JPV access Plan ID |
| `MIGHTY_ADMIN_API_TOKEN` | Secret Admin API bearer token |
| `MIGHTY_STUDENT_LOGIN_URL` | Canonical student sign-in URL |
| `MIGHTY_ACCESS_SYNC_WORKER_SECRET` | Dedicated secret for the reconciliation worker route |

No live Mighty credentials, Network ID, or Plan ID are stored in Git, tests,
logs, or documentation.

## Stripe event policy

| Stripe event | Desired Mighty state | Notes |
| --- | --- | --- |
| Confirmed paid subscription Checkout | `ALLOWED` | Existing member is reused; absent member is created with no Mighty welcome email; access is granted before JPV welcome/login email. |
| `invoice.paid` | `ALLOWED` | Restores access after recovery. |
| `invoice.payment_failed` | `DENIED` | Immediate removal; no grace period. |
| `customer.subscription.deleted` | `DENIED` | Immediate removal for an actually ended subscription. |
| Scheduled cancellation (`cancel_at_period_end`) | unchanged/`ALLOWED` | Access remains until the paid period ends. |
| Duplicate/replayed Stripe delivery | same desired state | Local Stripe idempotency plus provider-side member/purchase discovery prevents duplicate grants. |

The worker sends the existing application welcome/login email only after a
Mighty account exists and the access grant has succeeded. Failed email delivery
is retried without revoking already granted access.

Worker failures remain on the local row as a safe error code with an incremented
attempt count, lease cleared, and an exponential retry time capped at one hour.
The scheduled worker can be rerun safely because member and purchase discovery
precedes grant/revoke operations. A reconciliation pass may also be invoked
manually through the same authenticated staging endpoint.

Live mutation scope is enforced in production and staging. The allowlist,
explicit role override, and new-member guard must permit a mutation; a missing
provider role is review-only. A duplicate Plan-assignment 422 is accepted only
when its provider error evidence is explicitly duplicate-related and an
independent Plan/access read proves the desired state. Successful and failed
reconciliations emit sanitized row/action/result/error evidence.

## Durable state

`jpvbootcamp.mighty_access_sync` is the local outbox/reconciliation record. It
stores the normalized email, Stripe customer/subscription/event relationship,
desired access (`ALLOWED`/`DENIED`), stable Mighty member and purchase IDs,
welcome state, attempt count, lease, next retry, last error, last success, and
last reconciliation timestamps. It is not a second billing ledger.

The existing `CustomerProvisioning` projection remains the source for Stripe
identity and membership state. The new table stores only the downstream Mighty
desired state and provider mapping needed to reconcile it safely.

## Cutover boundary

- The public Sign In action and `/sign-in`/`/login` compatibility routes target
  Mighty.
- Join remains the existing `#pricing` flow and existing Stripe monthly/annual
  Checkout.
- Support, sponsored membership, pay-it-forward, public sales, Stripe billing,
  and operator/admin access remain unchanged.
- The old portal is not deleted in this migration branch. Its remaining
  entrypoints are retained for rollback, operator functions, existing email
  links, and controlled cutover testing until a separately approved retirement.
- Courses/content/community history, LiveKit, Bunny, SSO, white-labeling,
  affiliate redesign, and Payload removal are outside this migration.

## FUTURE / OWNER-AUTHORIZED ONLY — Manual existing-member bridge (not current)

`pnpm mighty:bridge-roster` performs a read-only query of currently entitled
Stripe-projected subscribers. It prints only a count by default. An operator
may explicitly request `--format=csv` for a secure local transfer; that output
contains customer contact data and must remain outside the repository, logs,
commits, and shared evidence. The tool performs no Stripe or Mighty mutation.

Existing subscribers can eventually be added to the already-created Mighty
Network and access Plan through a separately controlled operator procedure.
Automatic provisioning is not considered complete until the live
Network/Plan IDs, credential ownership, per-identity role/overlap manifest,
and future owner go/no-go approval are complete. The current read-only dry run
classifies rows as in-sync, Plan grant/revoke needed, identity review,
privileged excluded, overlap review, or provider error; it performs no writes.

## FUTURE / SEPARATE NON-PRODUCTION WORK — Staging verification harness

After a disposable test identity and non-production configuration are supplied,
`pnpm mighty:staging-acceptance` runs the bounded create/find, grant, repeated
grant, immediate revoke, restore, and changed-email/stable-member-ID checks.
It requires `MIGHTY_PROVIDER_ENV=staging` and the explicit
`MIGHTY_STAGING_ALLOW_API_MUTATIONS=true` guard. The script cleans up the test
Plan access before returning success and emits aggregate evidence only.

## References

- [Mighty Admin API](https://docs.mightynetworks.com/admin-api)
- [Create a member](https://docs.mightynetworks.com/api-reference/members/create-a-new-member-in-the-network)
- [List members](https://docs.mightynetworks.com/api-reference/members/return-members-of-the-given-network)
- [Grant direct non-paid Plan access](https://docs.mightynetworks.com/api-reference/members/add-a-member-directly-to-a-freenonpaid-plan-granting-them-accessthe-member-will-be-granted-access-immediately%3B-no-invite-is-sent)
- [List purchases](https://docs.mightynetworks.com/api-reference/purchases/return-purchases-and-subscriptions-for-the-given-network)
- [Revoke purchase access](https://docs.mightynetworks.com/api-reference/purchases/remove-a-member-from-a-plan-revoke-purchase-access-note%3A-cannot-remove-members-from-apple-in-app-purchases)
