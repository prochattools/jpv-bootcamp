# Production Cutover Plan — Feature Branch to Main

> **HISTORICAL CUTOVER PLAN.** This 2026-08-23 feature-branch plan is preserved
> for provenance. Current repository reconciliation, branch disposition, and
> release gates are owned by
> `REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md` and
> `REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md`.

**Status:** PLAN ONLY — no git operation, merge, push, deployment, migration, or production change has been executed by this plan
**Prepared:** 2026-08-23
**Working branch:** `feature/course-branding-and-preview`
**Related reconciliation:** `docs/release/BRANCH_RECONCILIATION_2026-08-23.md`
**Current baseline dossier:** `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md`
**Historical Phase 9.5 truth:** `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`
**Historical Phase 9.5 backlog:** `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`

## Recommendation

Do not rename the feature branch to `main`, reset `main`, or force-push the feature tip over `main`. The safe path is a protected, reviewed integration merge:

1. Freeze both refs and record their exact SHAs.
2. Tag the existing `main` tip as an immutable archive.
3. Create `release/production-cutover` from the frozen, validated feature SHA.
4. Merge the archived `main` tip into that cutover branch and reconcile the small remaining semantic surface there.
5. Validate and deploy the cutover branch through the approved staging lane.
6. Obtain explicit production approval and independent live/provider evidence.
7. Open and merge a protected PR from `release/production-cutover` into `main`.

This preserves the old application, retains a visible merge record, and makes rollback possible without rewriting shared history.

## Verified repository boundary at preparation time

| Reference | Value |
| --- | --- |
| Feature branch | `feature/course-branding-and-preview` |
| Feature starting tip | `ae8c886d125200d94a8ee7aec005b6226a1304e0` |
| Main tip | `6970b3e7d4131abf2614991e694f8713f5168b33` |
| Merge base | `f96056394a4ed6fe2a710121a1771d9024f48dcf` |
| Feature commits ahead of main | 769 |
| Main commits absent from feature | 16 |
| Main-only tree delta | `src/app/(frontend)/page.tsx`; `src/components/sponsored-pay-it-forward.tsx` |
| Current migration registry | 36 registered migrations, ending with `20260820_000000_live_session_space` |

These values are an inspection snapshot, not a future cutover authorization. Recompute them immediately before creating any cutover branch.

The current feature worktree is dirty and the current staging/provider state is not live-verified by the reconciliation dossier. No cutover branch may be created from this snapshot.

## Required reconciliation decisions

### Named feature branches

The following named branches had no unique commits missing from the current feature branch and require no merge: `feat/sponsored-seats`, `feature/homepage-updates`, `feature/payload-integration`, `feature/prokit-docs-sync`, and `stripe-portal-redirect-only`.

`feature/payload-v2` has 22 unique commits, but it is an older Payload bootstrap/debugging line. Its production-default Docker/migration behavior and alternate route/layout setup are superseded by the current staging-only runner, current route groups, explicit target guards, and current 36-entry migration registry. Do not cherry-pick it as a bundle. Any individual fix must be justified against the current files in a separate review.

### Main-only work

The 16 main-only commits collapse to two files. Before the cutover merge, create or update a reconciliation matrix with one disposition for every main-only commit:

| Disposition | Meaning |
| --- | --- |
| Adopt | compatible copy or behavior is carried into the cutover result |
| Supersede | the feature branch has the newer approved behavior |
| Drop with rationale | the main-only direction is intentionally not carried forward |

Default architectural position pending product approval: preserve the feature branch's single-membership model, `?plan=membership&billing=monthly|annual` checkout contract, internal `/portal` routes, and staging-only operational boundary. Main-only changes that conflict with those invariants are superseded; compatible hero-copy changes may be adopted after review.

## Future execution procedure

### 1. Freeze and inspect

Confirm the worktree is clean except for explicitly documented protected residue. Fetch refs without changing files, then record:

```bash
git rev-parse feature/course-branding-and-preview
git rev-parse origin/feature/course-branding-and-preview
git rev-parse main
git rev-parse origin/main
git merge-base feature/course-branding-and-preview main
git diff --check
```

The final feature SHA must include the cleanup/documentation changes and must be the same SHA used for every later validation and deployment claim.

### 2. Archive the old application

After approval, create an annotated archive tag on the exact frozen `main` SHA. Substitute the verified SHA; do not copy the preparation snapshot blindly:

```bash
git tag -a archive/main-pre-cutover-<main-sha-short> <main-sha> \
  -m "Pre-cutover main snapshot — <UTC timestamp>"
git push origin archive/main-pre-cutover-<main-sha-short>
```

An archive branch may be created for browsing if needed, but the tag is the required rollback anchor. Do not delete or rewrite `main`.

### 3. Create the integration branch

Create the cutover branch from the exact feature SHA that passed repository validation:

```bash
git switch --create release/production-cutover <validated-feature-sha>
git push --set-upstream origin release/production-cutover
```

All main reconciliation happens on this branch. Keep the feature branch unchanged as the validated source reference.

### 4. Merge main into the cutover branch

Use a non-fast-forward merge so the integration decision remains auditable:

```bash
git switch release/production-cutover
git merge --no-ff <frozen-main-sha> \
  -m "merge: reconcile main into production cutover"
```

Resolve only after reviewing the matrix. The expected semantic conflict surface is the landing page and sponsored pay-it-forward component, but verify the actual diff rather than assuming it.

### 5. Validate the reconciled tree

At the reconciled cutover SHA, run the repository-defined gates, including:

```bash
pnpm toolchain:check
pnpm test:release
pnpm test:e2e
git diff --check
```

Run the focused provider/auth/security checks and the operator-owned staging acceptance suite required by `docs/release/GO_NO_GO_CHECKLIST.md`, `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md`, and `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`. A green local suite is not evidence of staging, provider, database, or production state.

### 6. Stage and verify

Deploy only the exact cutover SHA through the guarded staging workflow. The permitted preview lane remains:

- branch: `feature/course-branding-and-preview` while the current workflow contract requires it;
- origin: `https://preview.jpvbootcamp.com`;
- Dokploy app: `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`;
- database schema: `jpvbootcamp_staging`.

If production cutover requires a workflow or environment change because the guarded preview workflow does not accept `release/production-cutover`, make that a separately reviewed infrastructure change. Do not weaken the staging allowlist or infer production deployment from a staging success.

Record exact-SHA deployment identity, repeated health samples, migration state, auth/billing/provider smoke, content approval, monitoring, rollback owner, and approval evidence. A health endpoint or successful workflow alone is insufficient.

### 7. Advance main through a protected PR

Only after the cutover branch passes all repository and external gates:

1. Open a PR from `release/production-cutover` into `main`.
2. Require normal branch protection, reviews, and status checks.
3. Reference the archive tag, reconciliation matrix, validated cutover SHA, and evidence packet.
4. Merge through the protected host workflow; do not force-push or reset.
5. Retain the archive tag and cutover branch.

After the merge, independently verify the installed/deployed identity, receipt/topology, rollback anchor, and repeated online samples. Do not call the release live from the merge result alone.

## Rollback boundaries

- If reconciliation or staging validation fails, stop before merging into `main`; keep the cutover branch for diagnosis and redeploy the last approved staging SHA through the normal guarded path.
- If production has not been advanced, the archive tag is the preserved old-application reference.
- If production has been advanced and a regression appears, use the approved production rollback procedure and evidence checklist. Do not reset or force-push `main` as an incident response.
- Any database rollback must follow the migration-specific rollback/restore plan and named owner; application rollback and database rollback are separate decisions.

## Explicit non-goals

This document does not authorize production deployment, production migration, provider mutation, branch deletion, worktree pruning, force-push, reset, or archive deletion. Those actions require a separate, explicit cutover instruction and fresh live evidence.
