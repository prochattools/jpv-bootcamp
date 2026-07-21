# JPV Bootcamp Operator Execution Packet

**Packet ID:** OPERATOR-READY-2026-07-21  
**Branch:** `feature/course-branding-and-preview`  
**Formal state:** `NO-GO`

## Owner decision: staging credential exposure

The project owner decided on 2026-07-21 that historical exposure of a staging-only test credential is not a release blocker because the staging database contains no production data. No credential-remediation gate is required. Dated security reports remain historical evidence and must not be interpreted as current release status.

This decision does not authorize production credential exposure, production access, or any live mutation.

## Current evidence

- Local PR-readiness gates pass.
- Sixteen schema migrations are recorded as applied to staging.
- The 21-row legacy member/billing/access migration completed on staging in two idempotent runs with zero errors.
- Disposable rehearsal, rollback, and reapply evidence pass.
- Five next-domain migrations remain to be implemented or explicitly deferred.
- Provider verification, staging browser acceptance, and formal go-live approval remain open.

## Ordered remaining gates

1. Implement and test the approved next-domain migration tools using repository-owned schemas and fixtures.
2. Run read-only staging inventory queries when separately authorized; use the results to include or defer each domain.
3. Obtain approval for any genuinely pending staging schema migrations, including backup, maintenance window, verification, and rollback ownership.
4. Execute migrated-user invitation/reset onboarding when separately authorized.
5. Run provider verification with approved staging accounts and credentials.
6. Run staging browser acceptance.
7. Complete formal go/no-go review.
8. Perform production cutover only after explicit production authorization.

## Next-domain implementation scope

| ID | Domain | Local implementation may proceed | Live execution requirement |
| --- | --- | --- | --- |
| REM-03 | Sponsored grants/seats/applications | Yes, using fixtures and existing schema contracts | Read-only counts and migration apply require separate authorization |
| REM-04 | Email subscribers | Yes, using fixtures and existing schema contracts | Same |
| REM-05 | Support requests | Yes, using fixtures and existing schema contracts | Same |
| REM-06 | Partner attribution | Yes, but remains post-launch unless promoted | Same |
| REM-07 | Course enrollment/progress | Yes, using existing Payload collection contracts | Same |

All tools must be idempotent, redact PII from logs, preserve pre-existing destination rows, emit bounded reconciliation metrics, support dry-run, and include focused tests. No tool may run against staging or production merely because its local implementation is complete.

## Separate approvals still required

The following approvals are independent and must not be combined into blanket authorization:

- read-only staging inventory queries;
- backup and maintenance window;
- pending staging schema migrations;
- live next-domain migration applies;
- invitation/reset cohort execution;
- Stripe, email, and Bunny verification;
- staging browser smoke;
- formal go-live;
- production cutover.

## Stop conditions

Stop and report the exact blocker if:

- the target database/schema cannot be proven;
- a requested live action lacks its specific approval;
- source/destination schema differs from the reviewed contract;
- a dry-run or rehearsal reports errors, duplicates, destructive updates, or PII in logs;
- rollback ownership or backup evidence is missing for a write;
- a provider or browser acceptance check fails.

## Formal state

The staging credential exposure is removed from the blocker list. Formal state remains `NO-GO` until the remaining implementation, staging/provider acceptance, and explicit go-live gates pass.
