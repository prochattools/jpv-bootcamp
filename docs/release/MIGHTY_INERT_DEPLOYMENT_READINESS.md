# Mighty Inert-Deployment Readiness

## Current release gate — 2026-09-11

`INERT PRODUCTION DEPLOYMENT: ACCEPTED`
`SYSTEM-LEVEL INERT PRODUCTION ACCEPTANCE: PASS`
`PRODUCTION-FREEZE SYNTHETIC HARDENING GATE: PASS`
`POST-DEPLOYMENT HARDENING RC: DEPLOYED`
`LIVE PROVIDER POST-DEPLOY MEMBER SMOKE: WAIVED BY OWNER`
`SYSTEM HEALTH: PASS`
`PRODUCTION OPERATING MODE: DEPLOYED + HARDENED + INERT`
`ZERO-TOUCH MIGRATION OPERATIONS READINESS: PASS`
`ZERO-TOUCH MIGRATION SAFETY RC: READY FOR OWNER REVIEW`

The live platform is deployed, hardened, and inert for the current engineering
goal. The controlling
freeze and synthetic evidence record is
`docs/release/MIGHTY_PRODUCTION_FREEZE_SYNTHETIC_HARDENING_2026-09-11.md`.
No live provider read, provider mutation, Stripe operation, population
inspection, production test data, worker execution, scheduler enablement,
configuration change, or deployment is authorized here.

The synthetic-only migration operations gate is complete. The exact manifest,
authorization, entitlement re-check, checkpoint/resume, stop-on-error, and
operator procedure are documented in
`docs/migration/MIGHTY_ZERO_TOUCH_MIGRATION_OPERATOR_RUNBOOK.md`. No real
population was inspected and no real migration manifest was created.

The live Stripe → Mighty integration is running the inert hardening deployment
at `1555bab05df64a173737080f0b6988a6789434a4`, sourced from RC
`d393371ad5e737794e145da4959f67f3b85af0a1`. Population inspection, migration,
scheduler enablement, and live Stripe mutation remain unauthorized. The owner explicitly waived live
 post-deployment Mighty member reads because two non-mutating provider/UI scope
incidents showed that even apparently member-scoped views can expose unrelated
identities. No further provider/account read is part of this acceptance.

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

## Future owner deployment checklist

This checklist is review material, not deployment authorization.

1. Review exact branch `codex/mighty-post-deploy-hardening-rc` and exact pushed commit.
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

## Future post-deploy smoke test

After a separately authorized inert deployment, use only the three identities
above and prefer reads. Confirm:

- application health and exact deployed revision;
- Mighty configuration shape and Plan `2000039` without printing secrets;
- scheduler disabled;
- exact-email resolution for the three permitted identities;
- Host protection for Steve and Info;
- ordinary safe-state read for Westhoek;
- no population processing, queue worker run, migration, or fourth identity access.

Do not run a live grant/revoke cycle as part of the inert smoke test unless a
new owner authorization names the exact identity and operation.

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

## Current boundary and next gate

The three-account integration gate is already passed. The current gate proves
the hardening release candidate and deployment inertness; it does not
authorize production deployment. Real-member normalization, automated
revocation, and scheduler enablement remain separate future work and require
fresh explicit owner authorization. The next exact gate is owner review of the
single pushed RC revision; deployment and real-member migration remain
separately unauthorized.
