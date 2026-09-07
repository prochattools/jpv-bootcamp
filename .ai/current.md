# Current Handoff

## Repo
jpv-bootcamp (`codex/repository-reconciliation-20260905`)

## Tool
Codex

## Goal
Finish repository reconciliation and safely promote one exact reviewed SHA through fresh staging verification and then production, without production-data, schema, provider, billing, credential, or environment mutation beyond the deployment itself.

## Status
Release promotion is active and explicitly authorized by the user. The latest production migration-status verifier concern has been fixed locally and regression-covered. The previous Gate 2 candidate remains historical evidence only because source changed after that staging run. A new exact candidate must be frozen, fully validated, freshly verified in staging, and only then promoted unchanged to production.

Current read-only runtime baseline before this promotion:
- production: `f93ffac7dd299c39d8daf242d6a436272cc79188`, `deploymentEnv=production`;
- staging: `8c74235b1f2e36c19efb93251dbcb4d6e41b9abb`, `deploymentEnv=staging`.

## Files touched
- Repository-wide reconciliation candidate against `origin/main`
- `scripts/release/verifyProductionMigrationStatus.ts`
- `scripts/release/verifyProductionMigrationStatus.test.ts`
- `docs/release/REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md`
- `docs/release/REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md`
- `docs/client/ROADMAP_PROGRESS_STATUS.md`
- `docs/CURRENT_WORK_HANDOFF.md`
- `docs/DOKPLOY_DEPLOYMENT_GUIDE.md`
- `docs/ENVIRONMENT_DATABASE_BOUNDARIES.md`

## Decisions made
- Staging remains isolated at `https://staging.jpvbootcamp.com`, Dokploy `clients-jpv-bootcamp-preview-wjfqfd` / `bZllV93NqsPZAFCsqDskb`, database `jpvbootcamp_staging`, schema `jpvbootcamp`.
- Production remains `https://jpvbootcamp.com`, Dokploy `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`.
- Production deployment authority is `.github/workflows/publish-root-domain-image.yml`; the separate production migration workflow is not part of ordinary deployment and must not run unless fresh read-only evidence proves a migration is pending and separately justified.
- Staging verification authority is `.github/workflows/deploy-preview.yml` using an approved `feature/*`, `fix/*`, or `release/*` source ref; `main` is denied for staging.
- The production migration-status verifier now rejects connection-string query overrides for `host`, `port`, `user`, `password`, `database`, and `db` before constructing a database client.
- PR #30 remains separate and must not be merged by this reconciliation.
- Recovery archive and the two preserved custody worktrees remain intact; no history rewrite, force-push, destructive worktree deletion, or remote branch deletion is permitted.

## Validation already completed after the verifier fix
- focused verifier test via `pnpm exec tsx scripts/release/verifyProductionMigrationStatus.test.ts`: passed;
- full Vitest: `52/52` files, `466/466` tests passed;
- `pnpm test:release`: `182/182` required checks passed (`183` manifest entries including `1` conditional);
- `pnpm lint`: passed;
- `git diff --check`: passed.

These checks must be rerun after the final candidate commit before any staging deployment.

## Next steps
1. Commit the verifier hardening and current-authority documentation; freeze the resulting exact candidate SHA.
2. Rerun the full deterministic validation against that exact committed SHA.
3. Run one final read-only review against `origin/main`; resolve any blocking finding before promotion.
4. Push an approved `release/*` ref to the exact candidate without rewriting history.
5. Run fresh staging `read-only-migration-plan`; require `55` applied, `0` pending, zero anomalies, and healthy Prisma. Any difference stops promotion for investigation; do not apply migrations automatically.
6. Deploy that exact SHA to staging and require exact `/api/health` convergence with `deploymentEnv=staging`.
7. Run fresh authenticated staging acceptance and require the full required matrix green.
8. Integrate the same exact candidate into protected `main` through the repository's normal protected process, keeping PR #30 separate.
9. Deploy production through `.github/workflows/publish-root-domain-image.yml` and verify exact `/api/health` convergence with `deploymentEnv=production` plus safe smoke checks.
10. Record final SHA, workflow run IDs, migration evidence, staging acceptance, production convergence, and any remaining deferred operator checks in the current authority docs.

## Blockers
No known source blocker. Production promotion is evidence-gated: the final candidate cannot proceed past staging if the fresh migration plan, deployment convergence, authenticated acceptance, or final review differs from the expected safe state.

## Resume prompt
Continue the JPV Bootcamp repository reconciliation release promotion. Preserve recovery/custody state and PR #30. Freeze one exact candidate, rerun all deterministic gates and final review, run fresh staging read-only migration planning and acceptance, then promote the same SHA to production only if every gate remains green. Do not run migration apply, seed, backfill, provider, billing, credential, environment, or destructive cleanup operations unless fresh evidence and explicit scope separately justify them.
