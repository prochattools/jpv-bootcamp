# Repository Clean Baseline — 2026-09-02

**Status: TECHNICAL CLEANUP BLOCKERS RESOLVED — PR #30 is ready for independent review; fresh production evidence remains an operator-run read-only evidence step.**

This is the current cleanup and release-gate authority. Older dated handoffs,
deployment guides, and branch-reconciliation reports remain audit history only.
They must not be used as current branch, SHA, staging, migration, or deployment
instructions.

## Scope and safety boundary

This pass is repository hardening and baseline reconciliation only. No
production, legacy, Stripe/provider, DNS, or database mutation was performed.
No product feature work was started. Active and dirty worktrees remain
preserved.

## Verified repository state

| Item | Verified state |
| --- | --- |
| `origin/main` / local `main` | `f93ffac7dd299c39d8daf242d6a436272cc79188` |
| Hardening branch | `codex/repository-hardening-20260902`; current pushed head is tracked by [PR #30](https://github.com/prochattools/jpv-bootcamp/pull/30) |
| Hardening PR | [#30](https://github.com/prochattools/jpv-bootcamp/pull/30), open, mergeable, review required |
| PR validation | Required check `Validate, build, and test` is configured and passed on the current protected-path candidate; local `pnpm test:release` is 182/182 |
| Main protection | Admin enforcement, one approving review, stale-review dismissal, conversation resolution, no force-push/deletion, required check `Validate, build, and test` |
| Default-branch security | Dependabot updates, secret scanning, and push protection enabled; the default branch currently reports 8 open Dependabot alerts (3 high, 5 moderate) |

The hardening change is limited to dependency overrides/lockfile resolution and
the deterministic pull-request validation workflow. The release-required
production audit (`--audit-level high`) passes. A fresh full audit also reports
two moderate transitive `stripe -> qs` advisories; this pass does not widen into
dependency remediation because the authorized scope is the staging-parity /
hardening closeout only.

The current-main production migration-ledger verifier is now part of this
candidate. It is separate from the historical Rooms migration control and uses
the canonical Payload and Prisma inventories from the checked-out source.

## Live runtime evidence

| Runtime | Read-only observation |
| --- | --- |
| Production | `https://jpvbootcamp.com/api/health` returned HTTP 200, `status=live`, `deploymentEnv=production`, image/commit `f93ffac7dd299c39d8daf242d6a436272cc79188` |
| Staging | `https://staging.jpvbootcamp.com/api/health` returned HTTP 200, `status=live`, `deploymentEnv=staging`, image/commit `477eb1e4521d87b8344ff326f82d28ac537af74a` |
| Legacy | Preserved and not queried or mutated by this pass |

The current staging runtime is not the current `main` SHA. The latest
available guarded staging read-only plan artifact (`staging-migration-plan-33614431352`)
was run against `fix/staging-tailscale-accept-routes-20260902` at
`67e8c1e24117cd59ba2edad2c32971fdde685457` and reported:

- database target `jpvbootcamp-staging`, schema `jpvbootcamp`;
- 55 applied Payload migrations;
- `expectedPendingMigrations=[]` (there are no pending migrations to apply);
- zero unexpected, duplicate, malformed, or ordering-anomaly records; and
- healthy Prisma migration evidence.

This supersedes earlier snapshots that reported two pending migrations. No
staging migration was applied because the current read-only evidence has no
pending migration batch.

## Connectivity and staging governance

The local Tailscale client is running and the protected route
`10.0.2.4:5433` is reachable. The route outage is resolved. The local
`pnpm staging:payload-migration-infra-preflight` now matches the live protected
environment and passed at closeout:

1. the live `staging-migration-plan` environment has one required reviewer;
2. the live environment has custom branch policies `feature/*`, `fix/*`, and
   `release/*`; and
3. the checked-in preflight verifies those protections and refuses to weaken
   them.

No environment protection settings, variables, secrets, database, or staging
deployment were mutated by this closeout.

## Staging and production gates

The current read-only staging evidence is safe and complete for migration
state, but staging is not aligned to `main`. Production health is green. A
fresh production ledger artifact has not been captured in this local pass
because production database credentials are not present in the worktree.

The approved current-main evidence command is:

```text
DEPLOYMENT_ENV=production EXPECTED_DEPLOYMENT_SHA=<40-char-production-sha> pnpm production:migration-status:read-only -- --mode=production-read-only --expected-schema=jpvbootcamp --acknowledge-read-only
```

Run it only inside the governed production runtime with its production-bound
`DATABASE_URL` for `10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp`, using the
`jpvbootcamp_production_app` role and the protected route. The command performs
one `BEGIN TRANSACTION READ ONLY` metadata read, compares Payload and Prisma
ledger state with the current source inventories, performs a deployment-health
GET for the expected SHA, and always rolls back the read-only transaction. It
does not apply migrations, alter schema/data, seed, reset, clean up, deploy, or
fall back to staging/local state. Its JSON output contains migration metadata
only; credentials and database contents are not emitted.

If the protected route or credentials are unavailable, the exact operator
prerequisite is to restore access to that governed production runtime and rerun
the command there. Do not substitute `feature/member-portal-rooms`, staging,
legacy, a local database, or a guessed host/role. The historical Rooms control
remains Rooms-specific and is not a current-main production ledger verifier.
No production migration or redeploy is authorized by this document.

PR #30 cannot be merged by this pass because main requires a separate approving
review. PR #29 is a separate open Dependabot postcss PR and was not merged or
closed automatically because it overlaps the hardening change and also needs
review.

## Retained local work

The original dirty feature worktree, the unique billing/leaderboard/payload and
staging-route worktrees, the post-release closeout worktree, the legacy
worktree, and generated worktrees containing untracked agent work are retained.
Only merged local branches with no attached worktree and gone remote refs were
deleted with safe `git branch -d`. No legacy remote ref was deleted.

## Rollback readiness

No external mutation occurred in this pass. Repository rollback is the normal
PR close/revert path for PR #30; the hardening branch remains available at its
immutable pushed SHA. Staging rollback is not applicable because no staging
database or deployment mutation was performed.

## Final decision

`TECHNICAL CLEANUP BLOCKERS RESOLVED — PR #30 READY FOR INDEPENDENT REVIEW`.

Staging connectivity/governance reconciliation, the guarded staging plan, the
current-main production verifier, its no-mutation tests, and local release
validation are complete. Independent review remains required before merge.
Fresh live production ledger evidence is an operator-run read-only prerequisite
for production evidence, not a reason to mutate production from this worktree.
Do not merge, deploy, or apply migrations from this document.
