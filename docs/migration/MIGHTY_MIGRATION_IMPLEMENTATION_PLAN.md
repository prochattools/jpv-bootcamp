# JPV Bootcamp Mighty Migration Implementation Plan

**Status:** Feature branch pushed; bounded live provider acceptance passed; cutover remains separately unauthorized
**Date:** 2026-09-09  
**Branch:** `feature/mighty-stripe-migration`  
**Implementation commit:** `873c8f82`
**Production baseline tag:** `pre-mighty-migration-2026-09-09`

## Current acceptance evidence — 2026-09-10

- The bounded live acceptance passed against the existing JPV Mighty Network
  for the authorized operator-controlled test identity only. It reused the
  existing member, verified grant by a separate read, proved repeated-grant
  idempotency, verified revoke by a separate read, proved repeated revoke was
  safe, restored access, and verified the final access state. The identity is
  left restored in Plan `2000039`.
- The acceptance initially exposed that this non-paid access-only Plan has no
  purchase row. The provider client now verifies member Plan membership through
  `/members/{member_id}/plans` and revokes through the documented
  `/plans/{plan_id}/members/{id}/` DELETE endpoint. No provider billing was
  introduced.

- The implementation branch is pushed to `origin` through
  `873c8f82`.
- The annotated baseline tag is pushed to `origin` and resolves to
  `a287800735d465a41ad9e45d2c7914ab9cc34a26`.
- The owner has manually created the hidden, non-paid, access-only JPV member
  Plan. The application does not create or configure this provider object.
- A read-only provider lookup using the production Dokploy credentials
  authenticated successfully and confirmed Plan `2000039` as `JPV Member
  Access`, hidden, and non-paid. No credential or Network ID is recorded in
  Git.
- The production Dokploy inspection still returns legacy endpoint values:
  `MIGHTY_API_BASE_URL` points at a `/networks/.../me` resource rather than the
  Admin API base, and `MIGHTY_STUDENT_LOGIN_URL` points at a landing URL rather
  than the canonical `/sign_in` URL. The live acceptance used the canonical
  values in memory and did not rewrite Dokploy. Correct these two values before
  deployment or worker enablement.
- The corrected read-only production roster audit completed without mutation:
  6 active Stripe provisioning records were found and all 6 require manual
  review because `subscriptionStatus` is missing; Mighty reports 9 members,
  0 Plan purchases, and 9 direct members without a Plan. No normalization was
  performed.
- The local `.env` and `.env.production` contain no configured Mighty values;
  only `.env.example` contains placeholders. No secret values are recorded.
- The guarded real-network command passed with the production mutation guard
  and left the authorized test identity restored. No real student was touched.
- The read-only roster bridge was attempted and stopped because its local
  database target at `localhost:5444` was unavailable. No production database
  was contacted and no records were changed.
- The read-only configuration check is available as `pnpm mighty:config-check`.
  It reports only PRESENT/MISSING/INVALID states, never secret values, and
  identifies a configured Plan ID as requiring provider lookup rather than
  treating it as proof that a real access Plan exists. It does not report
  acceptance readiness until that provider verification is complete.
- The worker route has local runtime coverage for missing-secret,
  unauthorized-token, and malformed-request fail-closed behavior. No worker
  request was sent to a deployed application.
- The read-only `pnpm mighty:manual-access-audit` command is implemented. It
  compares all Mighty members, member Plan memberships, and purchases with
  Stripe-entitled records and reports aggregate direct/overlapping-access risk
  without mutation. The post-acceptance audit found 6 active Stripe records,
  all requiring manual review because subscription status is missing; Mighty
  reported 9 members, 0 purchase rows, 8 direct no-Plan members, and 1
  non-entitled member with Plan `2000039` (the authorized test identity).
- Mighty API requests include the required identifying `User-Agent` header for
  the provider’s bot-protection boundary.

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
| M4 | Stripe event → durable Mighty desired-state projection | **Implemented locally; event ordering and terminal-state guards included** |
| M5 | Durable worker, retries, stable IDs, access reconciliation, welcome ordering | **Implemented locally; production scheduler workflow defined; worker not live-exercised** |
| M6 | Read-only entitled-member bridge for controlled manual migration | **Implemented locally** |
| M7 | Focused regression tests and validation matrix | **Local focused matrix green; provider/live checks remain cutover gates** |
| M8 | Staging configuration and controlled provider/API verification | **Skipped for this implementation lane; staging remains unchanged** |
| M9 | Production cutover readiness, rollback, and go/no-go | **Not started / not authorized** |

## Approved execution sequence

1. Keep existing Stripe Products, Prices, subscriptions, Checkout, webhooks,
   support, sponsored membership, and operator/admin paths unchanged.
2. Configure the existing Mighty Network and non-paid JPV access Plan outside
   Git. Record only redacted presence/ownership evidence.
3. Run the read-only entitled roster bridge and manually add existing members
   under an operator-owned procedure.
   Before enabling automatic revocation, run the read-only manual-access audit
   and follow `docs/migration/MIGHTY_MANUAL_ACCESS_NORMALIZATION.md`; removing
   Plan `2000039` alone is insufficient when another Plan or direct membership
   grants access.
4. Validate the worker against a non-production Mighty Network or an approved
   controlled test account when one is available. Confirm create/reuse, grant,
   restore, immediate revoke, retry, and welcome ordering.
   For the real JPV Network, the bounded command is
   `pnpm mighty:production-acceptance`; it requires
   `MIGHTY_PROVIDER_ENV=production`, `MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS=true`,
   and one disposable `MIGHTY_PRODUCTION_TEST_EMAIL`.
   Run `pnpm mighty:config-check` first when the Plan is not yet configured;
   the rest of the worker and configuration checks do not require a live Plan.
5. Configure a scheduled worker call to
   `POST /api/admin/process-mighty-access-sync` with the dedicated worker
   secret. The Stripe webhook itself must never call Mighty synchronously.
6. Complete the focused validation matrix, production configuration review,
   support/admin regression, rollback rehearsal, and go/no-go review. A
   separate staging deployment is not required for this feature-branch lane.
7. Only after a separate authorization may the controlled cutover be deployed.

## Worker execution and scheduling

The worker is an authenticated `POST /api/admin/process-mighty-access-sync`
route. The production scheduler workflow is
`.github/workflows/mighty-access-sync.yml`; it runs every five minutes,
targets only `https://jpvbootcamp.com`, uses the GitHub environment
`production-mighty-sync`, and reads only the
`MIGHTY_ACCESS_SYNC_WORKER_SECRET` environment secret. It is inert until the
feature branch is merged, the worker secret is configured, and the GitHub
environment variable `MIGHTY_ACCESS_SYNC_ENABLED` is explicitly set to the
exact value `true`. Manual dispatch additionally requires selecting
`run_production_sync=yes`; the default is `no`.

The fixed staging scheduler is
`.github/workflows/staging-mighty-access-sync.yml`, which runs every five
minutes, targets only `https://staging.jpvbootcamp.com`, uses the GitHub
environment `staging-mighty-sync`, and reads only the
`MIGHTY_ACCESS_SYNC_WORKER_SECRET` environment secret. It has a non-overlapping
concurrency group and a five-minute timeout. A manual workflow dispatch is
available for controlled staging verification.

Each run claims up to 100 due rows with a five-minute lease. Successful rows
record provider IDs, success, and reconciliation timestamps. Failures record a
safe error code, increment the attempt count, clear the lease, and retry with
exponential backoff capped at one hour. Reconciliation always reuses the stored
Mighty member ID when present, discovers existing Plan purchases before granting,
and treats an absent purchase on revoke as idempotent. The staging scheduler is
retained as-is for the existing staging lane; it is not a prerequisite for the
production feature-branch cutover.

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

1. Verify the intended operator-owned environment and read-only database boundary.
2. Run `pnpm mighty:bridge-roster` and record the aggregate expected-member count without exporting data.
3. Have a second authorized reviewer compare the count and the active-subscription/payment-state criteria.
4. If a transfer roster is required, run the command with `--format=csv` only
   to a secure location outside the repository and shared logs.
5. An authorized operator adds existing subscribers to the pre-created Mighty
   Network/access Plan and records only aggregate success/failure evidence.
6. Retry only failed rows after resolving the recorded safe error; do not rerun
   a full export. Match by normalized email and existing Mighty member ID before
   any retry, and stop on an identity conflict.
7. Do not change Stripe subscriptions, Stripe products/prices, or local billing
   state as part of this bridge.

## Production cutover checklist

Complete these items only under the separate production deployment and go/no-go
authorization:

1. Configure the production application `clients-jpv-bootcamp-app-tp9xrk` with
   the six required Mighty-related values: exact Admin API base URL
   (`https://api.mn.co/admin/v1`), Network ID, the real existing non-paid JPV
   access Plan ID, Admin API token, canonical student login URL, and the worker
   secret. Keep values out of Git, logs, and documentation.
2. Configure the same worker secret in the GitHub environment
   `production-mighty-sync` used by
   `.github/workflows/mighty-access-sync.yml`.
3. Leave `MIGHTY_ACCESS_SYNC_ENABLED` unset until the cutover is authorized;
   the single scheduler-enabling action is setting that production environment
   variable to the exact value `true`.
4. Apply the committed Prisma migrations through the normal controlled
   production deployment path; do not run ad-hoc destructive SQL.
5. Deploy the reviewed feature branch and verify `/api/health`, webhook
   delivery, queue creation, authenticated worker processing, retry behavior,
   and the exact Sign In/Join behavior.
6. Run the read-only roster bridge, reconcile aggregate counts, and manually
   provision existing paid members before relying on automatic new-member
   provisioning.
7. Monitor Stripe delivery failures, queue failures, Mighty API errors, and
   access-denial/grant aggregates. Record the go/no-go decision and operator.

## Rollback procedure

If the cutover is unhealthy, disable the production scheduler workflow first,
then roll the application back to `pre-mighty-migration-2026-09-09` through the
normal deployment controls. Stripe remains the billing authority and existing
Stripe subscriptions are not changed. Keep the legacy portal path available
for support and recovery. Do not automatically mutate Mighty memberships or
delete queue history during rollback; review any provider access corrections
as a separate, explicitly authorized operator action.

## Missing before controlled cutover

- Secure execution access to the existing Mighty Network ID and Admin API token;
  the owner-confirmed non-paid JPV access Plan is `2000039`.
- Dedicated Admin API token owner, rotation policy, and target environment.
- Production application worker secret and GitHub `production-mighty-sync`
  scheduled-execution secret/owner.
- Correct the two legacy endpoint values still returned by the production
  Dokploy application: `MIGHTY_API_BASE_URL=https://api.mn.co/admin/v1` and
  `MIGHTY_STUDENT_LOGIN_URL=https://jpv-community.mn.co/sign_in?from=https%3A%2F%2Fjpv-community.mn.co%2F`.
- Secure manual roster execution and aggregate reconciliation evidence.
- Production verification for billing, support, sponsored membership,
  operator/admin, and the cutover/rollback routes.
- Separate production deployment, migration, data, and go/no-go authorization.
