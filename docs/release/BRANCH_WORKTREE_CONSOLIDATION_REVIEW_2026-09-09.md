# JPV Bootcamp — Branch and Worktree Consolidation Review — 2026-09-09

**Status:** POST-DEPLOYMENT REVIEW — PR #31 and PR #32 are merged and production
is verified on `c72ad378`; no branch/worktree/ref deletion was performed

**Audit repository:** `jpv-bootcamp`

**Audit branch:** `codex/production-hygiene-20260907`

The reviewed hygiene release was merged as PR #31 and the production image
Bookworm fix was merged as PR #32. Publish workflow `34375016540` passed and
the live deployment-health endpoint reports the same production image. The
branch and worktree inventory below is retained as the pre-deployment audit;
unfinished and dirty work remains preserved.

This review records the current Git topology and safe disposition. An ancestry
relationship is evidence for review; it is not authorization to delete a branch,
remove a worktree, or rewrite history.

## Current release lines

| Ref | Tip | Relation to `main` | Worktree | Disposition |
| --- | --- | --- | --- | --- |
| `main` | `f93ffac7dd299c39d8daf242d6a436272cc79188` | Production authority | `jpv-bootcamp-main` is a separate closeout worktree | Preserve |
| `codex/production-hygiene-20260907` | current pushed tip | Ahead of `main`; synchronized with origin | `jpv-bootcamp-production-hygiene-20260907` — clean after the functional split and handoff refreshes | Preserve; PR #31 requires human review |
| `codex/post-release-baseline-closeout` | `761087a1fedfdbefcdbe14b1ad92c1b6ebf0ac2a` | 22 commits ahead; contains hygiene, preflight, and reconciliation histories | `jpv-bootcamp-main` — clean | Candidate integration line; no merge performed |
| `codex/production-migration-preflight-20260907` | `16b3424c4339a355fcd9e15067d1fc6341b3ef52` | 13 commits ahead; contained in closeout | `jpv-bootcamp-production-preflight-20260907` — clean | Preserve until closeout landing is verified |
| `codex/repository-reconciliation-20260905` | `8b1f459fed358776fda791553ef225cc9f03b2ae` | 10 commits ahead; contained in closeout | `jpv-bootcamp-reconciliation` — clean | Preserve until closeout landing is verified |
| `codex/repository-hardening-20260902` | `31c79574854ec6fc70e3e094da3d3537c112c6cd` | 11 commits ahead; not contained in closeout | No dedicated worktree | Preserve; open PR #30 contains unique CI/docs/dependency work |
| `codex/ux-architecture-consolidation` | `a9629399554336436393029b501e93fc4b03b98c` | Diverged; 1 commit ahead and 272 behind | `jpv-bootcamp` — 57 dirty entries | Preserve; unfinished and unique |

The closeout line contains the pre-split hygiene tip, plus the preflight and
reconciliation branch tips, by ancestry. It does not contain the five new
local commits at `59eddf98`; no merge or fast-forward was performed during this
audit.

The closeout line is not dependency-current: its committed tree still declares
Next.js `^16.3.0` and Sharp `^0.35.0`. The new dependency closure is committed
on the hygiene line only and must be applied exactly once if the closeout line
is selected; ancestry alone does not prove that the newer dependency
remediation is present.

The patch-equivalence audit confirms that the closeout line contains the
hygiene branch, while `codex/repository-hardening-20260902` is not redundant:
its ten unique commits include the guarded production migration verifier,
deterministic main-branch CI gating, staging migration-gate reconciliation,
the Stripe `qs` advisory patch, and related evidence. Those changes require a
separate review and dependency reconciliation before landing. The UX branch is
divergent and dirty, so it remains an independent preserved workstream.

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
`imageTag` is a full SHA. The reader does not validate an explicit production
identity field, and the current deployment-health route exposes neither
`deploymentEnv` nor `status`. Before landing this verifier, add a positive
production identity check to the response contract or document and test the
trusted-origin guarantee that replaces it. The database adapter still enforces
the production database, schema, host, port, and role boundary; this finding
concerns deployment identity evidence and does not authorize any live probe.

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

The open review set at audit time was:

- PR #31: `codex/production-hygiene-20260907`, blocked and review required.
- PR #30: `codex/repository-hardening-20260902`, blocked and review required;
  its validation check had passed, but its dependency pins overlap the current
  remediation.
- PR #29: `dependabot/npm_and_yarn/postcss-8.5.26`, blocked and review required.

## Worktree safety

| Worktree | Branch | Dirty state | Safe action |
| --- | --- | ---: | --- |
| `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp` | `codex/ux-architecture-consolidation` | 57 entries | Preserve; inspect and commit or archive deliberately |
| `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-main` | `codex/post-release-baseline-closeout` | 0 entries | Preserve as clean closeout candidate |
| `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-production-hygiene-20260907` | `codex/production-hygiene-20260907` | clean; synchronized with origin | Preserve; do not merge until branch ownership is selected |
| `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-production-preflight-20260907` | `codex/production-migration-preflight-20260907` | 0 entries | Preserve until closeout landing is verified |
| `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-reconciliation` | `codex/repository-reconciliation-20260905` | 0 entries | Preserve until closeout landing is verified |

## Consolidation decision

The safe landing sequence is:

1. Select either the hygiene branch or the closeout branch as the single
   landing line.
2. Reconcile the current dependency remediation against PR #30 and PR #29,
   retaining one final dependency patch.
3. Keep the five logical commit boundaries described in the hygiene review:
   dependency remediation, baseline response security hardening, runtime
   topology evidence, branch/worktree review, and release/operator documentation.
4. Re-run the full release and static gates on the selected landing line.
5. Only after successful landing and a complete content review should any
   contained branch or clean redundant worktree be considered for removal.

No branch or worktree is removed by this record. The dirty UX work remains
preserved, the hygiene commits remain pushed on PR #31, and the
production release authority remains `main`.
