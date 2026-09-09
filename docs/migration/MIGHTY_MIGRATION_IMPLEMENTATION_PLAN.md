# JPV Bootcamp Mighty Migration Implementation Plan

**Status:** Approved plan; implementation in progress  
**Date:** 2026-09-09  
**Branch:** `feature/mighty-stripe-migration`  
**Production baseline tag:** `pre-mighty-migration-2026-09-09`

## Guardrails

This plan preserves the current production Stripe billing system and makes no
production deployment, production database mutation, provider production-object
creation, subscription recreation, or merge authorization. Stripe remains the
only billing authority. Mighty access is a downstream entitlement projection.

No invitation workflow is used for automatic provisioning. The application
creates a Mighty member directly when absent, grants the existing access Plan,
and sends the existing JPV welcome/login email only after the grant succeeds.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| M0 | Preserve production baseline, tag it, branch from synchronized `main`, record decisions | **Complete** |
| M1 | Typed environment/config boundary and canonical student-login target | **Implemented locally; live config missing** |
| M2 | Bounded Mighty Admin API client and documented member/access operations | **Implemented and focused-tested** |
| M3 | Website Sign In cutover support, Join preservation, safe legacy redirects | **Implemented locally** |
| M4 | Stripe event → durable Mighty desired-state projection | **Implemented locally** |
| M5 | Durable worker, retries, stable IDs, access reconciliation, welcome ordering | **Implemented locally; worker not live-exercised** |
| M6 | Read-only entitled-member bridge for controlled manual migration | **Implemented locally** |
| M7 | Focused regression tests and validation matrix | **Initial tests green; full matrix pending** |
| M8 | Staging configuration and controlled provider/API verification | **Blocked on operator-owned Mighty configuration** |
| M9 | Production cutover readiness, rollback, and go/no-go | **Not started / not authorized** |

## Approved execution sequence

1. Keep existing Stripe Products, Prices, subscriptions, Checkout, webhooks,
   support, sponsored membership, and operator/admin paths unchanged.
2. Configure the existing Mighty Network and non-paid JPV access Plan outside
   Git. Record only redacted presence/ownership evidence.
3. Run the read-only entitled roster bridge and manually add existing members
   under an operator-owned procedure.
4. Validate the worker against a non-production Mighty Network or an approved
   controlled test account. Confirm create/reuse, grant, restore, immediate
   revoke, retry, and welcome ordering.
5. Configure a scheduled worker call to
   `POST /api/admin/process-mighty-access-sync` with the dedicated worker
   secret. The Stripe webhook itself must never call Mighty synchronously.
6. Complete the focused validation matrix, exact-SHA staging verification,
   support/admin regression, rollback rehearsal, and go/no-go review.
7. Only after a separate authorization may the controlled cutover be deployed.

## Focused validation matrix

- Sign In points at the canonical Mighty URL.
- Join still reaches the current pricing section.
- Monthly checkout remains the existing Stripe Checkout route.
- Annual checkout remains the existing Stripe Checkout route.
- Support flow remains available.
- Sponsored/pay-it-forward flow remains available.
- Confirmed new paid subscription creates one `ALLOWED` desired grant.
- Duplicate/replayed Stripe delivery does not create a duplicate access grant.
- Existing Mighty member is reused by normalized email.
- Missing Mighty member is created without a Mighty invitation or welcome email.
- Welcome/login email is attempted only after the access grant succeeds.
- `invoice.payment_failed` records immediate `DENIED` state.
- Revoke is immediate and idempotent when the purchase is already absent.
- Later `invoice.paid` records `ALLOWED` and restores access.
- `cancel_at_period_end` does not enqueue premature removal.
- Actual subscription end enqueues removal.
- Mighty outage leaves the Stripe webhook durable state intact and retryable.
- Failed provider reconciliation records attempt/error/next retry state.
- No native Mighty billing or new Stripe Product/Price is created.
- No custom Mighty course/community implementation is introduced in this
  migration branch.

## Manual bridge procedure

1. Verify the intended environment and read-only database boundary.
2. Run `pnpm mighty:bridge-roster` and review the count without exporting data.
3. If a transfer roster is required, run the command with `--format=csv` only
   to a secure location outside the repository and shared logs.
4. An authorized operator adds existing subscribers to the pre-created Mighty
   Network/access Plan and records only aggregate success/failure evidence.
5. Do not change Stripe subscriptions, Stripe products/prices, or local billing
   state as part of this bridge.

## Missing before controlled cutover

- Existing Mighty Network ID and non-paid JPV access Plan ID.
- Dedicated Admin API token owner, rotation policy, and target environment.
- Worker secret and scheduled execution owner.
- Non-production or otherwise approved Mighty API verification evidence.
- Secure manual roster execution and aggregate reconciliation evidence.
- Exact-SHA staging acceptance for billing, support, sponsored membership,
  operator/admin, and the cutover/rollback routes.
- Separate production deployment, data, and go/no-go authorization.
