# JPV Bootcamp Repository Reconciliation — Current Truth — 2026-09-06

**Authority date:** 2026-09-06
**Reconciliation branch:** `codex/repository-reconciliation-20260905`
**Starting source authority:** `origin/main` at `f93ffac7dd299c39d8daf242d6a436272cc79188`
**Status:** Gate 1 repository reconciliation is complete locally; the reconciliation branch is not pushed.

This document is the current repository-level authority for the assessment,
hardening, branch reconciliation, cleanup, and release-readiness work started on
2026-09-05. Dated documents below remain valuable audit evidence, but any older
claim that describes itself as “current”, “authoritative”, “ready”, or
“complete” is historical unless this document explicitly adopts it.

## Evidence rules

The repository can prove source code, registered migrations, branch ancestry,
local validation, and tracked documentation. It cannot prove the currently
applied staging or production database state without a fresh environment probe.

Three gates must remain separate:

1. **Implementation complete** — repository code, tests, documentation, and
   review are internally consistent.
2. **Staging verified** — a fresh exact-target, exact-SHA staging evidence
   packet establishes deployment, schema/migration state, provider behavior,
   and required acceptance checks.
3. **Production authorized** — a separate approval permits production
   mutation, migration, deployment, provider changes, or cutover.

Passing an earlier gate never implies a later gate.

## Repository assessment and hardening status

The reconciliation branch contains a bounded set of source-quality,
maintainability, correctness, CI, dependency, and operational-safety changes.
The main categories are:

- ESLint 9 flat-config migration with current TypeScript ESLint packages.
- dependency/security pinning and overrides for known transitive issues where a
  verified safe version exists;
- abortable/shared request handling in notification and administrator session
  flows;
- state-consistency fixes in administrator mode, member-group administration,
  billing overview, theme initialization, FAQ, and testimonials;
- localized TypeScript/React cleanup that removes unnecessary work and stale
  patterns without changing product contracts;
- staging route verification that confirms the routed staging host resolves via
  `tailscale0` before TCP reachability checks;
- a read-only production migration-status verifier plus CI/release-manifest
  integration;
- staging migration-plan configuration and preflight hardening imported from
  the safe portion of PR #30.

No production data, staging data, provider state, credentials, deployment,
Stripe state, or database schema has been mutated by this reconciliation.

Local release validation on 2026-09-06 passed the complete required manifest:
`pnpm test:release` reported `182/182`. The manifest contains `183` entries in
total: `182` required and `1` conditional. This result proves the local
repository gate only and does not establish current staging database state.

The exact source candidate was committed locally as
`dcd8911ebdf61a48d45525ae86f7b57d399ff2ba` (`chore: reconcile repository
state and release hardening`). The final adversarial review of that candidate
reported zero findings and assessed the patch as correct. No push, PR merge,
deployment, provider mutation, Stripe mutation, database mutation, or
staging/production operation followed.

## Migration source truth

The current source registry ends with:

- `20260901_210000_notification_event_key`
- `20260901_220000_member_follows`

Older documentation that names 35, 36, 37, 52, or 53 applied migrations records
the environment at a prior checkpoint. Those counts must not be projected onto
the current staging database.

**Current staging applied state: UNKNOWN until a fresh read-only exact-state
probe is captured.**

The staging-route branch contains a guarded apply-batch change that targets the
two September 1 migrations. The source registry confirms those migration names,
but current staging applied-state evidence is insufficient to establish whether
that batch is appropriate. The apply-batch change therefore remains deferred.

## Branch and worktree reconciliation

### Safely reclaimed worktrees and local refs

The first cleanup pass removed seven independently verified clean worktrees and
reclaimed approximately 6.3 GB. A second custody-backed pass removed seven
additional worktrees after unique dirty files were captured byte-for-byte,
tracked baselines were restored, and each worktree was verified clean before
normal `git worktree remove`.

The worktree inventory is now **3**:

- primary `jpv-bootcamp` on `codex/ux-architecture-consolidation`;
- `jpv-bootcamp-main` on `codex/post-release-baseline-closeout`;
- this reconciliation worktree on `codex/repository-reconciliation-20260905`.

Local branch inventory was reduced from 22 to **5** after ancestry,
patch/behavioral supersession, remote-ref, and recovery-bundle checks. The only
remaining local branches are:

- `main`;
- `codex/repository-reconciliation-20260905`;
- `codex/repository-hardening-20260902` (open PR #30);
- `codex/ux-architecture-consolidation` (primary dirty worktree);
- `codex/post-release-baseline-closeout` (environment-custody worktree).

No remote branch ref was deleted.

The repository also contained a tracked `newrelic_agent.log` runtime artifact
of 45,452,459 bytes. Reconciliation removes it from the current tree and adds
it to `.gitignore`; its historical blob remains in Git history, so this cleanup
does not require a history rewrite and does not destroy the archived data.

The tracked `src/app/(frontend)/sponsored/claim/page.tsx.bak` editor backup is
also removed from the current tree and `*.bak` is ignored. The canonical
`page.tsx` remains authoritative, no repository code references the backup, and
the historical backup blob remains recoverable from Git history.

### Preserved worktrees

Two non-reconciliation worktrees remain intentionally:

- primary `jpv-bootcamp` on `codex/ux-architecture-consolidation` contains
  substantial modified/untracked documentation, assets, scripts, and runtime
  material that is not proven safe to discard;
- `jpv-bootcamp-main` on `codex/post-release-baseline-closeout` contains local
  `.env`, `.env.production`, and `.next/standalone` environment/runtime custody.

Neither is eligible for deletion until its unique/user/environment state has
an explicit lossless disposition. Keeping them is a safety boundary, not an
unfinished branch-reconciliation ambiguity.

### Recovery archive

The lossless recovery backstop is retained at:

`/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-safety-20260905`

It intentionally is not a Git repository. In addition to the earlier archive
material, it now contains the verified complete-history bundle
`jpv-bootcamp-all-refs-20260906-post-gate1.bundle` plus exact-file custody
snapshots for every dirty worktree removed in the second cleanup pass. Before
local branch deletion, every deleted tip was confirmed present in that bundle;
historical Payload, legacy-domain, overnight-report, staging-route, and v1 tips
were also confirmed at identical remote refs. The archive must be retained
until the two preserved custody worktrees receive explicit disposition.

## Unique branch dispositions

The following decisions are established from source/ancestry comparison:

| Branch / work | Disposition |
| --- | --- |
| community-admin agent branch | Superseded by main; do not cherry-pick. |
| `codex/post-release-baseline-closeout` | Do not adopt; later main intentionally reverted notifier routing and current tests enforce that behavior. |
| `release/legacy-domain` | Preserve as frozen legacy history; do not adopt. |
| `feature/payload-v2` | Superseded; never blanket cherry-pick. |
| `codex/feature-billing-integration` | Functionality already evolved on main. |
| `codex/leaderboard-social-identity` | Functionality already evolved on main. |
| old portal-layout worktree | Superseded by current portal shell/theme/admin/navigation/live-call implementation. |
| `fix/staging-tailscale-accept-routes-20260902` | Adopt only the verified route-probe net fix. Defer migration apply-batch change. Do not adopt stale candidate-image publication commits. |
| old webhook retry-safety worktree (`96f6781`) | Superseded by the stronger mainline atomic claim/finalize/release protocol with 500/503 retry semantics; do not adopt. |

The superseded local-only agent/worktree refs were deleted after their exact
tips were verified in the complete-history bundle. Local refs for Payload v2,
legacy-domain, the overnight report, the staging-route branch, and v1 were also
removed after exact remote-tip and bundle verification. Their remote refs were
left unchanged.

The pinned Tailscale GitHub Action already injects `--accept-routes`; adding the
same argument explicitly is redundant. The retained route change verifies the
subnet-routed staging host through `tailscale0` while preserving direct
`tailscale ping` only for the protected backup peer.

## PR #30 disposition

PR #30 (`codex/repository-hardening-20260902`) is still open. Its current head is
`31c79574854ec6fc70e3e094da3d3537c112c6cd`, CI is passing, and GitHub reports
`REVIEW_REQUIRED` / `BLOCKED`.

Safe pre-`31c7957` CI, release-validation, migration-verification, and staging
preflight artifacts were imported into this reconciliation where they remain
applicable. Commit `31c7957 chore: remove invalid worktree gitlinks` is excluded
because its cleanup is not proven lossless against the present workspace.

PR #30 must not be merged while branch protection requires review.

## Residual risks and open validation

- A moderate Payload advisory (`GHSA-jg8r-5jh2-v2xj`) remains unresolved on the
  currently used Payload line because no verified patched upgrade was available
  during the dependency assessment. Do not force an unverified major/minor
  upgrade merely to silence the advisory.
- Browser E2E (`M1-03`) remains an external/operator validation.
- `support-request-migration-apply` remains an explicitly deferred mutation.
- live-provider smoke remains an external/operator validation.
- deployment and production smoke remain external/operator validations.
- current staging database applied state requires a fresh authorized read-only
  exact-state probe.

The full local release suite is green at `182/182`, the exact source candidate
is committed locally, and adversarial review has no findings. Gate 1 is locally
complete. Gate 2 staging evidence and Gate 3 production authorization remain
separate open release gates.

## Completion criteria for this reconciliation

Gate 1 repository reconciliation is complete locally because all of the
following are true:

1. stale “current” documentation points here or is explicitly historical;
2. roadmap and implementation plan use the three-gate model above;
3. focused tests for newly imported migration/CI/staging artifacts pass;
4. lint, diff check, type-check, production build, and full `pnpm test:release`
   pass after the final diff;
5. the final adversarial review reports no unresolved in-scope defect;
6. the reconciliation source commit contains only reviewed, intentional files;
7. cleanup retains lossless custody for every removed dirty worktree/ref;
8. any future push preserves branch protection and does not merge PR #30;
9. remaining staging/production/operator work is reported as open rather than
   inferred complete.

See
[REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md](REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md)
for the remaining execution sequence.
