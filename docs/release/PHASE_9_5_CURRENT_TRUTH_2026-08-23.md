# JPV Bootcamp Phase 9.5 — Authoritative Current Truth

**Date:** 2026-08-23
**Status:** ACTIVE FEATURE-BRANCH RECONCILIATION — NOT PRODUCTION CUTOVER
**Branch:** `feature/course-branding-and-preview`

This is the authoritative current-truth document for Phase 9.5. It supersedes
current-state wording in older handoffs, staging packages, readiness matrices,
and migration planning records. Those documents remain useful as historical
evidence or design provenance, but they must not be used to infer the current
live environment.

Related documents:

- [Final pre-production reconciliation dossier](FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md)
- [Prioritized Phase 9.5 backlog](PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md)
- [Feature-branch reconciliation](BRANCH_RECONCILIATION_2026-08-23.md)

## 1. Executive truth

The feature branch contains the advanced JPV Bootcamp application and passes
the repository release gate locally. The release lead has supplied a sanitized
current staging migration position of 36/36 applied with no pending migration;
this is separate from exact-SHA deployment, provider, and acceptance evidence.
The branch is not yet release-frozen, and the remaining feature work is
concentrated in reactions, media execution, approved content,
partner-processing scope, and acceptance evidence.

Phase 9.5 is therefore **not “launch ready” and not “feature complete.”** It is
the controlled reconciliation phase needed to make the final implementation
work trustworthy.

## 2. State model and authority rules

| State | Meaning | Allowed use |
|---|---|---|
| Verified now | Observed in the current repository, branch metadata, or a validation command run against this worktree | May be used as current local/source truth. |
| Historical | Produced by an earlier staging, provider, migration, or acceptance run | Audit and comparison only; never current-live proof. |
| Requires fresh verification | A claim that must be rerun against the final exact SHA or target environment | Remains open until evidence is attached. |
| Incomplete | Source/runtime/schema/design work is missing, partial, placeholder, or not accepted | Must be completed or explicitly approved as deferred. |

The repository source is authoritative for what is registered and implemented;
it is not authoritative for what has been deployed or applied to staging.
Staging evidence is authoritative only when it identifies the exact SHA,
target, timestamp, artifact, and verification result.

## 3. Verified current baseline

### 3.1 Repository and branch

| Check | Current result |
|---|---|
| Active branch | `feature/course-branding-and-preview` |
| Local HEAD | `b771cfca4ab6d2bcaa76f6dc2d2420c114082dd8` |
| Remote feature tip | Matches local HEAD after the release-cleanup push |
| `main` | `6970b3e7d4131abf2614991e694f8713f5168b33` in the separate main worktree |
| Divergence | `main...feature = 16 769` |
| Final feature-branch SHA | `b771cfca4ab6d2bcaa76f6dc2d2420c114082dd8`; exact-SHA staging evidence is still not established |
| Protected residue | `.claude/worktrees/**`, `newrelic_agent.log`, and the tracked `.bak` remain untouched |
| Branch operations | No merge, reset, rebase, force-push, rename, or deletion performed |

The dirty worktree also contains intentional documentation and cleanup changes
from the reconciliation pass. No unrelated residue may be staged or removed
as part of the Phase 9.5 completion work.

### 3.2 Local/source evidence

- The source registry contains 36 canonical Payload migration registrations,
  ending with `20260820_000000_live_session_space`.
- The latest local `pnpm test:release` run passed `164/164`.
- Existing local browser evidence is `148 passed` with `60 declared skips`; a
  focused browser run passed `60/60` after the shared contrast-token correction.
- `git diff --check` passes for tracked changes, and the new reconciliation
  documents contain no trailing whitespace.
- The workflow is explicitly staging-only and rejects `main`; no deployment,
  migration, provider mutation, or production operation was performed in this
  Phase 9.5 review.

These are local/source claims except for the separately identified release-lead
staging migration snapshot below. None is a current production claim.

### 3.3 Reconstructed sanitized staging migration snapshot

This is the authoritative migration-state representation for this reconciliation.
It is a sanitized, read-only reconstruction from the current release-lead
verified position, corroborated by the historical 2026-08-21 36/36 package and
the 36-entry source registry. No database connection, migration command, or
staging write was performed by this pass.

| Field | Current value | Evidence boundary |
|---|---|---|
| Target | staging / `jpvbootcamp_staging` | Allowed target supplied by the release contract |
| Source registry | 36 Payload migrations | Current repository registry and inventory test |
| Applied Payload migrations | 36/36 | Current release-lead verified position |
| Pending Payload migrations | `[]` | Current release-lead verified position |
| Last registered/applied migration | `20260820_000000_live_session_space` (migration 36) | Registry order plus current position |
| Prisma health | Staging operational was supplied; a fresh raw Prisma-health field is not present in this local snapshot | Requires fresh sanitized artifact if needed for a later release packet |
| Exact running SHA/deployment receipt | Not established for the dirty worktree | Requires fresh exact-SHA deployment evidence |

The snapshot establishes migration truth for Phase 9.5 reconciliation. It does
not claim that the current dirty worktree is deployed, nor does it authorize a
migration or any other staging operation.

## 4. Reconciled conflict matrix

| Subject | Conflicting records | Authoritative interpretation |
|---|---|---|
| Migration count | Source has 36 registrations; the closed pre-apply runner path describes 35 applied plus migration 36 pending; older records also describe 29 or 35 total | Current release-lead snapshot is 36/36 applied with no pending migration. The workflow now has explicit current-state mode expecting 36/`[]`; the 35→36 path remains closed apply/rollback safety history. |
| Feature SHA | Current local/remote tip is `b771cfc...`; older evidence cites `ae8c886...`, `9c0debe...`, `abf438...`, and `9c045fa...` | `b771cfc...` is the final committed feature-branch baseline. All older SHAs are historical deployment/checkpoint evidence. |
| Staging readiness | Migration state is currently supplied as 36/36 with no pending migration; older packages also contain deployment and acceptance evidence | Migration truth is current for this reconciliation. Exact-SHA deployment, provider, and acceptance evidence remain historical or require fresh verification. |
| Acceptance evidence | Historical portal, LiveKit, admin, media, and browser counts are recorded; local release tests pass now | Local validation is current repository evidence. Staging acceptance must be rerun against the final exact SHA. |
| Roadmap phase | Phase 8 and Phase 9 are recorded complete in historical packages; Phase 10 is production cutover; Phase 11 partner affiliates is deferred | Current project phase is **9.5 Feature Branch Reconciliation & Completion**. Phase 8/9 implementation is locally advanced but not freshly environment-verified. Phase 10 has not started. |
| Deployment assumptions | Dokploy/GHCR repair and running-image claims appear in historical records | The allowed staging target remains the documented preview lane, but deployment identity, convergence, and image receipt require fresh proof. |
| Migration-plan failure | A historical run reported credential-scan failure, 0 applied, 28 malformed entries, and unhealthy Prisma | Historical diagnostic evidence only. It is not a current diagnosis and does not authorize remediation. |

## 5. Implementation truth by domain

| Domain | Current truth | Phase 9.5 disposition |
|---|---|---|
| Membership, identity, account actions, billing | Current source and local tests implement the one-membership model, monthly/annual billing, entitlement, and account-action protections | Locally implemented; staging identity, billing, and provider behavior require fresh verification. |
| Member profile, directory, and cover image | Directory/profile routes and cover-image upload/replace/remove controls exist with access checks, limits, audit events, and retained media | Locally implemented; source import and staging behavior require fresh verification. |
| Rich text | Lexical conversion, source HTML retention, diagnostics, and lesson/community/comment planning exist | Locally implemented; binary/image/embed execution still has open migration work. |
| Courses, lessons, community posts, comments, and lesson discussions | Collections, services, UI, moderation, replies, entitlements, rate limits, historical authorship, and local tests exist | Locally implemented; exact staging schema/data and acceptance require fresh verification. |
| Community reactions | `payload_space_reactions` schema, migration, read-side leaderboard/bookmarks, and migration planning exist | Member-facing like/bookmark mutation and survey-vote behavior are not proven; classify as incomplete until implemented and tested or explicitly deferred. |
| Bunny/media | GUID-first target/runtime handling and deterministic import planning exist | Binary acquisition, public/private import, linking, and representative playback remain incomplete/unverified. |
| Programme and community previews | Static preview models remain placeholder data and retain retired Free/Pro language | Not operational content. Requires approved content and one-membership terminology, or an explicit preview-only scope decision. |
| Partner/referral | Collections, services, routes, and admin surfaces exist; `/portal/partner-referral` explicitly disables submission and says durable processing is not active | Partial/preview. Complete durable processing only if promoted into Phase 9.5 scope; otherwise record as an approved deferral. |
| LiveKit | Source/runtime and historical API/browser evidence exist; current live identity and human AV evidence do not | Fresh staging token/session acceptance required; real-device AV is a product/release decision. |

## 6. What is historical and must not be reused as current proof

The following records remain valid audit artifacts but are not current state:

- 2026-08-21 staging package: recorded `36/36`, historical running SHA
  `9c0debe...`, deploy run `32462177363`, and historical portal/LiveKit
  acceptance.
- 2026-08-19 staging checkpoint: recorded `35/35`, SHA `abf438...`, deploy
  run `32352382852`, legacy import `935/935`, and historical portal/media
  evidence.
- 2026-08-08 pre-migration checkpoint: recorded migration 29 as the sole
  missing migration under run `31215369413` and cited SHA `9c045fa...`.
- Earlier 28/29 and 0-applied/malformed migration diagnostics.
- Older deployment guides, go/no-go identity rows, and readiness matrices with
  dates before 2026-08-23.

## 7. Fresh verification required

Before Phase 9.5 can close, obtain a new evidence packet tied to one final
committed SHA:

1. Final SHA, clean intentional worktree, and remote feature-tip match.
2. Staging deployed image/receipt, Dokploy convergence, health, and repeated
   stable ONLINE samples for that SHA.
3. Retain a fresh sanitized staging migration artifact with timestamp/run
   identity, schema identity, pending `[]`, and Prisma health when an exact-SHA
   release packet is assembled; no apply operation is implied by this requirement.
4. Current member/identity counts, entitlement behavior, billing/provider
   state, email, Bunny media, public/private file access, and source-import
   reconciliation.
5. Portal, course, community, account, billing, admin, partner-scope, and
   LiveKit acceptance against the exact deployed SHA.
6. Required rollback, backup, monitoring, owner, and evidence-artifact records.

## 8. Definition of 100% feature complete

“100% feature complete” means all in-scope product behavior from the approved
roadmap is implemented, tested, and unambiguous in the feature branch. It does
not mean production cutover has been authorized.

The branch reaches 100% feature completeness only when all of the following
are true:

- Every roadmap feature family is either operationally implemented or has a
  written, approved deferral with no misleading UI or documentation.
- No in-scope placeholder model remains presented as operational content.
- Community reaction types have a complete, access-controlled runtime path or
  an explicit approved exclusion; imported reaction rows have a lossless,
  auditable disposition.
- Media/import planning has a deterministic execution path for every in-scope
  public/private asset, including remote acquisition policy, target linking,
  idempotency, rollback evidence, and representative playback/access tests.
- Identity, course, lesson, community, discussion, profile, portal, billing,
  and LiveKit behaviors have passing unit/integration/browser coverage for
  happy paths, denial paths, empty states, and retry/error paths.
- The final committed SHA is known, the feature remote matches it, and all
  current documentation points to the same truth source.
- No unresolved source-to-target relationship, unexplained blocker, stale
  current-state claim, or unowned acceptance gate remains.

Feature completeness is a prerequisite for release readiness. Fresh staging
verification and production authorization remain separate gates.

## 9. Current Phase 9.5 position

The current working estimate is **approximately 10–15% of feature-completion
work remaining**. This is an implementation-risk estimate, not a weighted
acceptance metric: the exact percentage cannot be certified until the reaction,
media, preview-content/scope, source-disposition, migration-contract, and
final-SHA items are closed. Launch readiness is not expressed as a percentage
because current exact-SHA staging and provider evidence is absent.

The migration truth reconciliation and final feature-branch cleanup commit are
complete for this pass. The next highest-value task is to prepare the
separately authorized exact-SHA staging deployment and acceptance evidence
packet for `b771cfca4ab6d2bcaa76f6dc2d2420c114082dd8`. That work must preserve
the current 36/36, no-pending migration truth and must not be treated as
production authorization.

## 10. Phase 9.5 exit gate

Phase 9.5 is complete when:

- this document and the backlog are reviewed and linked from the current
  handoffs;
- the migration contract discrepancy is resolved without bypassing guards;
- incomplete feature decisions are closed as implementation or approved
  deferral;
- the final feature SHA and local validation evidence are frozen; and
- a fresh exact-SHA staging packet is ready for the separately authorized next
  staging operation.

The implementation backlog below is the only prioritized list for the remaining
Phase 9.5 work.
