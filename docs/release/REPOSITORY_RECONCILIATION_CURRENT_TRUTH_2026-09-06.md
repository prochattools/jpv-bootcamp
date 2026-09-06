# JPV Bootcamp Repository Reconciliation — Current Truth — 2026-09-06

**Authority date:** 2026-09-06
**Reconciliation branch:** `codex/repository-reconciliation-20260905`
**Starting source authority:** `origin/main` at `f93ffac7dd299c39d8daf242d6a436272cc79188`
**Status:** repository reconciliation in progress; local changes are not yet committed or pushed.

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

### Safely reclaimed worktrees

Seven worktrees were independently verified clean and removed with
`git worktree remove`. Their branch refs were preserved. Approximately 6.3 GB
of local disk space was reclaimed:

- `jpv-bootcamp-hotfix-parallel-work`
- `jpv-bootcamp-billing-integration`
- `jpv-bootcamp-leaderboard`
- `jpv-bootcamp-legacy-domain`
- `.claude/worktrees/agent-a636...`
- `.claude/worktrees/wf_...-4`
- the Buildflow `feature_payload-v2` worktree

No branch ref was deleted as part of that cleanup.

The repository also contained a tracked `newrelic_agent.log` runtime artifact
of 45,452,459 bytes. Reconciliation removes it from the current tree and adds
it to `.gitignore`; its historical blob remains in Git history, so this cleanup
does not require a history rewrite and does not destroy the archived data.

The tracked `src/app/(frontend)/sponsored/claim/page.tsx.bak` editor backup is
also removed from the current tree and `*.bak` is ignored. The canonical
`page.tsx` remains authoritative, no repository code references the backup, and
the historical backup blob remains recoverable from Git history.

### Preserved worktrees

The following worktrees remain because they contain active work, unique
untracked files, local credentials/runtime state, or unresolved branch history:

- primary `jpv-bootcamp` worktree on `codex/ux-architecture-consolidation`;
- `jpv-bootcamp-aug25-stripe`;
- `jpv-bootcamp-hardening` / PR #30;
- `jpv-bootcamp-main` on `codex/post-release-baseline-closeout` because local
  `.env`, `.env.production`, and `.next/standalone` environment copies require
  custody;
- this reconciliation worktree;
- `jpv-bootcamp-staging-route-fix`;
- `.claude/worktrees/agent-a640...`;
- `.claude/worktrees/agent-aace...`;
- `.claude/worktrees/wf_...-1`;
- `.claude/worktrees/wf_...-2`.

These must not be deleted until unique changes and local-state custody are
independently resolved.

### Recovery archive

The lossless recovery backstop is retained at:

`/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-safety-20260905`

It is approximately 180 MB and intentionally is not a Git repository. It
contains the all-refs bundle, primary patch, untracked inventories/tarballs, and
dirty-worktree patches. It must be retained until repository reconciliation is
fully landed and the preserved worktrees have their own explicit disposition.

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

The full local release suite is currently green at `182/182`; the remaining
repository work is final diff/style/type validation, pre-landing adversarial
review, and landing the reviewed reconciliation branch.

## Completion criteria for this reconciliation

The repository reconciliation is complete only when all of the following are
true:

1. stale “current” documentation points here or is explicitly historical;
2. roadmap and implementation plan use the three-gate model above;
3. focused tests for newly imported migration/CI/staging artifacts pass;
4. lint, diff check, type-check, production build, and full `pnpm test:release`
   pass after the final diff;
5. the final pre-landing review reports no unresolved in-scope defect;
6. the reconciliation commit contains only reviewed, intentional files;
7. any push preserves branch protection and does not merge PR #30;
8. remaining staging/production/operator work is reported as open rather than
   inferred complete.

See
[REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md](REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md)
for the remaining execution sequence.
