# Feature-Branch Reconciliation — 2026-08-23

**Status:** repository cleanup and review record; no merge, push, deploy, migration, or production operation performed

**Current baseline dossier:** `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md`
**Phase 9.5 current truth:** `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`
**Phase 9.5 backlog:** `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`

## Authoritative working context

| Item | Verified value |
| --- | --- |
| Working branch | `feature/course-branding-and-preview` |
| Starting committed tip | `ae8c886d125200d94a8ee7aec005b6226a1304e0` |
| Remote relation | local tip matched `origin/feature/course-branding-and-preview` at inspection |
| `main` tip | `6970b3e7d4131abf2614991e694f8713f5168b33` |
| Merge base | `f96056394a4ed6fe2a710121a1771d9024f48dcf` |
| Main-only commits | 16 commits; the tree delta is confined to two files |
| Local release manifest | `pnpm test:release` passed `164/164` after cleanup |
| Browser suite | `148 passed`, `60 skipped`; the initial 24 shared muted-token contrast failures were cleared by this cleanup |

The working tree also contains pre-existing protected changes under `.claude/worktrees/**` and `newrelic_agent.log`. They are intentionally excluded from this reconciliation and must not be cleaned, staged, or committed by this task.

## Feature-branch inventory

The named branches were compared by ancestry and unique commit counts before any change:

| Reference | Finding | Disposition |
| --- | --- | --- |
| `feat/sponsored-seats` | no commits missing from the current feature branch | already represented; do not merge |
| `feature/homepage-updates` | no commits missing from the current feature branch | already represented; do not merge |
| `feature/payload-integration` | no commits missing from the current feature branch | already represented; do not merge |
| `feature/prokit-docs-sync` | no commits missing from the current feature branch | already represented; do not merge |
| `stripe-portal-redirect-only` | no commits missing from the current feature branch | already represented; do not merge |
| `feature/payload-v2` | 22 commits unique to an older Payload bootstrap/debugging line | superseded; do not cherry-pick blindly |

The `feature/payload-v2` commits use older production-default Docker/migration behavior and alternate Payload route/layout wiring. The current branch has the later staging-only runner, explicit target guards, current route groups, and the 36-entry migration registry. A selective future adoption would require a separate issue with file-level evidence; this reconciliation finds no safe missing fix to import from that branch.

Old agent worktree refs were also inspected as historical pointers. They are not named feature branches and are not merged or pruned here. Their changes must be compared against current files before any future adoption.

## Main reconciliation boundary

`main` is not a drop-in replacement for the current feature branch. It is 769 commits behind the feature tip and has 16 commits not present on the feature branch. Those 16 commits reduce to this two-file semantic review surface:

- `src/app/(frontend)/page.tsx`
- `src/components/sponsored-pay-it-forward.tsx`

The feature branch's current single-membership checkout, internal `/portal` routes, and staging-only operational boundary remain the working architecture. The main-only pricing/CTA and sponsored-access changes must be classified as adopt, supersede, or drop with rationale on a dedicated cutover integration branch. No cherry-pick or direct branch replacement is authorized by this document.

### Main-only commit disposition matrix

Every main-only commit is classified here before any future integration work. The historical workflow-dispatch commits are superseded by the current feature-branch workflow contract; the landing-page and sponsored-access commits are superseded by the later feature-branch implementation and current single-membership contract.

| Main-only commit | Subject | Disposition | Rationale |
| --- | --- | --- | --- |
| `6970b3e` | Revert workflow-dispatch input schema on default branch | Drop with rationale | Historical default-branch repair; preserve current `main` archive tip, do not replay. |
| `0b649f0` | Revert workflow registry re-index | Drop with rationale | Historical GitHub workflow registration repair; current feature workflow is the allowed staging lane. |
| `8fe9b93` | Revert operation input type change | Drop with rationale | Historical default-branch workflow repair; not application behavior. |
| `bc1523a` | Change operation input type | Supersede | Current feature workflow owns its own guarded input contract. |
| `5908298` | Force workflow registry re-index | Drop with rationale | Default-branch infrastructure workaround; no current feature behavior to import. |
| `b713d66` | Register workflow-dispatch input schema | Drop with rationale | Default-branch operational workaround; replaying it would blur the feature-only boundary. |
| `4995dcc` | Optimize hero notice card styling | Supersede | Later feature-branch landing implementation is the reviewed visual authority. |
| `de91d69` | Add React.ReactNode hero notice type | Supersede | Type belongs to the superseded main-only landing implementation. |
| `24045e6` | Update hero notices and pricing features | Supersede | Conflicts with the current approved feature-branch content/checkout contract. |
| `d7e93be` | Use VIP Stripe plan for membership CTA | Supersede | Current contract uses one membership with monthly/annual billing; legacy tier aliases are not current semantics. |
| `08a5f0f` | Update monthly price and checkout URL | Supersede | Current feature branch owns the validated checkout route and pricing copy. |
| `79680f0` | Add pricing plan type annotation | Supersede | Type repair is coupled to the superseded main-only page shape. |
| `2ca6ce1` | Make CTA target/rel optional | Supersede | Same superseded page implementation; re-evaluate only if a current file needs it. |
| `cca340a` | Update pricing section to two-tier model | Supersede | Current product model is one membership with two billing options, not two public tiers. |
| `6f252a2` | Merge feature branch into main | Drop with rationale | Historical merge point; no merge commit should be replayed into a future cutover branch. |

## Cleanup performed in this pass

- Removed the tracked `src/app/(frontend)/sponsored/claim/page.tsx.bak`; the current page is the authoritative implementation and the backup contained older non-atomic seat-claim logic.
- Removed the unused `/api/portal/community/upload` placeholder route, which returned success without persisting uploads; the canonical implemented path is `/api/community/files` and its troubleshooting documentation now points there.
- Replaced the unused `/affiliate` placeholder programme page with a compatibility redirect to the supported `/partner-referral` intake; Phase 11 affiliate operations remain deferred and are not presented as live.
- Corrected the shared `muted` token from `#A89A80` (2.61:1 against the canvas) to `#6E6350` (5.56:1), corrected landing-page brand text on light/dark surfaces, and aligned `DESIGN.md` and the redesign roadmap with the executable token source.
- Preserved historical release evidence in place; stale snapshots remain audit history and must not be presented as current live evidence.
- Reconciled `docs/ARCHITECTURE.md` with the current one-membership `plan=membership` contract instead of the retired `plan=pro` wording.

## Remaining review gates

1. Focused public/support/visual browser tests pass `60/60`; full browser E2E passes `148/148` with 60 repository-declared skips.
2. `pnpm test:release` passes `164/164` after cleanup.
3. Review the cleanup diff and record any remaining findings before committing.
4. Update the final cutover SHA only after the cleanup is committed and the required external staging/provider/approval evidence is independently reverified.

The exact final cutover SHA cannot be this document's starting SHA while the cleanup is uncommitted.
