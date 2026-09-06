# JPV Bootcamp Repository Reconciliation — Implementation Plan — 2026-09-06

**Current truth:**
[REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md](REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md)

This plan replaces older Phase 9.5 “current backlog” framing for repository
reconciliation. Historical Phase documents remain audit evidence.

## Gate 1 — Implementation complete

### R1. Source and dependency hardening

**Status:** implemented in the reconciliation worktree, pending final validation
and review.

- ESLint 9 flat configuration and current lint command.
- dependency/security overrides with lockfile reconciliation.
- reviewed React/TypeScript state, request, and rendering cleanup.
- production migration-status read-only verifier.
- PR validation/release-manifest integration.
- staging migration-plan configuration and infrastructure preflight hardening.
- verified subnet-route probe for staging workflow connectivity.

### R2. Documentation authority reconciliation

**Status:** implemented by this documentation pass, pending stale-current scan.

- make the 2026-09-06 repository current-truth document authoritative;
- keep all prior evidence intact but clearly historical;
- update current handoff, architecture/implementation plan, roadmap, Phase 9.5
  documents, branch reconciliation, pre-production dossier, and staging
  readiness matrix to point to the new authority;
- never infer current staging DB state from source registration or old run IDs.

### R3. Branch/worktree cleanup

**Status:** safe cleanup partially complete.

- seven verified-clean worktrees removed, refs preserved, approximately 6.3 GB
  reclaimed;
- tracked `newrelic_agent.log` removed from the current tree and ignored going
  forward; the historical blob remains recoverable from Git history;
- tracked `src/app/(frontend)/sponsored/claim/page.tsx.bak` removed from the
  current tree and `*.bak` ignored; the canonical `page.tsx` remains in place
  and the historical backup blob remains recoverable from Git history;
- recovery archive retained;
- all dirty, credential-bearing, or unique worktrees preserved;
- future branch-ref deletion is allowed only after ancestry/equivalence and
  unique-work evidence prove it lossless.

### R4. Final local validation

**Status:** full local `pnpm test:release` passed `182/182` required checks on
2026-09-06 after the status-document contracts were refreshed. Final
diff/style/type checks and focused documentation contracts remain before this
gate is closed.

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

### R5. Final review and landing

**Status:** pending.

- run the mandatory pre-landing review over the complete reconciliation diff;
- use adversarial/high-risk review posture because migration tooling, billing
  dependencies, CI, and production-read paths are present in the diff;
- fix concrete in-scope findings and rerun affected validation;
- commit only after the final diff is clean and review passes;
- push only to the reconciliation branch; do not bypass branch protection and
  do not merge PR #30.

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

After Gate 1 is green and committed, repository reconciliation can be marked
complete with Gate 2 and Gate 3 explicitly open. Do not keep the repository
assessment artificially “in progress” merely because environment/operator work
requires separate authorization; record those as separate release gates.
