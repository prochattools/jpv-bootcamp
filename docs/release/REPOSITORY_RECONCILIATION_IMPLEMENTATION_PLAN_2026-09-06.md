# JPV Bootcamp Repository Reconciliation — Implementation Plan — 2026-09-06

**Current truth:**
[REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md](REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md)

This plan replaces older Phase 9.5 “current backlog” framing for repository
reconciliation. Historical Phase documents remain audit evidence.

## Gate 1 — Implementation complete

### R1. Source and dependency hardening

**Status:** complete locally in source candidate
`dcd8911ebdf61a48d45525ae86f7b57d399ff2ba`.

- ESLint 9 flat configuration and current lint command.
- dependency/security overrides with lockfile reconciliation.
- reviewed React/TypeScript state, request, and rendering cleanup.
- production migration-status read-only verifier.
- PR validation/release-manifest integration.
- staging migration-plan configuration and infrastructure preflight hardening.
- verified subnet-route probe for staging workflow connectivity.

### R2. Documentation authority reconciliation

**Status:** complete locally; the 2026-09-06 current-truth document is the
repository authority and older dated claims remain historical evidence.

- make the 2026-09-06 repository current-truth document authoritative;
- keep all prior evidence intact but clearly historical;
- update current handoff, architecture/implementation plan, roadmap, Phase 9.5
  documents, branch reconciliation, pre-production dossier, and staging
  readiness matrix to point to the new authority;
- never infer current staging DB state from source registration or old run IDs.

### R3. Branch/worktree cleanup

**Status:** complete within the proven lossless cleanup boundary.

- worktree inventory reduced to 3; the first cleanup pass reclaimed
  approximately 6.3 GB and the second pass removed additional custody-backed
  worktrees;
- local branch inventory reduced from 22 to 5 after exact recovery and
  supersession checks; no remote branch was deleted;
- tracked `newrelic_agent.log` removed from the current tree and ignored going
  forward; the historical blob remains recoverable from Git history;
- tracked `src/app/(frontend)/sponsored/claim/page.tsx.bak` removed from the
  current tree and `*.bak` ignored; the canonical `page.tsx` remains in place
  and the historical backup blob remains recoverable from Git history;
- verified complete-history post-Gate-1 bundle and exact dirty-file custody
  snapshots retained;
- primary dirty worktree and environment-custody worktree preserved because
  their unique/user/environment state is not eligible for deletion;
- PR #30 branch retained while the PR remains open and review-protected.

### R4. Final local validation

**Status:** complete for the exact source candidate. Full local
`pnpm test:release` passed `182/182` required checks on 2026-09-06 after the
status-document contracts were refreshed, with the supporting lint, diff,
type-check, build, migration, staging-plan, workflow-contract, and release
validation checks green.

Run and require green results for:

1. production migration verifier tests;
2. staging migration-plan environment/configuration tests;
3. staging migration infra/preflight and workflow-contract tests;
4. release manifest / PR-validation contracts;
5. `pnpm lint`;
6. `git diff --check`;
7. repository type-check;
8. production build;
9. full `pnpm test:release`.

### R5. Final review and local landing

**Status:** complete locally; remote landing is intentionally not performed.

- final adversarial review reported zero findings and assessed the patch as
  correct;
- exact reviewed source candidate committed locally as `dcd8911`;
- this documentation/cleanup closure records the post-commit branch/worktree
  reconciliation state;
- no push, PR merge, deployment, or external mutation occurred;
- any future push must target the reconciliation branch and preserve branch
  protection; PR #30 remains separate.

## Gate 2 — Staging verified

**Status:** open. Repository work alone cannot close this gate.

Required fresh evidence:

- exact candidate SHA and exact staging target;
- read-only applied/pending migration state with integrity/anomaly checks;
- Prisma/schema health;
- exact-SHA deployment/health evidence;
- required browser E2E/acceptance packet;
- live-provider smoke where the release contract requires it.

The current staging applied state remains **UNKNOWN** until the read-only probe
is captured. No staging migration apply is authorized by this plan.

## Gate 3 — Production authorized

**Status:** not authorized by repository reconciliation.

Production migration, deployment, provider mutation, Stripe/billing mutation,
DNS/cutover, credential mutation, and destructive cleanup require their own
authorization and exact-target preflight. Gate 2 evidence is a prerequisite; it
is not production authorization.

## Explicitly deferred work

- `support-request-migration-apply`;
- current-staging migration apply batch from the staging-route branch;
- stale candidate-image publication lane tied to the old `477eb1e...` candidate;
- live-provider smoke;
- deployment/production smoke;
- browser E2E `M1-03` when it requires an operator/environment lane;
- PR #30 merge while GitHub reports `REVIEW_REQUIRED`.

## Exit condition

Gate 1 repository reconciliation is complete locally. Gate 2 and Gate 3 remain
explicitly open and require their own evidence/authorization. The two preserved
non-reconciliation worktrees are separate custody work: they must not be
deleted until their unique or environment-local state has a lossless
disposition.
