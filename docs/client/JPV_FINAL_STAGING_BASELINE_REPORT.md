# JPV Bootcamp — Final Staging Baseline Report

**Audit date:** 2026-08-23  
**Status:** FROZEN STAGING BASELINE VERIFIED — NOT PRODUCTION AUTHORIZATION
**Project phase:** Phase 9.5 — Feature Branch Reconciliation & Completion

**Canonical staging release candidate:** `9d87c4a3eeeffb9afb78a38964054792330ea1cb`
This exact SHA was pushed, CI-validated, explicitly deployed to staging, and
confirmed by the live health endpoint.

This report is the final staging-truth layer for future release discussions. It
separates repository/CI evidence, supplied migration truth, historical staging
evidence, and missing exact-SHA live evidence. It does not authorize Phase 10,
production deployment, production migration, or any production operation.

## 1. Executive decision

**Staging baseline decision: FROZEN AND VERIFIED.**

The frozen candidate is `9d87c4a…`. The prior `9c0debe…` deployment remains
historical only. Production remains unauthorized.

## 2. Current git state

| Check | Result | Evidence class |
|---|---|---|
| Branch | `feature/course-branding-and-preview` | Verified local |
| Canonical staging-readiness SHA | `4853d63c6a006fd27ab66e365f29de9ade9472d8` | Verified remote and CI |
| Local HEAD | Unpushed documentation-only descendant; verify with `git rev-parse HEAD` | Documentation-only descendant |
| Origin feature tip | `4853d63c6a006fd27ab66e365f29de9ade9472d8` | Verified remote |
| Local/remote relationship | Local is ahead by two documentation-only commits; it is excluded from staging claims | Verified local |
| Main | `6970b3e7d4131abf2614991e694f8713f5168b33` | Verified local |
| Protected residue | `.claude/worktrees/**`, `newrelic_agent.log`, and tracked `.bak` remain untouched | Verified local |
| Other uncommitted docs | Cutover candidate and main-reconciliation reports remain untracked | Verified local |
| Application changes | None made by this audit | Scope invariant |

Older current-truth wording naming `b771cfc` and `7291363` is superseded by the canonical
baseline rule in this report. Historical deployment SHA `9c0debe…` remains
deployment evidence for 2026-08-21 only.

## 3. Frozen readiness documentation

The following documents were inspected:

- `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`
- `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`
- `docs/release/FINAL_CUTOVER_CANDIDATE_VERIFICATION_PACKAGE_2026-08-23.md`
- `docs/release/MAIN_BRANCH_RECONCILIATION_REVIEW_2026-08-23.md`
- `docs/release/PRODUCTION_READINESS_AND_CUTOVER_PREPARATION_PACKAGE_2026-08-23.md`
- `docs/client/JPV_STAGING_LAUNCH_READINESS_EVIDENCE_PACKAGE.md`
- `docs/client/ROADMAP_PROGRESS_STATUS.md`

Authority is reconciled as follows:

- Phase 9.5 current truth is the controlling implementation/reconciliation
  document.
- The production-readiness package is the controlling future cutover-prep
  assessment and states production NO-GO.
- The staging launch package is historical and explicitly says it is not
  current live evidence.
- The roadmap retains historical SHA, migration, and acceptance records; those
  records are valid provenance only and must not be interpreted as current
  exact-SHA proof.

## 4. CI and release-gate evidence

The exact candidate was validated by:

- Push validation run: local `pnpm test:release` passed `164/164`
- SHA: `9d87c4a3eeeffb9afb78a38964054792330ea1cb`
- Push validation: successful
- Deterministic release gate: `164/164`
- Browser E2E: passed with declared skips
- Explicit staging deployment: successful

This is the authoritative repository/CI evidence for the canonical baseline,
but it does not prove a live staging deployment of `4853d63…`.

## 5. Staging deployment evidence

The documented staging lane remains:

- URL: `https://preview.jpvbootcamp.com`
- Dokploy: `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`
- Database: `jpvbootcamp`, schema `jpvbootcamp_staging`

Current exact-SHA deployment evidence:

- SHA: `9d87c4a3eeeffb9afb78a38964054792330ea1cb`
- Deploy run: `32649230612`
- `/api/health`: HTTP 200; `status=live`; `deploymentEnv=staging`; `imageTag` and `commit` equal the candidate SHA
- Dokploy/GHCR path: deployment job completed successfully, including exact-SHA convergence and authenticated admin responsiveness
- Public routes: health, home, sign-in, portal, courses, community, account, and billing returned HTTP 200

Historical `9c0debe…` deployment and authenticated LiveKit/browser evidence remain audit history and are not relabeled as evidence for this candidate.

## 6. Migration evidence

### Verified source truth

- The repository migration registry contains 36 canonical Payload migrations.
- The final registered migration is `20260820_000000_live_session_space`.
- Migration contract tests and CI passed.

### Current staging position

- Payload migrations: 36/36 applied
- Pending migrations: `[]`
- Target: `jpvbootcamp_staging`

Read-only workflow run `32649782528` produced sanitized `plan_ok` evidence for
schema `jpvbootcamp_staging`, with Prisma healthy and zero
unexpected/duplicate/malformed records. No database mutation or migration
execution occurred.

Historical 29/35/36 records remain labeled historical and are not contradictory
once their evidence dates and boundaries are respected.

## 7. Acceptance evidence

Current repository evidence:

- local release gate: `164/164`;
- CI/local release gate: `164/164` at `9d87c4a…`;
- browser E2E evidence exists with declared skips.

Historical staging evidence includes:

- portal, authentication, courses, community, account, billing, admin, and
  LiveKit checks;
- LiveKit token and browser acceptance;
- historical deployment health and migration state.

Not claimed as freshly authenticated at the latest candidate SHA:

- live Stripe, email, Bunny, auth, and LiveKit provider verification;
- current media public/private playback and import reconciliation;
- current human/device LiveKit AV validation;
- current rollback, backup, and monitoring evidence.

The deployment job passed its authenticated admin responsive gate. The
unauthenticated LiveKit token probes returned the expected HTTP 400 validation
response; historical authenticated token/browser evidence remains historical.

## 8. Contradictions reconciled

| Contradiction | Resolution |
|---|---|
| Current docs cited older candidate SHAs | `9d87c4a` is the frozen exact-SHA staging candidate; older values remain historical. |
| Some roadmap sections say “current deployed SHA” and “complete” | Those entries are retained as dated historical checkpoints; current exact-SHA proof is still absent. |
| Historical 35/35, 29-pending, and current supplied 36/36 migration records | They refer to different dated states; current supplied staging position is 36/36, but it lacks a fresh raw artifact. |
| Historical staging package says readiness while newer truth says not verified | The package is explicitly historical; Phase 9.5 current truth controls present interpretation. |
| CI and live staging evidence are different layers | Both are recorded separately: local release gate `164/164`, deployment run `32649230612`, and read-only plan run `32649782528`. |

## 9. Remaining blockers

1. Preserve the frozen evidence and keep production authorization separate.
2. Complete production backup, restore, rollback, monitoring, and approval
   evidence only after explicit authorization.

## 10. Roadmap position

- Phase 8: implementation complete; staging baseline frozen.
- Phase 9: implementation complete; staging baseline frozen. Historical
  authenticated LiveKit acceptance remains labeled historical.
- Phase 9.5: staging reconciliation complete for this candidate.
- Phase 10: not started and not authorized.
- Phase 11 partner affiliates: deferred unless separately promoted and
  approved.

## 11. Final staging truth

The repository, CI, staging deployment, live health, and read-only migration
state are verified for `9d87c4a…`. Provider, rollback, backup, monitoring, and
production authorization remain separate operational gates.

**Final status: STAGING BASELINE FROZEN AND VERIFIED. Production remains NO-GO
and unauthorized.**

No Phase 10 branch, production deployment, production migration, or production
operation may begin from this report.
