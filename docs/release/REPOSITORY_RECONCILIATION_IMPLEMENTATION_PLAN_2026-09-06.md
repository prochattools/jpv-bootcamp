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

**Status:** complete through the latest verifier hardening, subject to one final
post-commit rerun before staging. After the production migration-status
connection-boundary fix, focused verifier coverage passed, full Vitest passed
`52/52` files and `466/466` tests, `pnpm test:release` passed `182/182` required
checks, and lint plus `git diff --check` were green. The final committed release
candidate must rerun the same deterministic gate before promotion.

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

**Status:** previous review/landing evidence is complete for the historical Gate
2 candidate. The branch has advanced since then through inherited-regression
reconciliation and the production migration-status verifier hardening, so one
fresh final read-only review is required against `origin/main` before promotion.

- the previous adversarial review reported zero findings for the then-current
  patch;
- exact reviewed source candidate committed locally as `dcd8911`;
- Gate 1 documentation/cleanup closure produced exact Gate 2 candidate
  `8c74235b1f2e36c19efb93251dbcb4d6e41b9abb`;
- branch HEAD later advanced to
  `27d463b449f113ee1ee7d980a83d143ca84492d8` before the verifier hardening;
- no PR merge or production operation occurred during the previous Gate 1/2
  packet;
- any future push must target the reconciliation branch and preserve branch
  protection; PR #30 remains separate.

## Gate 2 — Staging verified

**Current status:** **PENDING FRESH FINAL-CANDIDATE EVIDENCE**.

The prior packet remains **COMPLETE historical evidence** for exact staging
candidate `8c74235b1f2e36c19efb93251dbcb4d6e41b9abb`, but source changed after that
run. It cannot be reused to authorize production for the newer candidate.

Captured fresh evidence:

- source ref `release/gate2-reconciliation-20260906` resolved to the exact
  candidate SHA;
- read-only migration-plan run `34026196340` reported `55` applied Payload
  migrations, `0` pending, zero anomalies, and healthy Prisma state;
- exact-SHA staging deploy run `34026379042` reported the exact candidate image
  live in `deploymentEnv: staging`;
- authenticated acceptance run `34027526347` passed `24/24` Playwright checks
  across the required member and creator/admin route matrices and navigation;
- all migration-apply, bootstrap, backfill, QA-seed, provider/billing mutation,
  and production lanes remained unused.

No staging migration apply was needed because the read-only plan found no
pending migrations. The authenticated acceptance lane can write bounded
login/session metadata for its two staging test actors as part of normal Payload
authentication; it did not mutate business data, schema, provider, billing, or
production state.

For the final candidate, rerun in this order:

1. `read-only-migration-plan` on the exact approved `release/*` ref; require
   `55` applied, `0` pending, zero anomalies, and healthy Prisma;
2. `deploy-preview` for the same exact SHA; require staging `/api/health` to
   report that SHA with `deploymentEnv=staging`;
3. `authenticated-acceptance` for the same SHA; require the full required
   Playwright matrix green.

Any migration-state difference, deployment mismatch, acceptance failure, or
target-boundary mismatch stops promotion. Do not run migration apply,
bootstrap, backfill, seed, provider, or billing lanes automatically.

Live-provider smoke remains deferred because this reconciliation Gate 2 did not
require a live-provider mutation/verification lane. It must stay a separately
authorized operator task wherever a later release contract requires it.

## Gate 3 — Production authorized

**Status:** **EXPLICITLY AUTHORIZED BY USER, EVIDENCE-GATED**.

The user has authorized promotion of the final reviewed candidate through
staging and then production. Production deployment may proceed only after fresh
Gate 2 evidence is green for that exact SHA and the same candidate is integrated
into protected `main` through the repository's normal process.

Production deployment authority is
`.github/workflows/publish-root-domain-image.yml`, targeting only
`https://jpvbootcamp.com` and Dokploy
`clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`. The separate
`.github/workflows/production-prisma-migrations.yml` lane is not part of ordinary
deployment and must not run unless fresh read-only evidence proves a migration
is pending and a separate migration decision is justified.

Provider mutation, Stripe/billing mutation, credential/environment changes,
DNS/cutover, migration apply, and destructive cleanup remain outside this
deployment authorization unless separately supported by fresh evidence and
scope.

## Explicitly deferred work

- `support-request-migration-apply`;
- current-staging migration apply batch from the staging-route branch;
- stale candidate-image publication lane tied to the old `477eb1e...` candidate;
- live-provider smoke where a later release contract requires it;
- final-candidate staging deployment/acceptance until rerun;
- production smoke until the authorized exact-SHA deployment completes;
- real-device/WebRTC or other operator-only browser checks that are distinct
  from the completed A6 authenticated acceptance packet;
- PR #30 merge while GitHub reports `REVIEW_REQUIRED`.

## Exit condition

Gate 1 implementation is complete through the verifier hardening, with one final
post-commit deterministic rerun and read-only review required. The previous Gate
2 packet is historical; fresh exact-SHA Gate 2 evidence is required for the final
candidate. Gate 3 deployment is authorized once those checks pass. The two
preserved non-reconciliation worktrees are separate custody work and must not be
deleted until their unique or environment-local state has a lossless
disposition.
