# JPV Bootcamp Post-Launch Architecture Consolidation Plan

**Status:** A0 COMPLETE IN THIS DOCUMENTATION PACKET; A1–A6 NOT STARTED

**Date:** 2026-08-27

**Release authority:** `main` at `08605e52af4abb0b1bdcdfbe6890d010c545b636`

This plan governs the behavior-preserving consolidation of the live JPV
Bootcamp system. It is intentionally packetized. No packet may absorb another
packet’s scope, and no implementation begins merely because a related branch or
historical change exists.

## A0 production truth and repository evidence

### Production baseline

| Checkpoint | Evidence |
| --- | --- |
| Branch authority | `main`; local and `origin/main` matched after `git fetch origin --no-tags`. |
| Release SHA | `08605e52af4abb0b1bdcdfbe6890d010c545b636`. |
| Production workflow | GitHub Actions run `33093612107` passed. |
| Deployment | Dokploy production deployment converged and reported the exact SHA with `deploymentEnv=production`. |
| Data/schema | Required Payload relationship-table migration reported applied. No migration was executed by A0. |
| Health | Production health reported green. |
| A0 branch | `codex/production-architecture-consolidation`, created from the verified `main` tip. |
| Initial A0 worktree | Clean before documentation edits. |

The Git and branch claims above are repository evidence. The deployment,
health, and migration claims are the supplied production checkpoint used as the
current baseline; A0 does not repeat provider or database writes.

### Branch/worktree/PR inventory

No branch or worktree was deleted, reset, cleaned, merged, rebased, or force-
pushed. All inspected worktrees reported clean at inventory time. GitHub
reported no open PRs; the available PR history was closed/merged (#1–#10).

| Classification | Relevant references | A0 disposition |
| --- | --- | --- |
| Integrated into `main` | `codex/aug25-stripe-reconciliation`, `codex/engagement-live-content`, `codex/homepage-support-ux`, `codex/member-delete-transaction-fix`, `codex/merge-onboarding-livekit-into-main`, `codex/onboarding-livekit-fix`, `codex/portal-admin-flow-production`, `codex/portal-auth-theme-regression-fix`, `codex/portal-operations-polish`, `codex/portal-theme-admin-fix`, `codex/portal-theme-payload-ux`, `codex/stripe-auto-provisioning-fix`, `codex/ux-foundation-nonoverlap`, `feat/sponsored-seats`, `feature/course-branding-and-preview`, `feature/homepage-updates`, `feature/payload-integration`, `feature/prokit-docs-sync`, `legacy/production`, `release/production-schema-cutover`, `release/root-domain-cutover`, `stripe-portal-redirect-only`, and older agent refs whose tips are ancestors of `main` | Preserve as historical refs; do not replay. |
| Unique unintegrated work | `codex/feature-billing-integration` (1 commit), `codex/ux-architecture-consolidation` (1), `feature/payload-v2` (22), `jpvbootcamp-v1` (tagged snapshot plus 1 local divergence), `release/legacy-domain` (3), `worktree-agent-a636af634c6af183c` (1), and isolated workflow worktree refs | Keep intact. File-level review is required before any adoption; no cherry-pick in A0. |
| Partially integrated | None proven by the ancestry inventory alone | Do not infer partial integration; use file-level evidence in the packet that proposes adoption. |
| Unknown | Any residue whose commit meaning is not established by ancestry or the current source map | Preserve and stop rather than clean or merge. |
| Current authority | `main`, `origin/main`, and A0 branch at the production SHA before A0 edits | Only the dedicated A0 branch may receive this documentation packet. |

An ancestry match means only that a branch tip is behind `main`; it does not
prove that its intent, runtime configuration, or provider-side effects were
accepted. Conversely, a unique commit is not automatically valuable or safe.

### Documentation inventory

The following documents were reviewed against the production checkpoint:

- `docs/client/ROADMAP_PROGRESS_STATUS.md` — updated with a current production
  checkpoint; older staging/feature sections are retained as historical.
- `docs/CURRENT_WORK_HANDOFF.md` — updated so current truth is the first
  section; older handoffs are retained as historical.
- `DESIGN.md` — updated with the current production/architecture checkpoint;
  design-token authority remains unchanged.
- `docs/ARCHITECTURE.md` — updated with a current-production authority banner;
  its older feature-branch description remains historical context.
- `docs/release/PHASE_10_PRODUCTION_CUTOVER_PREPARATION_PACKAGE_2026-08-23.md`
  — absent from the verified `main` checkout. No historical document was
  fabricated. The adjacent
  `docs/release/PRODUCTION_READINESS_AND_CUTOVER_PREPARATION_PACKAGE_2026-08-23.md`
  remains provenance only.
- `docs/design/JPV_UX_ARCHITECTURE_CONSOLIDATION_PLAN.md` — absent from the
  verified `main` checkout. Its stale reference from
  `JPV_PRODUCT_UX_REFINEMENT_PHASE_2_PLAN.md` is redirected to this canonical
  architecture plan; no missing historical plan was fabricated.

## Packet order and gates

The order is production stability, A0 truth/authority, then A1–A6. A later
packet cannot start while its predecessor’s evidence and rollback boundary are
not accepted. A0 contains no application behavior change.

### A1 — Domain boundary and dependency consolidation

| Field | Contract |
| --- | --- |
| Objective | Turn the source-of-truth map into a reviewed dependency graph with one owner per business fact and explicit provider/projection boundaries. |
| Exact scope | Resolve the split/ambiguous rows in `JPV_DOMAIN_SOURCE_OF_TRUTH.md`; name domain services, read models, provider adapters, actor policies, and allowed cross-store transaction boundaries. Documentation and narrowly necessary ownership-preserving refactors only after review. |
| Likely files | `src/lib/payloadCourse/*`, `src/lib/billing/*`, `src/lib/membership-support/*`, `src/lib/sponsored-*`, `src/lib/partnerAffiliateReporting.ts`, `src/lib/email*`, `src/lib/liveSessions/*`, `src/lib/payload.config.ts`, Prisma schemas. |
| Forbidden scope | No new product capability, schema migration, provider mutation, identity backfill, deletion, redesign, route removal, or wholesale historical branch merge. |
| Validation | Source ownership assertions, focused domain tests, dependency/import checks, `git diff --check`, and an explicit datastore/provider review. |
| Stop | Any fact has two writable authorities, a provider write is required, identity matching is ambiguous, or behavior cannot be proven unchanged. |
| Rollback | Revert the packet commit(s) or restore the pre-packet branch; do not repair by deleting records or replaying historical branches. |

### A2 — Service, route, and Server Action consolidation

| Field | Contract |
| --- | --- |
| Objective | Make server entry points thin adapters over shared domain operations. |
| Exact scope | Inventory and, where accepted, consolidate duplicate parsing, serialization, validation, and action orchestration across portal routes, Server Actions, API routes, and Payload hooks. Preserve URLs, response contracts, actor context, idempotency, and failure semantics. |
| Likely files | `src/app/api/**`, portal page/action files, `src/lib/portalAdmin/*`, `src/lib/payloadCourse/*`, `src/lib/auth/*`, Payload hooks/access modules. |
| Forbidden scope | No business-rule invention, broad API redesign, permission weakening, page-local persistence, or giant shared action file. |
| Validation | Focused unit/integration tests per consolidated operation, auth/actor tests, response-contract tests, TypeScript, release contract tests, and `git diff --check`. |
| Stop | A call site needs different business semantics, a contract change is discovered, or the shared operation cannot preserve audit/idempotency behavior. |
| Rollback | Revert only the A2 commit(s); keep the prior service entry points intact until replacement validation passes. |

### A3 — Identity, authorization, and administrator-mode consolidation

| Field | Contract |
| --- | --- |
| Objective | Establish one explicit actor and identity-link model for members, Payload administrators, Creator Mode, sessions, and provider operations. |
| Exact scope | Reconcile `payload_users`, `payload_members`, profiles, `portalMember` links, `requirePortalAccess`, actor resolution, admin presentation state, and collection access. Define administrator linking without synthetic billing, and define preview without impersonation. |
| Likely files | `src/lib/auth/*`, `src/lib/portalAdmin/*`, `src/lib/payloadCourse/accessService.ts`, member collections/access policies, `src/lib/billing/stripeMemberIdentityReconciliation.ts`, `src/lib/billing/membershipReadModel.ts`, portal layout/header/admin controls. |
| Forbidden scope | No silent identity merges, email-only backfill without an unambiguous match, auth secret changes, permission bypass, or provider billing mutation. |
| Validation | Positive/negative actor matrix, member/admin/preview separation tests, session tests, collection access tests, no-secret logging check, and exact migration/backfill review if one is proposed. |
| Stop | Any identity is duplicated, a link would change billing truth, a visual gate is carrying security, or a review queue is bypassed. |
| Rollback | Disable/revert the link or policy change using the recorded audit entry; preserve original identities and provider records. |

### A4 — Data access, projections, and provider reconciliation

| Field | Contract |
| --- | --- |
| Objective | Make Stripe, LiveKit, Bunny, Resend, Prisma operational tables, Payload projections, and review queues truthful and non-duplicative. |
| Exact scope | Close the split/ambiguous source-of-truth rows; document projection refresh, retry, dedupe, review, and failure states. Reconcile read-model counts only through explicit, idempotent, environment-scoped operations. |
| Likely files | `src/lib/billing/*`, `src/lib/payloadCourse/stripeShadowSync.ts`, webhook routes, `src/lib/liveSessions/*`, `src/lib/livekit-*`, `src/lib/email.ts`, CRM collections, sponsored/support/affiliate modules, Prisma schemas and migration contracts. |
| Forbidden scope | No unguarded production data mutation, deletion, provider endpoint replacement, migration, or guessed identity assignment. |
| Validation | Dry-run reports, provider-vs-local count comparisons, idempotency/retry tests, signed webhook tests, projection freshness checks, and explicit live gates approved by the orchestrator. |
| Stop | Counts disagree without a row-level explanation, provider state is unavailable, a write target is ambiguous, or a destructive repair is proposed. |
| Rollback | Use provider-supported reversal or local projection replay from preserved events; never roll back by dropping schemas or deleting audit evidence. |

### A5 — Portal Creator Mode, Payload Admin, and UI architecture

| Field | Contract |
| --- | --- |
| Objective | Clarify day-to-day content administration in the member portal while simplifying Payload Admin into an advanced/recovery/system console. |
| Exact scope | Map course/community/update/live-session admin affordances, navigation hierarchy, AdminGate presentation, Payload admin groups/labels/descriptions, scroll ownership, empty states, and JPV design-token usage. Keep every capability reachable and server-authorized. |
| Likely files | `src/app/(frontend)/portal/**`, `src/components/portal/**`, `src/lib/portalAdmin/*`, `src/components/payload/*`, `src/payload.config.ts`, `src/lib/brand/jpvDesignSystem.ts`, `DESIGN.md`, portal navigation/settings modules. |
| Forbidden scope | No route deletion, feature removal, visual-only security, competing design system, broad redesign without acceptance evidence, or backend/data migration disguised as UX work. |
| Validation | Route/capability inventory, member/admin/preview acceptance matrix, responsive and keyboard checks, scroll-preservation checks, design-token checks, and focused browser tests. |
| Stop | A capability becomes unreachable, a page owns the wrong scroll container, a hidden control is treated as authorization, or a design change alters domain behavior. |
| Rollback | Revert the affected UI/admin composition while retaining domain services and records; restore the previous navigation only from the reviewed commit. |

### A6 — Validation, release, and operating contract

| Field | Contract |
| --- | --- |
| Objective | Establish one release checklist proving the consolidated system is safe to merge and deploy. |
| Exact scope | Define unit/integration/release/browser/provider evidence, exact SHA/image/deployment identity, database migration state, rollback owner, monitoring, and post-deploy smoke checks. Update only canonical docs and workflow assertions required by the reviewed contract. |
| Likely files | `docs/architecture/*`, `docs/release/*`, `.github/workflows/*`, release scripts and focused contract tests. |
| Forbidden scope | No feature development, undocumented production mutation, branch cleanup, force-push, or declaration of green based on local tests alone. |
| Validation | Full applicable release contract, `git diff --check`, exact immutable artifact identity, live health, migration state, critical route smoke tests, and separate provider checks. |
| Stop | Any required evidence is missing, stale, contradictory, or not tied to the exact candidate SHA. |
| Rollback | Application rollback to the previous immutable artifact; database/provider rollback only through the approved domain-specific procedure with an owner and evidence. |

## Workbench orchestration contract

Before any A1–A6 work starts, the orchestrator must reread:

1. `AGENTS.md` in the repository;
2. this plan;
3. `JPV_PRODUCTION_ARCHITECTURE_V1.md`;
4. `JPV_DOMAIN_SOURCE_OF_TRUTH.md`;
5. `JPV_ENGINEERING_PRINCIPLES.md`;
6. `docs/CURRENT_WORK_HANDOFF.md`;
7. `docs/client/ROADMAP_PROGRESS_STATUS.md`;
8. `docs/design/JPV_DESIGN_SYSTEM_AUTHORITY_V1.md` and `DESIGN.md`;
9. the packet-specific source files, tests, and release contract.

The orchestrator must record the packet objective, exact file scope, allowed
side effects, validation commands, stop criteria, and rollback before dispatch.
The working branch must descend from current `main`; the current `main` tip and
worktree state must be rechecked immediately before implementation. A packet
stops and returns evidence without guessing if it encounters dirty protected
residue, a changed release baseline, an ambiguous datastore/provider owner, a
secret or credential operation, a production data/provider write, a security
boundary change not in scope, an unexpected migration, an unreviewed historical
branch, or a validation failure whose cause is not clear.

## A0 completion gate

A0 is complete only when:

- the production checkpoint is at the top of current roadmap, handoff,
  architecture, and design authority documents;
- the current/ historical boundary is explicit and contradictory current
  staging-era claims are no longer presented as current;
- the source-of-truth map, engineering principles, and A1–A6 packet contracts
  exist and agree;
- no application behavior, database, provider, branch, or worktree was
  mutated; and
- documentation consistency, `git diff --check`, and applicable doc/architecture
  contract checks pass.

The A0 commit is documentation-only. It is not an A1 start signal and is not a
production deployment authorization.
