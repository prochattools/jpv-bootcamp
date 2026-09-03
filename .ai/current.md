# Current Handoff

## Repo
jpv-bootcamp (codex/repository-hardening-20260902)

## Tool
Codex

## Goal
Complete the authorized repository-hardening and clean-baseline reconciliation from current main without starting product work.

## Status
Blocked — protected-path hardening, staging connectivity/parity evidence, and local release validation are complete. PR #30 still requires independent approval, and the existing production schema runner cannot provide fresh current-main evidence.

## Files touched
- .github/workflows/pull-request-validation.yml
- package.json
- pnpm-lock.yaml
- docs/release/REPOSITORY_CLEAN_BASELINE_2026-09-02.md
- docs/git-workflow.md
- docs/DOKPLOY_DEPLOYMENT_GUIDE.md
- docs/ENVIRONMENT_DATABASE_BOUNDARIES.md
- docs/architecture/JPV_ENVIRONMENT_TOPOLOGY_V1.md
- docs/PREVIEW_RELEASE_READINESS.md
- scripts/release/releaseTestManifest.ts
- scripts/staging-gates/configureStagingMigrationPlanEnvironment.ts
- scripts/staging-gates/configureStagingMigrationPlanEnvironmentCli.ts
- scripts/staging-gates/configureStagingMigrationPlanEnvironment.test.ts
- scripts/staging-gates/stagingPayloadMigrationInfraPreflight.mts

## Decisions made
- Production and legacy remain untouched.
- Current Tailscale route `10.0.2.4:5433` is reachable; the checked-in staging guard now verifies and preserves the live protected reviewer plus exact `feature/*`, `fix/*`, and `release/*` branch policies.
- Fresh preflight passed; the latest guarded read-only staging plan reports 55/55 applied, no pending migrations, healthy Prisma, and zero anomalies. No migration was applied.
- Fresh health checks returned live for staging and production. Production schema status was not claimed because the only historical runner is bound to the missing `feature/member-portal-rooms` ref.
- Active or dirty worktrees remain preserved; only safely merged local branches with gone remote refs were removed.

## Next steps
1. Commit and push the protected-path hardening candidate.
2. Obtain a separate approving review for PR #30; never self-approve or bypass it.
3. Obtain a separately governed fresh current-main production schema/migration read-only evidence path; do not mutate production.

## Blockers
PR #30 review required; current generic production schema evidence is not available through the existing read-only repository tooling because its historical Rooms runner requires the missing `feature/member-portal-rooms` source ref.
