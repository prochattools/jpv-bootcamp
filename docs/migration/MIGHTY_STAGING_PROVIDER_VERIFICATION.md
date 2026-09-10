# JPV Mighty Staging Provider Verification

**Date:** 2026-09-09  
**Scope:** Non-production Mighty API and Stripe-to-Mighty verification only  
**Status:** BLOCKED — staging configuration is present, but the API base, deployed image, and access Plan are not ready

## Safety boundary

This report contains no credentials, member emails, roster rows, or production
provider identifiers. No live Stripe subscription was changed, no real student
was provisioned, no production deployment occurred, and no production database
was mutated.

## Configuration evidence

| Check | Result |
| --- | --- |
| Local process environment | All six `MIGHTY_*` variables not configured |
| Repository `.env*` files | No configured Mighty values; `.env.example` contains empty placeholders only |
| Canonical staging Dokploy application | Read-only `application.one` returned HTTP 200; all six Mighty variable names are present; values are operator-managed and not recorded here |
| GitHub staging scheduler environment | Read-only secret metadata lookup returned HTTP 404; `staging-mighty-sync` is not configured |
| Canonical production application | Read-only health/configuration inspection; baseline image remains deployed; no values recorded |

The configured staging `MIGHTY_API_BASE_URL` is a branded Network URL that
redirects to the public landing page. A read-only check against the official
Admin API base `https://api.mn.co/admin/v1`, using the configured Network and
token, returned HTTP 200. That Network currently returns zero Plans. The
configured access Plan value is therefore still a placeholder and cannot be
used for acceptance.

The staging health endpoint is live, but reports image/commit
`8b1f459fed358776fda791553ef225cc9f03b2ae`. That image predates this migration
branch and does not contain the Mighty worker route, access-sync implementation,
or acceptance harness. Environment configuration alone has not deployed the
Mighty integration code.

The production health endpoint was also queried read-only and reports the
baseline image/commit `a287800735d465a41ad9e45d2c7914ab9cc34a26` with
`deploymentEnv=production`. The production Dokploy environment contains the
Mighty variable names, but this verification did not reveal or use their
values, call the Mighty API, mutate production data, or deploy the feature
branch.

Required non-production values are `MIGHTY_API_BASE_URL`,
`MIGHTY_NETWORK_ID`, `MIGHTY_ACCESS_PLAN_ID`, `MIGHTY_ADMIN_API_TOKEN`,
`MIGHTY_STUDENT_LOGIN_URL`, and `MIGHTY_ACCESS_SYNC_WORKER_SECRET`.

## Scheduler evidence

Read-only `schedule.list` for the canonical staging application returned HTTP
200 and no matching Mighty/JPV schedule. The repository now defines the fixed
staging scheduler in
`.github/workflows/staging-mighty-access-sync.yml`: every five minutes,
non-overlapping, fixed to `https://staging.jpvbootcamp.com`, with a dedicated
environment secret and no target override. The workflow is not active until the
`staging-mighty-sync` GitHub environment and secret are created through the
non-production operator path.

## Acceptance matrix

| Acceptance item | Result | Evidence/status |
| --- | --- | --- |
| Create/find one disposable Mighty member | Pending | Blocked by missing config |
| Grant existing JPV access Plan | Pending | Blocked by missing config |
| Repeat grant without duplicate access | Pending | Bounded harness ready |
| Remove access immediately | Pending | Bounded harness ready |
| Restore access | Pending | Bounded harness ready |
| Changed email preserves stable Mighty identity | Pending | Stored member-ID path implemented and harness ready |
| Stripe test successful checkout lifecycle | Pending | Requires configured staging application and test-mode webhook path |
| `invoice.payment_failed` immediate denial/revocation | Pending | Local contract tests pass; real staging execution pending |
| `invoice.paid` restoration | Pending | Local contract tests pass; real staging execution pending |
| `cancel_at_period_end` retention | Pending | Local contract tests pass; real staging execution pending |
| Duplicate webhook delivery | Pending | Local contract tests pass; real staging execution pending |

## How to execute after configuration

1. Configure the six required values only in the non-production staging
   application environment and add the worker secret to the GitHub environment
   `staging-mighty-sync`. Do not place values in GitHub workflow text, Git, or
   shared evidence.
2. Supply two operator-controlled disposable test identities through
   `MIGHTY_STAGING_TEST_EMAIL` and `MIGHTY_STAGING_TEST_EMAIL_CHANGED`.
3. Run with `MIGHTY_PROVIDER_ENV=staging` and
   `MIGHTY_STAGING_ALLOW_API_MUTATIONS=true`:

   ```bash
   pnpm mighty:staging-acceptance
   ```

   The harness requires the first identity to be absent, verifies create/find,
   grant, repeated grant, revoke, restore, and stable member-ID reuse after an
   application email change, then removes disposable Plan access.
4. Use Stripe test mode only for the lifecycle scenarios. Exercise the staging
   webhook/application and allow the scheduled worker to reconcile the queue.
   Record only aggregate outcomes, event types, safe error codes, counts, and
   timestamps.
5. Attach the sanitized workflow response and staging application logs to the
   operator evidence packet. Never attach request headers, environment dumps,
   emails, or raw provider payloads.

## Manual migration checklist

- [ ] Confirm the target is staging/non-production and the database query is read-only.
- [ ] Run `pnpm mighty:bridge-roster` and record the aggregate entitled count.
- [ ] Have a second reviewer confirm active/trialing subscription status and payment-state exclusions.
- [ ] If needed, create a secure roster outside Git/shared logs using `--format=csv`.
- [ ] Match existing members by normalized email and retain the Mighty member ID.
- [ ] Add only to the pre-created non-paid JPV access Plan; do not create billing objects.
- [ ] Record aggregate added/skipped/failed counts and safe failure reasons.
- [ ] Retry failed rows individually after resolving the reason; stop on identity conflicts.
- [ ] Re-run the read-only count and reconcile aggregate totals.

## Current blocker and exit criteria

The provider test cannot be truthfully marked successful until the operator
sets the official Admin API base, creates the non-paid JPV access Plan and
supplies its ID, creates the `staging-mighty-sync` GitHub environment, provides
disposable identities, and deploys this migration branch to staging. Exit
requires successful real API results for all six Mighty checks,
Stripe test-mode lifecycle evidence, scheduled worker evidence, and this report
updated with aggregate results only.

Official API references: [Mighty Admin API](https://docs.mightynetworks.com/admin-api),
[create member](https://docs.mightynetworks.com/api-reference/members/create-a-new-member-in-the-network),
[list members](https://docs.mightynetworks.com/api-reference/members/return-members-of-the-given-network),
[grant direct non-paid Plan access](https://docs.mightynetworks.com/api-reference/members/add-a-member-directly-to-a-freenonpaid-plan-granting-them-accessthe-member-will-be-granted-access-immediately%3B-no-invite-is-sent),
[list purchases](https://docs.mightynetworks.com/api-reference/purchases/return-purchases-and-subscriptions-for-the-given-network), and
[revoke purchase access](https://docs.mightynetworks.com/api-reference/purchases/remove-a-member-from-a-plan-revoke-purchase-access-note%3A-cannot-remove-members-from-apple-in-app-purchases).
