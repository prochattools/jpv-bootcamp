# JPV Bootcamp Post-Launch Architecture Consolidation Plan

**Status:** A4 COMPLETE LOCALLY IN THIS IMPLEMENTATION PACKET; A5–A6 NOT STARTED

**Date:** 2026-08-28

**Release authority:** `main` at `08605e52af4abb0b1bdcdfbe6890d010c545b636`

This plan governs the behavior-preserving consolidation of the live JPV
Bootcamp system. It is intentionally packetized. No packet may absorb another
packet’s scope, and no implementation begins merely because a related branch or
historical change exists.

## A2 completion record

A2 is complete locally on `codex/production-architecture-consolidation` at the
A1 baseline plus the local A2 commit. The packet consolidated shared
server-safe validation, relationship-ID normalization, and plain-text Payload
Lexical serialization; replaced equivalent duplicate helpers across the
reviewed services; added the Portal Admin service map; and added focused
primitive tests. It did not change behavior, stored data, schemas, providers,
routes, production refs, or release state.

The active service boundaries and the read-only historical branch findings are
recorded in `JPV_PORTAL_ADMIN_SERVICE_MAP.md`. The unique no-write billing
branch delta is intentionally preserved for A5 review. A3 and A4 are complete
locally in the implementation packet below; A5 is the next packet. A5–A6
remain unstarted by this record.

### A2 branch comparison addendum

The required read-only comparison found the following disposition on the A2
branch: `codex/portal-admin-flow-production`, `codex/portal-theme-payload-ux`,
`codex/portal-operations-polish`, `codex/ux-foundation-nonoverlap`, and
`feature/course-branding-and-preview` are already represented by ancestor
history and were not replayed. `codex/feature-billing-integration` retains a
unique no-write Stripe reconciliation route/test delta; it remains intact and
is deferred to A5 source-of-truth and provider review. No historical branch was
merged, cherry-picked, deleted, rebased, or force-pushed.

## A0 — Production truth and architecture authority

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
not accepted. A0 contained no application behavior change. A1 is now complete
as a behavior-preserving authorization/service-foundation packet; it did not
change production `main`, data, schemas, providers, or deployment state.

The approved packet sequence is fixed:

1. A0 — Production truth and architecture authority
2. A1 — Authorization/service foundation
3. A2 — Shared domain primitives
4. A3 — Community domain convergence
5. A4 — Course/Creator domain convergence
6. A5 — Source-of-truth and architecture enforcement
7. A6 — Full regression and controlled production integration

### A1 — Authorization/service foundation

| Field | Contract |
| --- | --- |
| Objective | Establish one server-side administrator authorization boundary, one bounded Server Action result/error contract, and one explicit privileged Payload access boundary for portal Creator/Admin mutations. |
| Exact scope | On `codex/production-architecture-consolidation` from A0 `c43e899824b993200b05f1b337993eb55fae0905`, add `requirePortalAdmin()`, `PortalAdminActionResult<T>`, normalized error translation, and `privilegedPayloadAccess()`; migrate the course/community administrator action adapters and their direct clients; preserve `requirePortalMember()`, `requirePortalAccess()`, route/login behavior, domain operations, schemas, and provider state. |
| Likely files | `src/lib/auth/requirePortalAdmin.ts`, `src/lib/portalAdmin/actionResult.ts`, `src/lib/payload/privilegedAccess.ts`, `src/lib/portalAdmin/courseAdminActions.ts`, `src/lib/portalAdmin/communityAdminActions.ts`, five scoped portal admin clients, and focused tests. |
| Forbidden scope | No product feature, schema migration, provider mutation, identity backfill, deletion, UI redesign, route removal, historical branch merge, production `main` change, push, build, or deployment. |
| Validation | Focused authorization/result tests, existing portal auth contracts, scoped action/behavior tests, TypeScript, `git diff --check`, and a repository scan for equivalent local administrator gates. |
| Stop | A member can reach an administrator mutation, client UI state carries authorization, internal error text is serialized, a new broad Payload bypass is introduced, or an unrelated route/domain contract changes. |
| Rollback | Revert the single A1 commit or restore the A1 branch to the A0 parent; do not repair by deleting records, replaying branches, or changing providers. |

#### A1 completion record

- Start parent: `c43e899824b993200b05f1b337993eb55fae0905`.
- Canonical authorization: `src/lib/auth/requirePortalAdmin.ts`, built on
  `requirePortalAccess()` and narrowed to `AdminActor`.
- Canonical result/error boundary: `src/lib/portalAdmin/actionResult.ts`, with
  bounded error codes and generic unexpected-error serialization.
- Privileged Payload boundary: `src/lib/payload/privilegedAccess.ts`, requiring
  an authorized admin actor and an explicit reason for `overrideAccess: true`.
- Duplicated local administrator gates removed from the scoped course and
  community action adapters; their direct UI clients now consume the shared
  result shape.
- Security and behavior checks passed locally: the A1 foundation test, portal
  access and actor tests, portal admin behavior and inline contract tests,
  Vitest administrator-foundation tests, TypeScript, and `git diff --check`.
- No database, provider, production `main`, push, build, or deployment action
  was performed by A1.

### A2 — Shared domain primitives

| Field | Contract |
| --- | --- |
| Objective | Establish shared, server-safe domain primitives without changing product behavior. |
| Exact scope | Consolidate equivalent validation, relationship-ID normalization, and plain-text Payload Lexical serialization across the reviewed portal/course/community/member services. Preserve caller-specific paragraph caps, URLs, response contracts, actor context, idempotency, failure semantics, compatibility facades, schemas, providers, stored data, and release state. Explicit character limits reject oversized input rather than silently truncating it. |
| Likely files | `src/lib/domain/validation.ts`, `src/lib/domain/relationships.ts`, `src/lib/content/plainTextToLexical.ts`, compatibility facades, scoped portal/course/community/member adapters, the Portal Admin service map, and focused tests. |
| Forbidden scope | No business-rule invention, broad API redesign, permission weakening, page-local persistence, UI redesign, schema/data migration, provider mutation, production action, or giant shared action file. |
| Validation | Canonical primitive tests, affected course/community/member serializer tests, A1 authorization tests, compatibility checks, TypeScript, architecture/documentation consistency, and `git diff --check`. |
| Stop | A caller needs different business semantics, a serializer would discard content, a contract change is discovered, or the shared primitive cannot preserve existing behavior. |
| Rollback | Revert only the A2 correction/implementation commit(s); keep prior facades and service entry points available until replacement validation passes. |

### A3 — Community domain convergence

| Field | Contract |
| --- | --- |
| Objective | Consolidate duplicated member/admin community mutation logic. |
| Exact scope | Reconcile the overlapping transports in `src/app/(frontend)/portal/community/actions.ts` and `src/lib/portalAdmin/communityAdminActions.ts` into thin member/admin transports over shared community domain operations, actor-aware policy, Payload persistence, audit/notifications, and revalidation. Shared semantics must cover edit post, delete post, edit comment, delete comment, and moderation actions where behavior overlaps. |
| Likely files | `src/app/(frontend)/portal/community/actions.ts`, `src/lib/portalAdmin/communityAdminActions.ts`, shared community domain operations, actor policy, Payload discussion persistence, and focused tests. |
| Forbidden scope | No identity/provider reconciliation, course/creator service split, UI redesign, schema migration, production mutation, or unrelated feature work. |
| Validation | Member/admin actor matrix, edit/delete post/comment behavior, overlapping moderation behavior, audit/notification/revalidation checks, TypeScript, and `git diff --check`. |
| Stop | Member/admin semantics diverge, actor policy is bypassed, audit or notification behavior changes without evidence, or the operation cannot remain a thin transport over shared logic. |
| Rollback | Revert only the A3 commit(s), retaining the existing member/admin entry points and persisted records. |

#### A3 completion record

A3 is complete locally on `codex/production-architecture-consolidation` from
A2 HEAD `45625bd6ea96ce8281021910bad46cc1e6bcd135`. The implementation adds
`src/lib/community/policy.ts`, `src/lib/community/persistence.ts`, and
`src/lib/community/commands.ts`, and routes the member/admin edit, delete, and
moderation transports through those shared boundaries. The behavior matrix is
recorded in `docs/architecture/JPV_COMMUNITY_DOMAIN_CONTRACT.md`.

- `PortalActor`, `AdminActor`, and `MemberActor` remain distinct. A linked
  administrator member profile does not turn an admin actor into a member
  actor; members can edit/delete their own content only, while moderation is
  administrator-only.
- Member post creation remains in `src/lib/payloadCourse/communityPosting.ts` so its existing
  `communityPosting` rate limit, moderation, mention notifications, post
  notifications, and duplicate-prevention behavior are preserved. Admin
  moderation emits no member notification.
- Existing admin audit action names, confirmation/dependency checks, member
  `{ok,error}` contracts and redirects, admin `PortalAdminActionResult`, and
  targeted revalidation remain in their transports or shared commands.
- The read-only branch comparison found no available
  `codex/community-route-integrity` or `codex/production-app-flow-fix` refs;
  available older branches were not replayed. No migration, provider write,
  production mutation, merge, push, build, deployment, or branch cleanup was
  performed.
- Focused community domain, posting, moderation, portal, discussion, admin
  behavior/inline, TypeScript, documentation, and whitespace checks passed
  locally. A3 rollback is the single local implementation commit; persisted
  records and existing entry points remain intact.

### A4 — Course / Creator domain convergence

| Field | Contract |
| --- | --- |
| Objective | Break the large course Creator action layer into bounded domain services. |
| Exact scope | Review `src/lib/portalAdmin/courseAdminActions.ts`, whose responsibilities include auth, validation, relationship checks, business policy, persistence, audit, reorder logic, dependency-safe deletion, and cache revalidation. Separate course, module, and lesson domain operations from transport actions while preserving behavior and the A1 authorization boundary. |
| Likely files | `src/lib/portalAdmin/courseAdminActions.ts`, course/module/lesson domain services, Payload course persistence, audit/revalidation adapters, and focused tests. |
| Forbidden scope | No community convergence, identity/provider reconciliation, schema migration, permission weakening, UI redesign, or unrelated feature work. |
| Validation | Course/module/lesson behavior and dependency tests, actor authorization, relationship checks, audit/reorder/delete semantics, TypeScript, and `git diff --check`. |
| Stop | A domain operation needs different business semantics, deletion safety changes, an authorization boundary moves, or transport and domain responsibilities cannot be separated without behavior change. |
| Rollback | Revert only the A4 commit(s), keeping the existing course action boundary available until replacement validation passes. |

### A4 completion record — 2026-08-28

A4 is complete locally on `codex/production-architecture-consolidation` from
A3 HEAD `876b127145f0c190fb4dfc253cd6eedb2a724d8d`. Course, module, and lesson
operations now use bounded command, policy, and Payload persistence modules
behind the existing thin administrator Server Actions. The behavior contract
is recorded in `JPV_COURSE_CREATOR_DOMAIN_CONTRACT.md`; focused behavior,
security, side-effect, relationship, dependency, reorder, audit, and
documentation checks are part of the packet.

This completion record does not authorize or claim a merge, push, deployment,
database/provider mutation, migration, or historical branch cleanup. A5 is the
exact next packet; A6 remains separately gated.

### A5 — Source-of-truth + architecture enforcement

| Field | Contract |
| --- | --- |
| Objective | Resolve remaining identity/provider/data ambiguities and enforce the architecture. |
| Exact scope | Review member/admin identity linkage; Payload, Prisma, and Stripe ownership; provider projections; the unique no-write `codex/feature-billing-integration` delta; architecture guards; privileged access enforcement; and source-of-truth closure. The billing branch delta remains preserved and unmerged until this packet reviews it. |
| Likely files | `src/lib/auth/*`, `src/lib/billing/*`, `src/lib/payloadCourse/*`, provider projection/reconciliation services, architecture guards, privileged access helpers, and source-of-truth documentation. |
| Forbidden scope | No silent identity merge, guessed provider assignment, unguarded privileged access, schema/provider mutation, destructive backfill, or feature work disguised as reconciliation. |
| Validation | Environment-scoped read-only reports, ownership and projection tests, identity/admin separation tests, architecture/privileged-access guards, no-secret logging checks, and explicit review of any proposed migration or provider operation. |
| Stop | A source-of-truth row remains ambiguous, a provider projection is treated as commercial truth, a privileged path lacks a narrow guard, or a write target cannot be proven safe and reversible. |
| Rollback | Revert the reviewed A5 change or use the recorded domain-specific reversal; preserve source identities, provider records, audit evidence, and review queues. |

### A6 — Full regression / controlled production integration

| Field | Contract |
| --- | --- |
| Objective | Complete full regression and make the controlled production integration decision. |
| Exact scope | Run TypeScript, production build, release gate, browser suites, member/admin matrices, Payload Admin checks, billing regression, migration-state evidence, exact-SHA deployment verification, and production integration review. No feature development is included. |
| Likely files | `docs/architecture/*`, `docs/release/*`, `.github/workflows/*`, release scripts, and focused contract tests required by the reviewed evidence. |
| Forbidden scope | No new feature development, undocumented production mutation, branch cleanup, force-push, or declaration of green based on local tests alone. |
| Validation | Full applicable release contract, exact immutable artifact identity, live health, migration state, critical route smoke tests, provider checks, and explicit production integration approval. |
| Stop | Any required evidence is missing, stale, contradictory, or not tied to the exact candidate SHA and target environment. |
| Rollback | Application rollback to the previous immutable artifact; database/provider rollback only through an approved domain-specific procedure with an owner and evidence. |

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
