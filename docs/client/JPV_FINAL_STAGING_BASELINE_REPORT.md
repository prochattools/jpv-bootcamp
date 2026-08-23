# JPV Bootcamp — Final Staging Baseline Report

**Audit date:** 2026-08-23  
**Status:** RECONCILED WITH OPEN EVIDENCE GAPS — NOT PRODUCTION AUTHORIZATION  
**Project phase:** Phase 9.5 — Feature Branch Reconciliation & Completion

**Canonical staging-readiness baseline:** `4853d63c6a006fd27ab66e365f29de9ade9472d8`  
This is the last pushed feature tip with successful CI validation. The local
unpushed documentation-only descendant (verify the exact tip with
`git rev-parse HEAD`) is
not deployed, not CI-validated, and not staging evidence.

This report is the final staging-truth layer for future release discussions. It
separates repository/CI evidence, supplied migration truth, historical staging
evidence, and missing exact-SHA live evidence. It does not authorize Phase 10,
production deployment, production migration, or any production operation.

## 1. Executive decision

**Staging baseline decision: CANONICAL BASELINE IDENTIFIED; EXACT LIVE PROOF
REMAINS OUTSTANDING.**

The canonical baseline is the pushed/CI-verified `4853d63…`. The local
unpushed documentation-only descendant is deliberately excluded from staging claims.
The historical staging deployment still refers to `9c0debe…`, so the baseline
is suitable as a reproducible repository/CI truth record, not as proof that the
canonical SHA is currently deployed.

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

The last successful GitHub Actions run is:

- Run: `32643645302`
- SHA: `4853d63c6a006fd27ab66e365f29de9ade9472d8`
- Push validation: successful
- Deterministic release gate: `164/164`
- Browser E2E: passed with declared skips
- Deployment job: skipped
- Migration-plan job: skipped

This is the authoritative repository/CI evidence for the canonical baseline,
but it does not prove a live staging deployment of `4853d63…`.

## 5. Staging deployment evidence

The documented staging lane remains:

- URL: `https://preview.jpvbootcamp.com`
- Dokploy: `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`
- Database: `jpvbootcamp`, schema `jpvbootcamp_staging`

The strongest recorded deployment evidence is historical:

- SHA: `9c0debe3bdf0fc5a9c9be99a6697eb6bbff3419d`
- Deploy run: `32462177363`
- Date: 2026-08-21
- Recorded state: healthy staging, GHCR/Dokploy deployment path operational

Missing for the current candidate:

- exact `4853d63…` deployment receipt;
- immutable GHCR image digest;
- Dokploy convergence result tied to that digest;
- repeated current health/ONLINE samples;
- current staging browser/provider acceptance packet.

## 6. Migration evidence

### Verified source truth

- The repository migration registry contains 36 canonical Payload migrations.
- The final registered migration is `20260820_000000_live_session_space`.
- Migration contract tests and CI passed.

### Supplied staging position

- Payload migrations: 36/36 applied
- Pending migrations: `[]`
- Target: `jpvbootcamp_staging`

This is a sanitized release-lead position recorded in the Phase 9.5 current
truth. No database query or migration was performed by this audit.

### Missing evidence

- fresh timestamped raw/sanitized staging artifact tied to the final SHA;
- schema identity and Prisma-health field in that artifact;
- independently verifiable current staging deployment-to-migration linkage.

Historical 29/35/36 records remain labeled historical and are not contradictory
once their evidence dates and boundaries are respected.

## 7. Acceptance evidence

Current repository evidence:

- local release gate: `164/164`;
- CI release gate: `164/164` at `4853d63…`;
- browser E2E evidence exists with declared skips.

Historical staging evidence includes:

- portal, authentication, courses, community, account, billing, admin, and
  LiveKit checks;
- LiveKit token and browser acceptance;
- historical deployment health and migration state.

Not currently proven at the latest candidate SHA:

- exact-SHA staging member/admin/browser acceptance;
- live Stripe, email, Bunny, auth, and LiveKit provider verification;
- current media public/private playback and import reconciliation;
- current human/device LiveKit AV validation;
- current rollback, backup, and monitoring evidence.

## 8. Contradictions reconciled

| Contradiction | Resolution |
|---|---|
| Current docs cite `b771cfc` or `7291363` while local documentation has advanced | `4853d63` is canonical for staging readiness; local documentation-only descendants are excluded from staging claims. |
| Some roadmap sections say “current deployed SHA” and “complete” | Those entries are retained as dated historical checkpoints; current exact-SHA proof is still absent. |
| Historical 35/35, 29-pending, and current supplied 36/36 migration records | They refer to different dated states; current supplied staging position is 36/36, but it lacks a fresh raw artifact. |
| Historical staging package says readiness while newer truth says not verified | The package is explicitly historical; Phase 9.5 current truth controls present interpretation. |
| CI is green while staging is not current-verified | CI proves repository/CI behavior only; it does not prove live deployment or provider state. |

## 9. Remaining blockers

1. Push and CI-validate the documentation-only candidate tip, or designate the
   already-CI-verified SHA as the final candidate.
2. Obtain exact-SHA staging deployment, image digest, Dokploy convergence,
   health, and repeated ONLINE evidence.
3. Attach a fresh sanitized staging migration artifact with schema identity,
   pending list, and Prisma health.
4. Execute or record current exact-SHA staging/provider/acceptance evidence.
5. Close or approve-deferral for remaining Phase 9.5 implementation decisions:
   reactions, media execution, preview content, and partner processing.
6. Complete backup, restore, rollback ownership, monitoring, and approval
   evidence before any production discussion advances.

## 10. Roadmap position

- Phase 8: implementation complete; current exact-SHA live evidence not
  re-established by this audit.
- Phase 9: implementation complete; current exact-SHA LiveKit evidence not
  re-established by this audit.
- Phase 9.5: active reconciliation/completion; not fully closed.
- Phase 10: not started and not authorized.
- Phase 11 partner affiliates: deferred unless separately promoted and
  approved.

## 11. Final staging truth

The repository and CI are healthy at the canonical baseline `4853d63…`, and
the supplied staging migration position is 36/36 with no pending migration.
Current exact-SHA staging deployment, migration artifact, provider,
acceptance, rollback, and monitoring evidence are still missing.

**Final status: STAGING BASELINE RECONCILED, EXACT-CURRENT-SHA VERIFICATION
OUTSTANDING. Production remains NO-GO and unauthorized.**

No Phase 10 branch, production deployment, production migration, or production
operation may begin from this report.
