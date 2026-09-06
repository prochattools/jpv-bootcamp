# JPV Bootcamp — Frozen Phase 9.5 Feature-Branch Release Baseline — 2026-08-23

> **HISTORICAL FROZEN BASELINE.** This dossier remains audit evidence for the
> 2026-08-23 feature-branch state. Current repository reconciliation truth is
> `REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md`; do not treat the
> migration/deployment counts below as current environment state.

**Status: FROZEN RECONCILIATION BASELINE / NOT A RELEASE CANDIDATE / NOT A PRODUCTION GO**

For this 2026-08-23 historical baseline, the Phase 9.5 interpretation is
recorded in `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md` and its dated
backlog. Present repository status is owned by the 2026-09-06 authority linked
above.

This dossier is the single authoritative frozen baseline for the current Phase
9.5 feature-branch reconciliation. It consolidates the release-manager review,
the referenced JPV
Bootcamp conversation history, repository evidence, and the current document
set. It does not authorize deployment, migration, provider mutation, or
production cutover.

Evidence is deliberately separated into four states:

- **Local/source evidence:** present in the checked-out repository or produced by
  local validation.
- **Committed evidence:** present at the current committed repository tip.
- **Historical staging evidence:** recorded by an earlier staging run, but not
  reverified against the current release candidate in this pass.
- **Current live evidence:** absent unless explicitly marked as reverified below.

For migration truth specifically, the current release-lead verified position is
recorded as a sanitized snapshot: staging schema `jpvbootcamp_staging` has all
36 registered Payload migrations applied and no pending Payload migration.
This is not a claim that the dirty feature worktree is deployed, and it is not
a migration authorization.

## Canonical frozen baseline

This section is the release baseline to use when older handoffs or staging
packages disagree. “Frozen” means the evidence classification and repository
state recorded on 2026-08-23; it does not claim that the dirty worktree is a
final commit or that the current feature tip is deployed.

| Baseline element | Authoritative value | Evidence class |
|---|---|---|
| Feature branch | `feature/course-branding-and-preview` | Current local repository state |
| Feature branch committed SHA | `ae8c886d125200d94a8ee7aec005b6226a1304e0` | Current committed tip; not a final release SHA while the worktree is dirty |
| Staging deployment SHA | `9c0debe3bdf0fc5a9c9be99a6697eb6bbff3419d` | Historical last recorded deployment, run `32462177363` on 2026-08-21; not claimed current |
| Staging target | `https://preview.jpvbootcamp.com`; Dokploy `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`; database `jpvbootcamp`, schema `jpvbootcamp_staging` | Allowed target boundary; not live-reverified here |
| Migration state | 36/36 registered Payload migrations applied; pending `[]`; last migration `20260820_000000_live_session_space` | Current release-lead supplied sanitized snapshot; no database access in this pass |
| Deployment state | Last recorded staging deployment is `9c0debe...`; current `ae8c886...` is not deployed or exact-SHA verified | Split historical/current state |
| Acceptance evidence | Historical Phase 8 portal `84/84`, admin responsive `14/14`; historical Phase 9 LiveKit browser `5/5`; local release suite `164/164`; local focused browser `60/60`; exact current-SHA staging acceptance absent | Historical and local evidence, explicitly separated |
| Production and Phase 10 | Production untouched and not authorized; Phase 10 not started | Hard restriction |

## Authority and deduplication map

- **Current frozen baseline:** this document.
- **Current implementation truth:** `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`.
- **Remaining implementation backlog:** `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`.
- **Branch ancestry and stale branch disposition:** `docs/release/BRANCH_RECONCILIATION_2026-08-23.md`.
- **Future cutover procedure only:** `docs/release/FUTURE_BRANCH_CUTOVER_PLAN.md`.
- **Historical duplicate staging packages:** `docs/client/JPV_STAGING_LAUNCH_READINESS_EVIDENCE_PACKAGE.md` and `docs/client/LAUNCH_READINESS_EVIDENCE_PACKAGE_STAGING.md`. Both are retained for audit provenance and are not current exact-SHA evidence.
- **Historical migration packets/runbooks:** `docs/client/MIGRATION_29_AUTHORIZATION_PACKET.md`, `docs/client/MIGRATION_APPROVAL_PACKET.md`, `docs/client/MIGRATION_APPROVAL_STATUS.md`, and `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`. Their old counts, SHAs, and commands are non-operative.
- **Historical business and product reviews:** `docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md` and `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`. Their old branch tips and product terminology are audit/design provenance only.

No historical document is deleted. Where an older document contains a current-
sounding readiness statement, its new banner is the required interpretation:
historical evidence may explain what happened, but only this baseline and the
Phase 9.5 authority documents describe current truth.

## Historical work reconciliation

| Workstream from the Claude/Codex history | Reconciled disposition |
|---|---|
| Phase 8 Member Portal Operationalization | Complete in the reviewed source/local release evidence. Historical staging evidence recorded portal `84/84`, admin responsive `14/14`, and the performance/query-dedup fixes. Exact current-SHA staging acceptance remains unverified. |
| Phase 9 LiveKit Group Calls | Complete in the reviewed source and historical staging evidence: migration 36, token/entitlement paths, and browser acceptance `5/5`. Real-device audio/video and current exact-SHA staging identity remain unverified. |
| Migration 36 application | Current supplied staging position is 36/36 applied with pending `[]`. Source registry, read-only current-state runner, workflow assertions, tests, and current docs now represent 36/`[]`; 29 and 35 baselines remain historical. No migration ran in this reconciliation. |
| Portal performance fixes | Historical evidence recorded community response around 130ms versus roughly 60 seconds after query de-duplication and membership prefetch work. This is retained as historical performance evidence, not a current staging SLA. |
| GHCR/Dokploy deployment fixes | Historical repair corrected the image namespace/token-scope path and restored the Dokploy retrigger route. The current image identity and convergence are not reverified at `ae8c886...`. |
| Acceptance testing evidence | Historical portal, admin, LiveKit, and release-gate results are retained with dates/SHA boundaries. Local current-branch validation is separate; current exact-SHA staging acceptance is still absent. |
| Migration runner improvements | The guarded staging-only runner now has explicit read-only current-state mode and 36/`[]` assertions. The closed 35→36 apply/rollback path remains safety history and is not executable by this reconciliation. |
| Documentation reconciliation | Current truth, backlog, branch reconciliation, and this frozen baseline now define the authority chain. Duplicate and obsolete packets are labeled historical/non-operative; no application behavior was changed for this release-document pass. |

## A. Final release baseline

### A.1 Git and branch state

| Item | Observed state | Release interpretation |
|---|---|---|
| Active branch | `feature/course-branding-and-preview` | Correct working lane. |
| Local committed tip | `ae8c886d125200d94a8ee7aec005b6226a1304e0` | Review starting point only; not the final release SHA because the worktree is dirty. |
| Remote feature tip | Matched local HEAD during review | Remote parity was observed for the committed tip; it does not include current uncommitted edits. |
| Main worktree | `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-main` | Kept separate and untouched. |
| Main SHA | `6970b3e7d4131abf2614991e694f8713f5168b33` | Historical application baseline; not to be merged or reset during this task. |
| Feature divergence | `main...feature = 16 769` | The feature branch is the advanced application line; blind merging from main is unsafe. |
| Final validated SHA | Not established | A final SHA requires an intentional review of the current dirty changes followed by a separate commit/push decision. |
| Worktree | Dirty | Contains intentional reconciliation/code-cleanup edits plus protected `.claude/worktrees/**` and `newrelic_agent.log` residue. |
| Stale branch/worktree material | Old agent worktree refs and one older `feature/payload-v2` line remain | Inventory only; no deletion was performed. `feature/payload-v2` has 22 commits absent from the current feature and must not be cherry-picked without a separate review. |

No reset, rebase, force-push, branch rename, merge, deployment, migration, or
production operation was performed.

### A.2 Local validation

The current repository already has the following local evidence:

| Check | Result | Scope |
|---|---:|---|
| `pnpm test:release` | 164/164 passed | Local release suite. |
| Focused browser acceptance | 60/60 passed | Local browser run after the contrast-token correction. |
| `pnpm test:e2e` | 148 passed, 60 declared skipped | Local E2E; skips remain explicitly reported. |
| `git diff --check` | Passed | Current worktree whitespace check. |

These results prove repository behavior under the local test contract. They do
not prove the current feature tip is deployed, that staging has the same data
or schema, or that production is ready.

### A.3 Current source and implementation reconciliation

The current source registers 36 Payload migrations, including the later
forward-schema work through the LiveKit space migration. The implementation
review and conversation scan found the following disposition:

| Capability | Current disposition |
|---|---|
| Single paid membership with monthly/annual billing and non-paid access sources | Implemented in the current application model; old Free/Pro/VIP wording is historical or has been corrected in authoritative docs. |
| Portal, account settings, membership/account actions, and member directory/profile routes | Implemented locally; live/staging identity and data parity are not currently verified. |
| Member cover image | Implemented end-to-end locally: upload/replace/remove, MIME and 8 MB limit, blocked-member denial, audit events, retained old media, and account UI. |
| Rich text | Implemented locally with Lexical conversion, exact source HTML retention, conversion diagnostics, JSDOM support, and lesson/community/comment planning. |
| Bunny media/video | GUID-first target/runtime handling exists; binary acquisition/import and current remote media proof remain execution-time and unverified. |
| Courses, lessons, community posts, and lesson discussions | Payload collections/services/UI and local tests exist. Lesson comments include replies, moderation, entitlements, rate limiting, historical authorship/timestamps, source IDs, and raw-body evidence. |
| Community files/media | Canonical file route and local behavior exist; complete source-to-target binary import and live media access are not proven. |
| Space OG image, reactions, portal settings, LiveKit space schema | Forward schemas are present in source. |
| Community reactions | Collection/admin/read-side support exists, including bookmarks/leaderboard paths; a complete member-facing reaction toggle and survey-vote flow was not proven in the current runtime scan. Treat as partial until explicitly accepted. |
| Partner/referral workflow | Collections, service, and routes exist, but the portal describes durable processing as not active and the admin model remains preview/manual. Treat as deferred/partial unless the roadmap promotes it into launch scope. |
| Programme/community preview models | The static eight-week programme and community preview models remain explicitly placeholder/preview data. They must not be treated as approved operational content. |
| LiveKit group calls | Local/source implementation and historical token/browser evidence exist; current staging identity and human two-device audio/video evidence are absent. |
| Production cutover | Not started and not authorized. |

The conversation-derived work ledger therefore has no silently dropped major
feature family: the remaining uncertain or incomplete areas are called out as
media execution, reactions, partner processing, placeholder content, and live
environment proof.

### A.4 Staging and deployment evidence

The following values are retained as the canonical **allowed staging target** or
as historical evidence. They are not current-live claims:

| Evidence | Recorded value | Current status |
|---|---|---|
| Preview URL | `https://preview.jpvbootcamp.com` | Allowed staging target; not live-checked in this pass. |
| Dokploy application | `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU` | Historical/allowed target; deployment state not reverified. |
| Database boundary | `10.0.2.4:5433`, database `jpvbootcamp`, schema `jpvbootcamp_staging` | Allowed staging boundary; no database inspection or mutation performed. |
| Earlier running SHA | `9c0debe...`, run `32462177363` | Historical deployment record only; not the current feature SHA. |
| GHCR/Dokploy path | Earlier registry image-prefix/token-scope issue was recorded as repaired | Historical repair evidence only; current image identity and pull path not reverified. |
| Migration count | Current release-lead verified position: 36/36 applied; pending `[]`; last migration `20260820_000000_live_session_space` | Current migration truth for this reconciliation. A raw timestamped provider artifact, schema/run identity, and explicit Prisma-health field are not present locally and remain required for a later exact-SHA evidence packet. |
| LiveKit | Earlier API/token/browser checks were recorded; real-device AV was optional | Historical evidence only; current staging token behavior and human AV are not reverified. |
| Portal acceptance | Earlier package recorded portal and release acceptance, including 84/84 portal checks | Historical evidence only; current staging exact-SHA acceptance is not reverified. |

There is no current staging deployment, exact-SHA identity, repeated online
sample, provider audit, or raw timestamped database artifact in this pass. The
migration position is nevertheless reconciled from the current release-lead
verified snapshot described above. The old read-only migration-plan failure
(credential-scan failure, 0 applied, 28 malformed payload entries, and
unhealthy Prisma evidence) is historical diagnostic evidence, not a current
diagnosis and not permission to repair staging.

## B. Cutover readiness gap list

### B.1 Blocking release gates

1. **Freeze a final release SHA.** Review the current dirty changes, preserve
   unrelated/protected residue, and make an intentional commit/push decision.
   Until then, `ae8c886...` is only the committed review starting point.
2. **Verify staging against that exact SHA.** Confirm deployed image identity,
   Dokploy convergence, health, and repeated ONLINE samples. Historical
   `9c0debe...` evidence cannot substitute for this.
3. **Retain the reconciled migration contract.** The guarded workflow now has
   explicit read-only current-state mode and expects 36 applied with pending
   `[]`. The closed 35→36 apply/rollback path remains guarded safety history.
   Retain a fresh timestamped sanitized artifact, including schema/run identity
   and Prisma health, when the later exact-SHA staging packet is authorized.
   Do not execute a migration in this phase.
4. **Obtain a fresh staging evidence packet.** It must include exact SHA,
   installed image/receipt, deployment status, migration state, provider
   checks, portal acceptance, and rollback evidence.

### B.2 Required cutover checklist after production authorization

| Area | Required completion evidence |
|---|---|
| Infrastructure | Production app/image identity, immutable release reference, GHCR pull path, Dokploy convergence, health endpoint and repeated stable samples, and an explicit prohibition on manual topology drift. |
| Secrets/providers | Production-only secret inventory, ownership and rotation plan; verified Stripe, Resend, Bunny, LiveKit, and auth configuration; no secret values in documentation or logs. |
| DNS/TLS | Hostnames, certificates, redirects, TTL/propagation plan, maintenance window, and a tested reversal path. |
| Database | Verified production database/schema target, backup/snapshot ID and timestamp, restore test, migration order, owner, maintenance window, and abort criteria. |
| Rollback | Prior immutable image, archived legacy application reference, database rollback/restore procedure, rollback owner, and a tested decision point. |
| Monitoring | Application/error logs, health/latency, authentication failures, provider failures/queues, media access, LiveKit token/session failures, and alert ownership. |
| Backups | Pre-cutover snapshot, retention policy, integrity/checksum evidence where applicable, and a successful restore rehearsal. |
| Communications | Freeze notice, named release owner, stakeholder status channel, smoke-test sign-off, abort criteria, incident path, and completion notice. |

### B.3 Feature and product gaps to resolve or explicitly defer

- Complete and accept the member-facing community reaction and survey-vote
  behavior, or record it as a deliberate post-cutover scope exclusion.
- Decide whether partner/referral durable processing is launch scope. If not,
  keep it explicitly deferred and ensure the portal does not imply operational
  processing.
- Obtain approved course/programme/community content or keep the placeholder
  models visibly preview-only.
- Prove binary media acquisition, protected/private routing, and representative
  Bunny playback against the release candidate.
- Decide whether real-device LiveKit audio/video validation is required for the
  production go/no-go; the historical package treated it as optional, but it
  remains useful risk reduction.

## C. Documents that need updates

### C.1 Updated in this reconciliation

The current-state contradictions were reconciled in this baseline and the
following supporting documents:

- `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md` — promoted
  to the single frozen Phase 9.5 baseline with the branch/deployment/migration/
  acceptance authority table, historical work ledger, and deduplication map.

- `docs/client/JPV_STAGING_LAUNCH_READINESS_EVIDENCE_PACKAGE.md` — reclassified
  as a historical 2026-08-21 snapshot.
- `docs/client/ROADMAP_PROGRESS_STATUS.md` — separated source truth from old
  deployed/migration checkpoints.
- `docs/CURRENT_WORK_HANDOFF.md` — historical migration29 instructions are no
  longer presented as current execution instructions.
- `docs/PAYLOAD_INTEGRATION_PLAN.md` — current source terminology and evidence
  boundary were aligned.
- `docs/client/OPERATOR_HANDOFF_SUMMARY.md` — old migration29 handoff was
  reclassified as audit history.
- `docs/release/FUTURE_BRANCH_CUTOVER_PLAN.md` — linked the current dossier and
  recorded that live state is not verified.
- `docs/release/BRANCH_RECONCILIATION_2026-08-23.md` — added the complete
  main-only commit disposition matrix.
- `docs/migration/LEGACY_FEATURE_PARITY_MATRIX.md`,
  `docs/migration/JPV_FEATURE_PARITY_HANDOFF_2026-08-15.md`,
  `docs/migration/POST_MIGRATION29_FORWARD_SCHEMA_PREPARATION.md`, and
  `docs/migration/LEGACY_STAGING_DRY_RUN_PLAN.md` — marked old planning
  checkpoints as historical and linked current authority.
- `docs/client/LAUNCH_READINESS_EVIDENCE_PACKAGE_STAGING.md`,
  `docs/client/MIGRATION_29_AUTHORIZATION_PACKET.md`,
  `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`,
  `docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md`, and
  `docs/release/MAIN_STAGING_BUSINESS_RECONCILIATION.md` — labeled duplicate,
  obsolete, or historical packets so their old counts, SHAs, terminology, and
  commands cannot be mistaken for current state.
- `docs/ARCHITECTURE.md` — removed the stale public “Pro membership page”
  terminology.

### C.2 Follow-up documentation still required before cutover

- Preserve the current-state workflow contract (`36` applied, pending `[]`) and
  add the fresh sanitized timestamped staging artifact to the later exact-SHA
  evidence packet. The closed 35→36 apply/rollback path must remain clearly
  non-current and separately authorized.
- Refresh the parity matrix with explicit current dispositions for reactions,
  partner processing, placeholder content, and binary media execution.
- Keep the original client DOCX roadmap as an immutable historical source and
  publish any approved scope changes in the current Markdown roadmap rather
  than silently rewriting history.
- After the final SHA and fresh staging packet exist, update only the current
  status sections with exact evidence links and timestamps.

## D. Missing-work audit against the original roadmap

| Original roadmap area | Audit result | Required treatment |
|---|---|---|
| M0/M1 launch foundation and local release validation | Implemented locally and covered by current local suites | Still needs fresh staging/provider evidence. |
| Membership, identity, access, and account actions | Implemented in current source | Verify migrated identity/counts and billing/provider behavior in staging. |
| Course/lesson content and rich-text fidelity | Runtime and conversion work implemented locally | Resolve approved content, media acquisition, and current staging data proof. |
| Bunny video and legacy media | Target schema/runtime and GUID-first handling implemented | Binary import and representative playback remain unverified. |
| Member profile, cover image, and directory | Local implementation is present and tested | Verify source import, access controls, and current staging behavior. |
| Community posts/comments/files | Runtime and lesson discussions implemented locally | Reconcile binary media and reactions; prove staging parity. |
| Lesson discussions | Implemented with collection, service, UI, replies, moderation, and historical evidence | Verify exact deployed schema/data and acceptance on staging. |
| Phase 8 portal operationalization | Current source/local evidence supports completion | Historical 84/84 staging package must be refreshed against final SHA. |
| Phase 9 LiveKit group calls | Source and historical staging checks exist | Reverify current staging token/session paths; decide on real-device AV gate. |
| Branding/course preview | Local implementation and docs cleanup are present | Perform exact-SHA staging visual/route acceptance. |
| Partner/affiliate workflow | Partially implemented and intentionally preview/manual in places | Explicitly defer or complete durable processing; do not leave ambiguous. |
| Production cutover | Not implemented/executed by design | Requires a separately authorized, evidence-backed cutover packet. |

The main feature families discussed in the referenced conversations are thus
accounted for. The important half-baked areas are not hidden: reactions,
partner processing, placeholder content, binary media execution, and current
environment proof remain visible release decisions.

## Single recommended next action

**Freeze this reconciliation into one reviewable feature-branch release commit
(without deploying), then use that exact SHA for a fresh, read-only staging
identity and migration-status verification.** Do not authorize production
cutover until that evidence packet closes the exact-SHA, migration-contract,
provider, rollback, and acceptance gaps above.
