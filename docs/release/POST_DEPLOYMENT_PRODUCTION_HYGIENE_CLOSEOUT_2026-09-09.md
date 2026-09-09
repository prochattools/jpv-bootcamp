# JPV Bootcamp — Post-Deployment Production Hygiene Closeout — 2026-09-09

## Decision

Production is operational on `main` at
`d55ac6a30bcd78c63bd2a0a46db709617efc48f2`. The release is approved for
stability and operational continuity. It contains hardening and documentation
updates only; no new product feature was promoted.

## Merged release sequence

| Pull request | Scope | Merge commit | Production publish | Result |
| --- | --- | --- | --- | --- |
| #31 | Production hygiene and release validation | `1aeb8487` | superseded by later release | Merged |
| #32 | Maintained production image base | `c72ad378` | `34375016540` | Merged and deployed |
| #36 | Guarded read-only production migration verifier | `7ba93c31` | `34389541041` | Merged and deployed |
| #35 | Payload account-unlock authorization hardening | `cb0fb0c6` | `34391403077` | Merged and deployed |
| #34 | Deployed production-state documentation | `d55ac6a3` | `34392897174` | Merged and deployed |

PR #30 and PR #33 were closed without merging. There are no open production
release pull requests; this documentation-only closeout is tracked in PR #37.

## Runtime evidence

- Canonical production origin: `https://jpvbootcamp.com`.
- Production health: HTTP 200, `status=live`, `deploymentEnv=production`,
  `imageTag=d55ac6a30bcd78c63bd2a0a46db709617efc48f2`.
- Staging health: HTTP 200, `status=live`,
  `deploymentEnv=staging`, image/commit
  `8b1f459fed358776fda791553ef225cc9f03b2ae`.
- Final publish workflow `34392897174` completed successfully, including
  immutable image publication, Dokploy update, deployment trigger, and
  production convergence.

The alias `https://jpv-bootcamp.prochat.tools` is not the configured production
origin. It resolves to Cloudflare and returned HTTP 530 error 1033 during the
read-only probe. No DNS or Cloudflare change was made. The alias requires a
separate owner-authorized DNS decision before retirement or repair.

## Data and schema boundary

No separate production migration workflow ran for this release. No migration
or schema files changed in the final release diff, and no manual database write,
reset, seed, restore, or production-data operation was performed. Existing
onboarded people, support requests, sponsored membership requests, and other
operational records were outside the release actions and were not modified.

## Repository cleanup

After ancestry checks confirmed they were contained in `origin/main`, the local
merged-only refs for the production-hygiene and production-image-fix branches
were deleted, and local `main` was advanced to `origin/main`. The merged PR #34
worktree was removed after merge. Remote branch refs remain preserved as
recovery references.

The clean closeout, migration-preflight, and reconciliation worktrees remain
preserved. The dirty UX worktree remains preserved. No unfinished worktree was
deleted.

## Validation evidence

The merged release passed the repository release gate (`184/184` required
checks), lint, TypeScript validation, production build, Prisma validation,
focused authorization and migration-verifier tests, and `git diff --check`.
The production high-severity audit gate passed. GitHub currently reports four
moderate dependency advisories for the default branch; dependency changes are
separate maintenance work and were not introduced by this closeout.

The publish workflows report the GitHub Actions Node 20 to Node 24 runtime
transition warning. It did not fail validation or deployment and should be
handled as routine workflow maintenance.
