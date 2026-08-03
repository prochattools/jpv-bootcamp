# Future Branch Cutover Plan

**Status:** PLAN ONLY — no git operations have been executed
**Prepared:** 2026-08-02
**Branch under assessment:** `feature/course-branding-and-preview`
**Target outcome:** Advance `main` to the verified feature state without discarding any main-only work and without losing history

---

## 1. Divergence Summary

### Verified SHAs

| Reference | SHA |
|---|---|
| Feature tip at audit start | `c15cd578a953cd6b1dc8a3d4705350a52f7d0812` |
| Main tip at audit start | `4995dcc3336f4cd08c337f87f1dd73a4ff48e9c9` |

### Commit counts

| Direction | Count | Notes |
|---|---|---|
| Commits present on main but not on feature branch | 10 | Including 1 merge commit: 6f252a2 |
| Non-merge content commits on main | 9 | Listed below |
| Feature-only commits (non-merge, feature ahead of main) | 630 | Verified at audit time |

### Main-only commits (9 non-merge content commits, newest first; merge commit 6f252a2 not listed)

```
4995dcc  refactor: optimize hero notice card styling
de91d69  fix: add React.ReactNode type for heroNotices
24045e6  feat: update hero notices, annually plan features, pay it forward
d7e93be  fix: change Start Membership button to use VIP Stripe plan
08a5f0f  fix: update Monthly plan price to £80/mo and set correct Stripe checkout
79680c0  fix: add explicit type annotation to pricingPlans array
cd6c83f  fix: make ctaTarget and ctaRel optional in pricing plans
2ca6ce1  fix: add missing ctaTarget and ctaRel properties to Annually plan
cca340a  feat: update pricing section to 2-tier membership model
```

### Main-only functional paths

- `src/app/(frontend)/page.tsx`
- `src/components/sponsored-pay-it-forward.tsx`

### Key semantic differences between branches

| Area | main | feature |
|---|---|---|
| Annual CTA plan parameter | `plan=vip` | `plan=membership&billing=annual` |
| Portal URLs | `portal.jpvbootcamp.com` (legacy external) | `/portal` (internal routes) |
| Sponsored access model | pro/vip two-tier | single-tier available model |
| Pricing model | 2-tier VIP membership | singular membership with billing interval |

---

## 2. Pre-Cutover Prerequisites

All prerequisites must be confirmed complete and recorded before any cutover step is initiated.

### 2.1 Business reconciliation document

`docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md` exists in this commit. Its classifications are proposed decisions only. No future branch reconciliation may proceed until those decisions have received client and operator approval.
It must contain a disposition decision for each of the 9 non-merge content commits present only on main.
Each disposition must be one of: **adopt**, **supersede**, or **drop with rationale**.

### 2.2 Staging baseline locked

The feature branch must be deployed to staging and have passed the full acceptance suite at a pinned SHA.
That SHA becomes the **cutover SHA** referenced throughout this plan.
No further changes to the feature branch are permitted after the cutover SHA is pinned unless the process restarts from this step.

### 2.3 Database migration rehearsal complete

A full data migration rehearsal against a production-snapshot replica must be complete and have produced a signed evidence record (see `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`).

### 2.4 Stripe integration verified

All Stripe checkout flows (monthly, annual, pay-it-forward) must resolve to the correct plan IDs and amounts as defined in the singular membership architecture. No legacy `plan=vip` or external portal URL must remain in any active code path after reconciliation.

### 2.5 Protected branch rules confirmed

Confirm that `main` has branch protection rules in place (required reviews, status checks, no force-push). Document the current ruleset so it can be verified to survive the merge step.

### 2.6 CI/CD integration inventory

List all integrations that reference `main` by name: Dokploy deployment pipelines, GitHub Actions workflows, webhook endpoints, environment variable bindings. Each must be re-verified after the merge lands.

---

## 3. Step-by-Step Cutover Process (Future Plan — Do Not Execute)

### Step 1: Freeze the preparation window

Announce a change freeze on both `main` and `feature/course-branding-and-preview`.
No new commits are merged to either branch until the cutover is complete or explicitly aborted.
Record the freeze start time and the frozen SHAs of both branch tips.

### Step 2: Preserve the old main tip

Create an annotated tag pointing at the current `main` tip so it is permanently reachable regardless of future history:

```bash
git tag -a archive/main-pre-cutover-4995dcc \
  4995dcc3336f4cd08c337f87f1dd73a4ff48e9c9 \
  -m "Pre-cutover main snapshot — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push origin archive/main-pre-cutover-4995dcc
```

Optionally create a non-protected archive branch at the same SHA for browsability:

```bash
git branch archive/main-pre-cutover-4995dcc-branch \
  4995dcc3336f4cd08c337f87f1dd73a4ff48e9c9
git push origin archive/main-pre-cutover-4995dcc-branch
```

This step is irreversible insurance. It costs nothing and enables rollback at any point.

### Step 3: Create the cutover branch from the verified feature tip

Create a dedicated integration branch from the pinned cutover SHA of the feature branch.
Do not use the feature branch directly — the cutover branch is a controlled integration surface.

```bash
git checkout -b release/staging-cutover c15cd578a953cd6b1dc8a3d4705350a52f7d0812
git push -u origin release/staging-cutover
```

All subsequent reconciliation work happens on `release/staging-cutover`, not on the feature branch.

### Step 4: Merge main into the cutover branch

Bring the 9 main-only commits into the cutover branch so all divergence is visible and resolvable in one place:

```bash
git checkout release/staging-cutover
git merge --no-ff 4995dcc3336f4cd08c337f87f1dd73a4ff48e9c9 \
  -m "merge: bring main-pre-cutover into release/staging-cutover for reconciliation"
```

Expect conflicts in:
- `src/app/(frontend)/page.tsx`
- `src/components/sponsored-pay-it-forward.tsx`

Do not auto-resolve. Each conflict is a reconciliation decision.

### Step 5: Resolve main-only changes per the business-reconciliation matrix

For each of the 9 main-only commits, apply the disposition recorded in `docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md`.

**Default position (unless the reconciliation matrix says otherwise):**
The singular membership, internal `/portal` routes, and `plan=membership&billing=monthly|annual` checkout architecture are authoritative. Main-only changes that contradict this architecture are superseded. Changes that are additive and compatible (copy updates, hero notices unrelated to checkout) may be adopted verbatim.

Specific guidance by path:

| Path | Expected conflict area | Default disposition |
|---|---|---|
| `src/app/(frontend)/page.tsx` | `plan=vip` CTA, external portal URLs, 2-tier pricing model | Supersede with feature architecture; adopt non-conflicting copy/notice changes if approved |
| `src/components/sponsored-pay-it-forward.tsx` | pro/vip tier references | Supersede with single-tier available model unless reconciliation matrix approves retention |

Each resolved conflict must be committed with a message referencing the reconciliation matrix entry:

```
reconcile: adopt hero notices from main (see MAIN_STAGING_BUSINESS_RECONCILIATION.md §3)
reconcile: supersede plan=vip with plan=membership checkout (see §4)
```

### Step 6: Run the full validation suite

After all conflicts are resolved and committed:

```bash
# Type-check
pnpm tsc --noEmit

# Unit and integration tests
pnpm test

# Playwright end-to-end (staging target)
pnpm exec playwright test --project=chromium

# Stripe checkout flow smoke tests
# (follow PROVIDER_VERIFICATION_RUNBOOK.md)
```

All gates must pass. No open failures are permitted to advance.
Record the SHA of the last commit on `release/staging-cutover` after all fixes are applied — this becomes the **validated cutover SHA**.

### Step 7: Deploy the cutover branch to staging

Deploy `release/staging-cutover` at the validated cutover SHA to the staging environment using the existing Dokploy pipeline (see `docs/DOKPLOY_DEPLOYMENT_GUIDE.md`).
Do not deploy `main`. Deploy only the cutover branch.

Record:
- Deployed SHA
- Deployment timestamp
- Staging environment URL

### Step 8: Run data migration rehearsal and formal acceptance

Execute the full migration rehearsal procedure against the staging deployment (see `docs/LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md` and `docs/release/GO_NO_GO_CHECKLIST.md`).

Acceptance criteria:
- All go/no-go checklist items pass at the validated cutover SHA
- No data loss in migration rehearsal
- All auth, billing, and access flows verified per `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md`
- Evidence records signed and filed under `docs/release/`

### Step 9: Advance main through a protected, reviewed merge

Only after all gates in Step 8 are approved:

Open a pull request from `release/staging-cutover` into `main`.
The PR must:
- Pass all required status checks
- Receive the required number of approvals
- Use `--no-ff` merge to preserve the integration history
- Reference this document and the validated cutover SHA in the merge commit message

```
# Merge commit message
release: advance main to validated staging-cutover (cutover SHA: <sha>)

Reconciliation: docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md
Cutover plan: docs/release/FUTURE_BRANCH_CUTOVER_PLAN.md
Pre-cutover main snapshot: archive/main-pre-cutover-4995dcc
```

Do not delete `release/staging-cutover` after merging. Retain it as a permanent reference point.

---

## 4. Main-Only Change Disposition

Full per-commit disposition decisions must be recorded in `docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md` (that document exists in this commit with proposed classifications only; no reconciliation step may proceed until client and operator approval is confirmed).

This section provides the framework and default positions only.

### Disposition categories

| Category | Meaning |
|---|---|
| **Adopt** | The main-only change is compatible with the feature architecture and should be carried forward verbatim or with minor adaptation |
| **Supersede** | The feature branch has a newer, approved version of this behavior; the main-only version is replaced |
| **Drop with rationale** | The main-only change represents a direction that has been explicitly reversed; it must not appear in the cutover result and the rationale must be documented |

### Preliminary default dispositions (subject to reconciliation matrix approval)

| Commit | Subject | Preliminary disposition |
|---|---|---|
| `cca340a` | feat: update pricing section to 2-tier membership model | Supersede — feature uses singular membership model |
| `2ca6ce1` | fix: add missing ctaTarget and ctaRel to Annually plan | Supersede — annual plan structure is different in feature |
| `cd6c83f` | fix: make ctaTarget and ctaRel optional in pricing plans | Supersede — pricing plan type definitions have diverged |
| `79680c0` | fix: add explicit type annotation to pricingPlans array | Supersede or adopt — depends on whether types are compatible |
| `08a5f0f` | fix: update Monthly plan price to £80/mo | Supersede — monthly plan is replaced by `billing=monthly` parameter; price to be verified against current Stripe product |
| `d7e93be` | fix: change Start Membership button to use VIP Stripe plan | Supersede — VIP plan is not the current checkout target |
| `24045e6` | feat: update hero notices, annually plan features, pay it forward | Partial adopt — hero notice copy may be compatible; annually plan features and pay-it-forward tie-ins must be evaluated against feature architecture |
| `de91d69` | fix: add React.ReactNode type for heroNotices | Adopt if hero notices are adopted; otherwise supersede |
| `4995dcc` | refactor: optimize hero notice card styling | Adopt if hero notices are adopted; otherwise supersede |

### Architectural invariants that must be preserved

The following must remain true after cutover regardless of reconciliation decisions:

1. All membership checkout CTAs use `?plan=membership` with `&billing=monthly` or `&billing=annual`.
2. All portal links route to internal `/portal` paths, not to `portal.jpvbootcamp.com`.
3. The sponsored access component uses the single-tier available model, not a pro/vip two-tier model.
4. No legacy plan IDs (`vip`, `pro`) appear in any active checkout path unless a new approved decision explicitly re-introduces them.

---

## 5. Validation Gates Before Main Advance

All of the following must be met and recorded before the PR from `release/staging-cutover` into `main` is opened.

| Gate | Evidence required | Owner |
|---|---|---|
| Type-check passes | `tsc --noEmit` output with zero errors | CI log |
| Unit/integration tests pass | Test runner output, zero failures | CI log |
| Playwright E2E suite passes on staging | Playwright report at validated cutover SHA | QA record |
| All go/no-go checklist items pass | Completed `GO_NO_GO_CHECKLIST.md` signed at cutover SHA | Release owner |
| Stripe checkout flows verified | Evidence per `PROVIDER_VERIFICATION_RUNBOOK.md` | Release owner |
| Migration rehearsal complete | Evidence per `LEGACY_MIGRATION_REHEARSAL_EVIDENCE.md` | DBA/release owner |
| Reconciliation matrix approved | `MAIN_STAGING_BUSINESS_RECONCILIATION.md` authored and approved | Product owner |
| Pre-cutover tag pushed | `archive/main-pre-cutover-4995dcc` visible on remote | Release owner |
| No open regressions on staging | Zero unresolved issues from staging validation run | QA |

---

## 6. Why Destructive Approaches Are Not Recommended

The following approaches are explicitly not recommended and must not be used as shortcuts for this cutover.

### 6.1 Direct branch renaming (`git branch -m main feature/...`)

Renaming `feature/course-branding-and-preview` to `main` would:
- Immediately discard all 9 main-only commits without any reconciliation review
- Leave no trace of whether those commits were intentional design decisions or development experiments
- Bypass all branch protection rules that are keyed to the `main` branch name
- Trigger undefined behavior in Dokploy, GitHub Actions, and any other integration that watches the `main` ref

### 6.2 Force-pushing the feature tip onto main (`git push --force origin feature/...:main`)

Force-pushing would:
- Permanently rewrite the public history of `main` for all collaborators and integrations
- Make it impossible to recover the 9 main-only commits without the archive tag created in Step 2
- Obscure which reconciliation decisions were made and when, undermining any audit trail
- Violate branch protection rules; if those rules are suspended to allow it, the suspension itself creates a window of risk for accidental destructive pushes from other actors

### 6.3 Resetting main to the feature tip (`git reset --hard`)

A hard reset would:
- Discard all main-only work silently if the archive tag has not been created first
- Produce a commit graph that shows `main` having diverged with no merge record, making the release tree difficult to review
- Make the exact set of changes reaching production harder to audit because there is no merge commit documenting the integration

### 6.4 Why the structured merge approach is preferred

The structured approach — archive tag, cutover branch, explicit merge, per-commit reconciliation — produces:
- A permanent, tagged snapshot of the pre-cutover main state
- An explicit merge commit documenting exactly which code entered production and when
- A per-commit reconciliation record that satisfies audit and rollback requirements
- A clean rollback path that does not require any force operations

---

## 7. Rollback If Cutover Validation Fails

If any validation gate in Section 5 fails after the cutover branch has been deployed to staging, do not advance to the main merge. Instead:

### 7.1 Triage the failure

Classify the failure as:
- **Blocking regression introduced by reconciliation** — a main-only change was incorrectly adopted and has broken a feature-branch invariant
- **Pre-existing issue on feature branch** — the issue exists independently of the cutover; do not rollback, file a separate defect
- **Infrastructure or environment failure** — not a code regression; resolve the environment issue before re-running gates

### 7.2 If rollback of the staging environment is needed

Redeploy the feature branch at the pinned cutover SHA (the SHA from before the merge in Step 4):

```
Restore staging to: c15cd578a953cd6b1dc8a3d4705350a52f7d0812
```

The `release/staging-cutover` branch is retained but considered blocked. Do not delete it — it preserves the reconciliation work done so far.

### 7.3 Amend the reconciliation matrix

Update `docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md` to record the failure, the root cause, and the revised disposition for the affected commit(s).

### 7.4 Re-enter the process at Step 5

After fixing the reconciliation, re-run the full validation suite (Step 6) against the updated cutover branch. The cutover branch does not need to be recreated unless the git history has become too tangled to review clearly.

### 7.5 Main is never rolled back

If `main` has already been advanced (Step 9) and a regression is discovered after deployment, this is a production incident and must be handled via the standard rollback procedure in `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`, not via this cutover plan.
The pre-cutover tag `archive/main-pre-cutover-4995dcc` provides the revert target if a full revert to the pre-cutover main state is required.

---

## Document history

| Date | Author | Change |
|---|---|---|
| 2026-08-02 | Release tooling | Initial draft — plan only, no git operations executed |
