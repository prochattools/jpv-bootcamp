# JPV Bootcamp Phase 9.5 — Prioritized Final Implementation Backlog

**Status:** OPEN — feature branch reconciliation and completion
**Scope:** `feature/course-branding-and-preview` only
**Explicit exclusions:** production, `main`, cutover, unrelated improvements, and unapproved staging/provider mutations

This backlog is derived from the authoritative [Phase 9.5 current truth](PHASE_9_5_CURRENT_TRUTH_2026-08-23.md), the final pre-production dossier, the original client roadmap, and the referenced implementation conversations.

Priority meanings:

- **P0:** must close before the feature branch can be called trustworthy.
- **P1:** remaining implementation or acceptance work for 100% feature completeness.
- **P2:** documentation or hardening work that must be closed before a later release decision, but does not block local feature completion by itself.

## Ordered execution sequence

1. Resolve the migration-contract contradiction without running a migration.
2. Freeze and identify one final feature-branch SHA.
3. Decide scope for reactions, partner processing, and preview content.
4. Complete the approved missing implementation work and its tests.
5. Reconcile media/import evidence and current documentation.
6. Prepare a fresh exact-SHA staging verification packet. This is a later
   authorized operation, not part of this backlog execution pass.

## A. Bugs and correctness defects

| ID | Priority | Status | Finding | Exit criteria |
|---|---|---|---|---|
| BUG-01 | P0 | Closed in this pass | The guarded staging migration contract had been used as a 35-applied / migration-36-pending current assertion while the verified staging position is 36/36 with no pending migration. | The runner has explicit read-only current-state mode; workflow semantics expect 36 and `[]`; the closed 35→36 apply/rollback path remains guarded and historical; focused tests and docs agree. |
| BUG-02 | P1 | Open/conditional | Preview programme/community models retain retired Free/Pro access labels while the approved product contract is one JPV Bootcamp Membership. | Either normalize labels to the membership contract or mark the models unmistakably preview-only with an approved rationale and tests preventing operational use. |
| BUG-03 | P1 | Open/conditional | The reaction data model supports likes, bookmarks, and survey votes, but the current member runtime scan found no complete member mutation path. | A member can view, create, remove, and receive the correct state for every in-scope reaction type, with authorization, idempotency, rate/error handling, and tests; or the feature is explicitly excluded. |

## B. Missing features or incomplete implementation

| ID | Priority | Status | Finding | Exit criteria |
|---|---|---|---|---|
| FEAT-01 | P1 | Open | Complete community reaction behavior, including member-facing like/bookmark mutation and survey-option voting if those legacy behaviors remain in scope. | Runtime service/routes/UI exist, access rules are fail-closed, duplicate toggles are safe, imported historical rows remain auditable, and focused/browser tests pass. |
| FEAT-02 | P1 | Open | Complete deterministic binary-media import execution for resolved local and remote sources, including public/private routing, media linking, protected resources, and representative Bunny playback. | Every in-scope binary intent has an execution disposition, idempotent import/link behavior, checksum/rollback evidence, and public/private access tests. No network or write occurs without separate authorization. |
| FEAT-03 | P1 | Open | Replace or formally approve the placeholder eight-week programme and community preview content. | Approved client content is validated, accepted, and wired to the intended Payload/runtime path; placeholder content cannot be mistaken for production content. |
| FEAT-04 | P1 | Scope decision required | Partner/referral durable processing is not active; the current portal intentionally disables submission. | Either implement durable submission, notification, review, status, audit, and failure recovery, or record a signed Phase 11/post-cutover deferral and keep all UI/docs explicitly preview-only. |
| FEAT-05 | P1 | Scope decision required | LiveKit source/runtime is present, but current deployed behavior and real-device AV are not proven. | Exact-SHA staging token/session/browser acceptance passes; real-device two-participant AV is either accepted as a release requirement and passed or explicitly excluded. |

## C. Specification and product-decision gaps

| ID | Priority | Status | Finding | Exit criteria |
|---|---|---|---|---|
| SPEC-01 | P0 | Open | The roadmap does not unambiguously state whether reactions, partner processing, placeholder content, binary media import, and human LiveKit AV are in Phase 9.5 scope. | One approved scope table marks each item `in scope`, `deferred`, or `not applicable`, with owner and acceptance evidence. |
| SPEC-02 | P0 | Closed in this pass | Migration truth had multiple historical baselines: 29, 35, and 36. | The current contract names 36 registered, 36 applied, and no pending migration; 29 and 35/35 records remain labeled historical/audit-only. |
| SPEC-03 | P1 | Open | Source planner counts such as 935 operations, 179 blocked, 117 reactions, and 14 unresolved relationships appear in historical records without one current disposition ledger. | The parity ledger has one row per source family/operation class with target, disposition, blocker, owner, and evidence. No unexplained drop remains. |
| SPEC-04 | P1 | Open | “Feature complete,” “staging ready,” and “production authorized” are sometimes conflated by older roadmap language. | Current docs use separate gates: implementation complete, staging verified, and production authorized. |
| SPEC-05 | P2 | Open | Preview/static models and active Payload models coexist without a single documented ownership rule. | Each route points to either approved Payload data or explicitly preview-only data; no placeholder model is used as an operational fallback silently. |

## D. Operational and release gaps

| ID | Priority | Status | Finding | Exit criteria |
|---|---|---|---|---|
| OPS-01 | P0 | Open | The worktree is dirty, so there is no final release SHA. | Review intentional changes, preserve protected residue, produce one deliberate commit/push decision, and record the exact SHA. No commit or push is performed by this backlog document. |
| OPS-02 | P0 | Open | Current staging deployment identity, image receipt, convergence, health, and repeated ONLINE evidence are absent. | Fresh exact-SHA staging packet contains immutable image identity, Dokploy result, health samples, and timestamped evidence. |
| OPS-03 | P0 | Closed for migration truth; exact-SHA evidence remains | The migration position is now supplied as 36/36 applied with no pending migration, but the local workspace does not contain a raw timestamped provider artifact or exact-SHA deployment receipt. | Current-state workflow and docs use 36/`[]`; retain a fresh sanitized artifact with schema/run identity and Prisma health when the later exact-SHA staging packet is authorized. No apply is implied. |
| OPS-04 | P1 | Open | Stripe, Resend, Bunny, LiveKit, and auth provider state is not currently verified against the candidate. | Provider presence/behavior checks pass with sanitized evidence and no secret values exposed. |
| OPS-05 | P1 | Open | Current exact-SHA portal, account, course, community, media, billing, admin, and LiveKit acceptance is absent. | Required browser/admin smoke matrix passes against the exact deployed staging SHA, including denial/error paths and declared skip rationale. |
| OPS-06 | P1 | Open | Backup, restore, rollback, monitoring ownership, alerting, and communications evidence are incomplete or historical. | Named owners, current artifacts, restore/rollback rehearsal evidence, monitoring checks, abort criteria, and communication plan exist. |
| OPS-07 | P2 | Open | Stale worktree refs and old agent worktrees remain inventoried but not dispositioned. | Each is either protected, retained with owner, or safely deleted under a separate explicit cleanup decision. Do not clean them during feature work. |

## E. Documentation inconsistencies

| ID | Priority | Status | Finding | Exit criteria |
|---|---|---|---|---|
| DOC-01 | P0 | Done in this pass | No single Phase 9.5 current-truth authority existed above the historical dossier. | Current truth and backlog are created and linked from all current handoffs. |
| DOC-02 | P0 | Partially addressed | `docs/CURRENT_WORK_HANDOFF.md`, `docs/PAYLOAD_INTEGRATION_PLAN.md`, `docs/PREVIEW_RELEASE_READINESS.md`, and readiness matrices retain historical “complete/ready/current” language. | Prominent current-truth links and historical labels are now present; final closure requires a documentation review confirming no remaining current-section contradiction. |
| DOC-03 | P0 | Partially addressed | `docs/DOKPLOY_DEPLOYMENT_GUIDE.md` and older go/no-go/migration documents contain dated operational instructions and identity rows. | Historical/non-operative banners and identity labels now point to current truth; final closure requires a document-wide stale-current scan. |
| DOC-04 | P1 | Open | The parity matrix and dry-run plan retain older classifications for reactions, member directory/profile, media, lesson comments, and migration ordering. | Current dispositions are added or linked without erasing historical provenance. |
| DOC-05 | P1 | Open | The client DOCX roadmap remains the historical/client source while current Markdown docs carry newer implementation decisions. | Approved scope changes are reflected in the current Markdown truth and the DOCX remains immutable historical input. |
| DOC-06 | P2 | Open | Acceptance counts and skip counts vary across older records (for example 84/84, 148 plus skips, and earlier 58/58). | Every count is labeled with date, SHA, environment, suite, and historical/current status. |

## Required A-D classification

The source sections above describe the nature of each finding. The execution
classification below describes what must happen before the branch can be
called 100% feature complete. It is intentionally deduplicated: one workstream
may close several source findings.

| Category | Meaning in Phase 9.5 | Remaining IDs |
|---|---|---|
| **A — Must fix before 100% feature complete** | The item affects the completeness definition, leaves a required behavior unresolved, or leaves the branch/current truth untrustworthy. It must be implemented or closed by an explicit approved deferral. | BUG-02, BUG-03, FEAT-01, FEAT-02, FEAT-03, SPEC-01, SPEC-03, SPEC-04, OPS-01, DOC-02, DOC-03 |
| **B — Should fix for launch quality** | The feature branch can be locally complete without this live-environment or hardening evidence, but a later launch decision should not rely on historical or incomplete proof. | FEAT-05, SPEC-05, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06 |
| **C — Documentation/evidence cleanup only** | No product behavior is added. The work preserves provenance, labels evidence correctly, or safely inventories residue. | OPS-07, DOC-04, DOC-05, DOC-06 |
| **D — Future roadmap item** | The item is outside the current completion scope and remains deferred rather than being silently treated as complete. | FEAT-04 durable partner/referral processing; the real-device AV portion of FEAT-05 if the product decision excludes it |

`DOC-01` is complete and is not a remaining item. A conditional A item is
closed by either completing the behavior or recording an approved exclusion;
it may not remain ambiguous.

## Deduplicated A workstreams and ordered execution plan

The following is the only ordered plan for Category A. The order follows the
required priority of user-facing correctness, required functionality,
data/migration contracts, operational reliability, and documentation. Scope
decisions are gating decisions inside the affected workstream, not new scope.

| Order | Workstream / IDs | Exact problem and evidence | Affected files/components | Expected outcome | Acceptance criteria | Risk |
|---:|---|---|---|---|---|---|
| 1 | Community reactions — BUG-03 + FEAT-01 | `payload_space_reactions` has `like`, `bookmark`, and `survey_vote` schema/read-side support, while `src/app/(frontend)/portal/community/actions.ts` and the member community routes contain no proven member create/remove/toggle path. The migration planner preserves 117 historical reaction operations, so silently leaving the runtime absent would create a feature/parity gap. | `src/collections/community/Community.ts`; `src/lib/payloadCourse/leaderboard.ts`; `src/app/(frontend)/portal/community/actions.ts`; member community list/detail routes; focused reaction tests. | After scope is confirmed, members can use every in-scope reaction type through one access-controlled service path, and historical rows remain auditable. If a reaction type is excluded, the exclusion is explicit and its UI/planner disposition is consistent. | Active/enrolled members only; blocked/unauthorized members denied; create/remove is idempotent; duplicate rows are prevented; counts and current-member state are correct; survey voting follows an explicit one-vote rule; rate/error paths and focused/browser tests pass. | High — incorrect access or uniqueness behavior can create unauthorized or duplicated community data. |
| 2 | Preview contract — BUG-02 + FEAT-03 + SPEC-01 | `src/lib/course/programmeCatalog.ts` still exposes `free`/`pro` access labels and all eight weeks are placeholders; `src/lib/community/communityPreviewModel.ts` exposes `pro`/`free_and_pro` preview labels. The current product contract is one JPV Bootcamp Membership, and no approved content/scope decision is recorded. | `src/lib/course/programmeCatalog.ts`; `src/lib/community/communityPreviewModel.ts`; the routes consuming these models; related tests and current truth docs. | Approved content is wired to its intended ownership path, or the preview is unmistakably preview-only with one-membership terminology and no operational fallback. | Scope owner records `in scope`, `preview-only`, or `deferred`; no retired Free/Pro label appears in an operational member path; placeholder tests prevent accidental production presentation; route acceptance matches the decision. | High — misleading access language or placeholder content can cause entitlement and product misunderstandings. |
| 3 | Binary media execution — FEAT-02 | Rich-text/planner work preserves source and conversion diagnostics, but resolved binary assets still lack a proven deterministic execution path for local/remote acquisition, public/private target linking, protected delivery, and representative Bunny playback. | `src/lib/payloadCourse/*media*`; `src/lib/payloadCourse/bunnyProtectedMedia.ts`; media collections/routes; migration planner and media validation tests. | Each in-scope binary intent has an explicit execution disposition and a safe, idempotent link/import path with protected-access behavior. | Every in-scope asset is classified; no unauthorized network/write is performed; public/private access tests pass; link/import is idempotent; checksum/rollback evidence and representative playback/access tests are recorded. | High — media loss, exposure of private assets, or non-repeatable imports. |
| 4 | Migration contract — BUG-01 + SPEC-02 | `src/lib/payloadMigrationRegistry.ts` registers 36 migrations and the supplied current staging position is 36/36 with no pending migration; the workflow previously encoded the closed 35-applied / migration-36-pending pre-apply state. | `src/lib/payloadMigrationRegistry.ts`; `scripts/release/runStagingPayloadMigration.ts`; `.github/workflows/deploy-preview.yml`; migration runner/semantic-contract tests; migration docs. | One current-state representation is shared by source, runner, workflow checks, tests, and docs, while the closed 35→36 apply/rollback contract remains guarded and non-current. | Current-state mode expects 36 applied and `[]`; focused tests pass; workflow semantic checks validate 36/`[]`; docs label 29 and 35 baselines historical; no apply/down migration, provider write, or guard bypass occurs. | Critical — a wrong contract can halt a safe plan or misidentify the target database state. |
| 5 | Source disposition ledger — SPEC-03 | Historical planner records cite 935 operations, 179 blocked, 117 reactions, and 14 unresolved relationships, but no single current ledger maps each source family to target, disposition, blocker, owner, and evidence. | `scripts/migration/legacyPayloadOperationPlan.ts`; `scripts/migration/runLegacySourceDryRun.ts`; `docs/migration/LEGACY_FEATURE_PARITY_MATRIX.md`; `docs/migration/LEGACY_STAGING_DRY_RUN_PLAN.md`. | Every source family has one current, auditable disposition with no unexplained drop or duplicate count. | Ledger totals reconcile to the source audit; every blocked/unresolved item has an owner and next decision; historical counts retain date/SHA/environment labels. | High — silent data loss or false parity claims. |
| 6 | Gate separation — SPEC-04 | Older documents conflate feature completeness, staging readiness, and production authorization even though Phase 9.5 explicitly separates them. | Phase 9.5 truth/backlog; current handoffs; readiness/go-no-go/cutover documents. | The repository uses three unambiguous gates: implementation complete, staging verified, and production authorized. | A document scan finds no unlabeled current claim that equates those gates; every historical claim is dated and labeled. | Medium — operational decisions can be made from the wrong evidence layer. |
| 7 | Final branch identity — OPS-01 | The feature worktree is dirty and protected residue remains, so `ae8c886...` is only the current committed review starting point and no final release SHA exists. | Git worktree; intentional docs/code changes; `.claude/worktrees/**`; `newrelic_agent.log`; branch reconciliation record. | One deliberate final feature-branch state is identified without deleting or staging protected residue. | Intentional changes are reviewed; protected residue is preserved; a later authorized commit/push decision records one SHA and matching remote tip; no main/branch rewrite occurs. | High — an unidentifiable candidate cannot support reproducible verification. |
| 8 | Current-doc closure — DOC-02 + DOC-03 | Historical handoffs, deployment instructions, go/no-go identity rows, and readiness records still contain dated “ready/complete/current” language. Pointers and banners are present, but the final stale-current scan is not closed. | `docs/CURRENT_WORK_HANDOFF.md`; `docs/PAYLOAD_INTEGRATION_PLAN.md`; `docs/PREVIEW_RELEASE_READINESS.md`; `docs/DOKPLOY_DEPLOYMENT_GUIDE.md`; `docs/release/GO_NO_GO_CHECKLIST.md`; readiness matrices and migration handoffs. | Every current section points to the Phase 9.5 authority; historical instructions remain as labeled provenance and cannot be mistaken for an active operation. | Status-doc consistency tests pass; a line-by-line stale-current scan records no unowned contradiction; no production/deploy/migration instruction is presented as current in Phase 9.5. | Medium — documentation can cause an unsafe or misdirected release action. |

### Single highest-value next implementation task

The migration contract task is complete for this pass. The next implementation
task is **freeze one intentional final feature-branch SHA and prepare the
separately authorized exact-SHA staging deployment and acceptance evidence
packet**. It must preserve the current 36/36, no-pending migration truth and
must not deploy, migrate, or touch production as part of this reconciliation.

## Phase 9.5 completion contract

This backlog is complete when:

- all P0 items are closed;
- every P1 item is implemented or explicitly approved as deferred;
- the 100% feature-complete definition in the current-truth document is met;
- local tests and documentation checks pass at the final committed SHA; and
- the branch has a reviewable, unambiguous state ready for a later authorized
  staging verification.

This completion contract does not authorize deployment, migration, or
production cutover.
