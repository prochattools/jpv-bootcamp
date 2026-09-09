# JPV Bootcamp — Branch and Worktree Consolidation Review — 2026-09-09

**Status:** POST-DEPLOYMENT REVIEW — PR #31, PR #32, PR #34, PR #35, PR #36, and
PR #37 are merged; production is verified on `41662c7d`; merged-only local refs were
cleaned after ancestry checks

**Audit repository:** `jpv-bootcamp`

**Audit branch:** post-deployment closeout on `main`

The reviewed hygiene release was merged as PR #31 and the production image
Bookworm fix was merged as PR #32. PR #34, PR #35, and PR #36 completed the
documentation, authorization, and read-only verification follow-ups; PR #37
completed the post-deployment documentation closeout. Publish workflow
`34397017905` passed and the live deployment-health endpoint reports the same
production image. The remaining branch and worktree inventory is
preserved because it contains independent work.

This review records the current Git topology and safe disposition. An ancestry
relationship is evidence for review; it is not authorization to delete a branch,
remove a worktree, or rewrite history.

## Current release lines

| Ref | Tip | Relation to `main` | Worktree | Disposition |
| --- | --- | --- | --- | --- |
| `main` | `41662c7d` | Production authority; PR #37 deployment verified | No dedicated worktree | Preserve |
| `codex/post-release-baseline-closeout` | `761087a1` | Divergent clean closeout line | `jpv-bootcamp-main` — clean | Preserve for separate review |
| `codex/production-migration-preflight-20260907` | `16b3424c` | Divergent clean preflight line | `jpv-bootcamp-production-preflight-20260907` — clean | Preserve |
| `codex/repository-reconciliation-20260905` | `8b1f459f` | Divergent clean reconciliation line | `jpv-bootcamp-reconciliation` — clean | Preserve |
| `codex/ux-architecture-consolidation` | `a9629399` | Divergent feature work | `jpv-bootcamp` — dirty | Preserve; do not clean automatically |

The local branches for the merged production-hygiene and image-fix work were
deleted only after ancestry checks proved both tips were contained in main.
The local main ref was fast-forwarded to origin/main. Their remote refs remain
as recovery references. The PR #34 worktree was removed after its merge and
its remote branch ref remains preserved.

The remaining clean and dirty worktrees contain independent work. They are
preserved because ancestry alone does not establish that their unique work is
obsolete or safe to delete.

## Dependency ownership reconciliation

The hygiene worktree currently carries the consolidated dependency closure:

| Dependency area | Hygiene worktree | Hardening PR #30 | Dependabot PR #29 |
| --- | --- | --- | --- |
| Next.js | `^16.3.3`, lock resolves `16.3.4` | `^16.3.0` | `^16.3.0` |
| Sharp | `^0.35.4`, lock resolves `0.35.4` | `^0.35.0`, lock resolves `0.35.3` | `^0.35.0`, lock resolves `0.35.3` |
| PostCSS | override `8.5.26` | override `8.5.26` | lock-only bump to `8.5.26` |
| Stripe `qs` | `6.16.0` | `6.16.0` | unchanged |
| Remaining audited transitive pins | DOMPurify `3.4.13`, protobufjs `7.6.5`, brace-expansion `1.1.18`/`2.1.4`, OpenTelemetry `2.8.0`, esbuild `0.25.12`, js-yaml `4.3.2` | overlapping pins, with older js-yaml and an additional minimatch `brace-expansion@5` pin | unchanged |

The dependency commit is currently owned by the hygiene line and subsumes PR
#29 plus the overlapping dependency portion of PR #30. If closeout is selected
as the landing line, reproduce that dependency result exactly once. PR #30
still requires separate integration review for its
unique CI, migration-verifier, staging-gate, and evidence changes; those files
must not be dropped as duplicate dependency work. No PR was closed, edited, or
merged by this read-only review.

### Pre-landing verifier finding

The unique production migration verifier in PR #30 currently accepts a
successful `GET /api/health/deployment` response when either `commitSha` or
`imageTag` is a full SHA. Its reader does not validate the explicit production
identity fields. The current deployment-health route does expose
`status=live` and `deploymentEnv=production`, so the verifier should require
and test those fields together with the expected revision before landing.
The database adapter still enforces the production database, schema, host,
port, and role boundary; this finding concerns deployment identity evidence
and does not authorize any live probe.

## Remote branches with unique or unresolved work

| Remote ref | Relation to `main` | Review disposition |
| --- | --- | --- |
| `origin/codex/overnight-reconciliation-report-20260902` (`b6662051…`) | 2 commits ahead | Preserve; unique documentation |
| `origin/dependabot/npm_and_yarn/postcss-8.5.26` (`d02b0f31…`) | 1 commit ahead | Preserve until dependency ownership is reconciled with PR #30/current remediation |
| `origin/feature/payload-v2` (`a4b203d3…`) | 22 commits ahead, 1144 behind | Preserve; alternate architecture requires explicit disposition |
| `origin/fix/staging-tailscale-accept-routes-20260902` (`67e8c1e2…`) | 7 commits ahead | Preserve; infrastructure/networking work |
| `origin/jpvbootcamp-v1` (`172897bc…`) | 1 commit ahead, 1323 behind | Preserve pending historical review |
| `origin/release/legacy-domain` (`e88cb8de…`) | 3 commits ahead, 1099 behind | Preserve; legacy-domain work remains unresolved |
| `origin/legacy/production` (`6970b3e7…`) | Fully merged into `main`; 1099 commits behind | Historical ref; deletion still requires explicit authorization and final content check |
| `origin/codex/aug25-stripe-reconciliation` (`26a505d9…`) | Fully merged into `main`; 222 commits behind | Historical ref; deletion still requires explicit authorization and final content check |

The local merge inventory also showed only `main` as a merged local branch. The
merged remote refs above are ancestry observations only; no local or remote ref
was deleted, archived, or rewritten.

The production release pull-request state is closed and clean. PR #37 is the
completed documentation-only closeout represented by this record:

- PR #34 merged as `d55ac6a3` and is deployed.
- PR #35 merged as `cb0fb0c6` and is deployed.
- PR #36 merged as `7ba93c31` and is deployed.
- PR #37 merged as `41662c7d` and is deployed.
- PR #30 and PR #33 were closed without merging.
- No other production release pull requests are open.

Remote branches associated with the merged PRs remain preserved as recovery
references. Other remote branches with unique or unresolved work remain listed
below for separate review; they are not production release inputs.

## Worktree safety

| Worktree | Branch | Dirty state | Safe action |
| --- | --- | ---: | --- |
| /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp | `codex/ux-architecture-consolidation` | dirty | Preserve; independent UX work |
| /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-main | `codex/post-release-baseline-closeout` | clean | Preserve; separate closeout candidate |
| /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-production-preflight-20260907 | `codex/production-migration-preflight-20260907` | clean | Preserve; separate preflight history |
| /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-reconciliation | `codex/repository-reconciliation-20260905` | clean | Preserve; separate reconciliation history |

The merged PR #34 worktree was removed after the merge. No active worktree
containing unfinished or dirty work was removed.

## Consolidation decision

The production hygiene sequence is complete on main. Merged release work is
deployed and verified; local merged-only branches were removed after ancestry
checks; remote refs remain preserved. The independent closeout, preflight,
reconciliation, and UX worktrees remain available for separately reviewed work.
Production data and schema were not changed by this closeout.
