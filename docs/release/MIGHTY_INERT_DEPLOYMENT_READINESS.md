# Mighty Inert-Deployment Readiness

## Current release gate — 2026-09-11

`INERT PRODUCTION DEPLOYMENT: ACCEPTED`
`SYSTEM-LEVEL INERT PRODUCTION ACCEPTANCE: PASS`
`PRODUCTION-FREEZE SYNTHETIC HARDENING GATE: PASS`
`LIVE PROVIDER POST-DEPLOY MEMBER SMOKE: WAIVED BY OWNER`

The live platform is frozen for the current engineering goal. The controlling
freeze and synthetic evidence record is
`docs/release/MIGHTY_PRODUCTION_FREEZE_SYNTHETIC_HARDENING_2026-09-11.md`.
No live provider read, provider mutation, Stripe operation, population
inspection, production test data, worker execution, scheduler enablement,
configuration change, or deployment is authorized here.

The Stripe → Mighty integration is deployed to production as an inert
application revision and is accepted using system-level evidence. Population
inspection, migration, scheduler enablement, and live Stripe mutation remain
unauthorized. The owner explicitly waived live post-deployment Mighty member
reads because two non-mutating provider/UI scope incidents showed that even
apparently member-scoped views can expose unrelated identities. No further
provider/account read is part of this acceptance.

The only real identities permitted for this engineering gate are:

- `westhoek@hotmail.com`
- `steve@yeshua.academy`
- `info@prochat.tools`

All other identities use synthetic fixtures. The production scheduler remains
disabled and the three-account production mutation boundary remains mandatory.

## Feature-delta review

| Classification | Components | Inertness result |
| --- | --- | --- |
| Safe application logic | `src/lib/mighty/entitlement.ts`, `stripeEntitlementSummary.ts`, `eventMapping` logic, exact-email Admin API, guarded reconciliation | Stripe state is projected locally; provider writes require the central mutation scope and target Plan `2000039`. |
| Test-only logic | `src/lib/mighty/*.test.ts`, `scripts/mighty/*.test.ts`, migration contract tests | Synthetic fixtures cover unauthorized identities, overlap, replay/order, provider failures, runner checkpoints, and host protection. |
| Operator/migration tooling | `scripts/mighty/*`, cutover manifest/runner, package scripts | Explicit operator entry points only; no startup import or automatic population discovery. Production runner requires a bounded manifest and scope. |
| Runtime configuration | Mighty environment variables, Plan validation, worker secret, provider environment | Missing/invalid provider environment, mutation guard, or production Plan ID fails closed. Secrets are server-only and never printed. |
| Production triggers | Stripe webhook, worker route, GitHub schedule/manual dispatch | Webhook queues local desired state only. Worker requires its dedicated bearer secret, an enabled runtime scope, and exact allowlisted queue rows. Schedule requires repository variable `true`; manual dispatch requires `yes`. |
| Documentation | Current handoff, roadmap, architecture, migration notes, this gate | Population migration instructions are historical/future-only and cannot be mistaken for the current next action. |

## Mutation call graph

```text
Stripe POST /api/webhook/stripe
  -> Stripe signature + livemode/idempotency checks
  -> projectMightyAccessFromStripeEvent
  -> queueMightyAccessSync (local desired-state row only)
  -> no Mighty provider call

GitHub schedule (vars.MIGHTY_ACCESS_SYNC_ENABLED == 'true')
  or explicit workflow_dispatch (run_production_sync == 'yes')
  -> dedicated worker secret
  -> POST /api/admin/process-mighty-access-sync
  -> timing-safe bearer validation
  -> parseMightyConfig + assertMightyMutationRuntimeReady
  -> claim only rows whose normalized email is in the central allowlist
  -> reconcileAccess
  -> exact Mighty member lookup/member-scoped reads
  -> assertMightyMutationAllowed + identity/Host/overlap safety checks
  -> Plan 2000039 grant/revoke only
  -> independent verification and durable result

Future cutover runner with explicit manifest
  -> required non-empty manifest + bounded batch
  -> central mutation scope + exact identity validation
  -> checkpoint identity consistency
  -> provider adapter mutation only after all guards pass
```

There is no startup path from `start-production.sh`, `start-staging.sh`,
`payload.config.ts`, or normal Next.js initialization into Mighty queue
processing, reconciliation, cutover, member creation, Plan grant, or Plan
revoke.

## Historical owner deployment checklist

This checklist is review material, not deployment authorization.

1. Approve exact branch `feature/mighty-stripe-migration` and exact commit.
2. Confirm the complete release suite and production build are green.
3. Review the complete diff against current `main`; leave `newrelic_agent.log` untouched.
4. Confirm the hard production allowlist contains only the three authorized test identities.
5. Confirm population operations and migration runner execution are disabled.
6. Confirm `MIGHTY_ACCESS_SYNC_ENABLED` is absent or not equal to `true`.
7. Confirm no production migration manifest or population dry run is current.
8. Confirm the worker route requires the dedicated server-side worker secret.
9. Confirm the Admin API token and worker secret are present server-side only; do not print them.
10. Run a harmless provider connectivity check using exact allowed scope only.
11. Confirm no population enumeration, reconciliation, or mutation occurred.
12. Confirm the application rollback procedure and owner/operator are ready.
13. Record the approved revision and deployment evidence.
14. Schedule the three-account post-deploy smoke test before any later automation decision.

## Deferred provider smoke — not a current acceptance requirement

The owner has explicitly waived this live provider smoke for the current
deployment. Do not run it as a workaround or attempt to filter broad provider
responses. A future provider-read project would require separate explicit
authorization and a provider surface that proves account isolation. The
current acceptance instead uses:

- application health and exact deployed revision;
- static Plan `2000039` configuration and fail-closed tests without printing secrets;
- scheduler disabled;
- previously completed, authorized pre-deployment lifecycle and Host evidence;
- no population processing, queue worker run, migration, or fourth identity access.

## Application rollback procedure

1. Stop the deployment promotion and record the exact failing revision.
2. Revert the application revision to the last known-good production revision
   through the normal owner-approved deployment mechanism.
3. Leave Mighty environment values unchanged; do not rotate or print secrets as
   a rollback step.
4. Verify `MIGHTY_ACCESS_SYNC_ENABLED` remains absent or disabled and that no
   manual production workflow dispatch was run.
5. Verify no Mighty population migration, queue processing, or Plan mutation
   occurred; inspect only bounded operator evidence, never a new real identity.
6. Verify the three-account hard guard remains present in the reverted revision.
7. Record the incident, owner decision, exact revision, and whether a separate
   member-migration rollback is needed. Application rollback does not undo a
   member migration; no member migration is authorized by this gate.

## Current production evidence and next gate

Approved feature revision: `80edb73cfabbe6d569b4869495ff85ea1ac48d28`.
Merge revision and deployed image: `f430398048ecda70bbeeef6aa8cd41bd4befc870`.
Publish workflow: `34584712903`, successful. Live health and deployment-health
endpoints report the exact production image tag; the homepage and legal routes
return HTTP 200. The GitHub repository has no `MIGHTY_ACCESS_SYNC_ENABLED`
variable and no post-deployment Mighty Access Sync workflow run.

System-level inert acceptance is PASS. The target Plan ID `2000039`,
three-account mutation allowlist, webhook inertness, startup inertness, worker
authentication, scheduler guard, provider-failure handling, and synthetic
unauthorized-identity protections are covered by the deployed source and
release suite. Required server-side Mighty configuration presence was verified
in the pre-deployment Dokploy evidence without recording secret values.

The two non-mutating provider/UI scope incidents remain documented. The owner
waived live provider member smoke for this acceptance; no live Mighty account
read was performed in this acceptance goal.

## Current boundary and next gate

The three-account integration gate passed before deployment, and the exact
inert deployment is live and accepted at system level. Real-member
normalization, automated revocation, and scheduler enablement remain separate
future work and require fresh explicit owner authorization. The next gate is
only a new owner-authorized production member/population phase; migration and
automation remain disabled.
