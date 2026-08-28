# JPV Bootcamp Production Architecture v1

**Status:** CURRENT ARCHITECTURE AUTHORITY — A5.1 COMPLETE LOCALLY; E1 GATE A BLOCKED

**Date:** 2026-08-28

This document is the architectural authority for the live JPV Bootcamp system
and for the post-launch consolidation packets A1–A6. It describes the target
relationship of existing surfaces. It does not authorize a rewrite, schema
change, provider mutation, migration, or feature batch. Those actions require
the packet-specific authorization and validation described in
`JPV_ARCHITECTURE_CONSOLIDATION_PLAN.md`.

## E1 environment authority — read-only reconciliation

The canonical production application is `JPV Bootcamp` /
`clients-jpv-bootcamp-app-tp9xrk` at `https://jpvbootcamp.com`. The canonical
staging target is the existing Dokploy staging application
`clients-jpv-bootcamp-preview-wjfqfd` / `bZllV93NqsPZAFCsqDskb`, but its public
origin must be `https://staging.jpvbootcamp.com` and its source boundary is
`feature/*`, `fix/*`, or `release/*`. At this gate, that application is still
serving `https://preview.jpvbootcamp.com` with `DEPLOYMENT_ENV=preview` against
the transitional `jpvbootcamp_preview` database and
`jpvbootcamp_staging` schema. The intended staging hostname returns 404.

Production is observed on database `jpvbootcamp`, schema `jpvbootcamp`; legacy
is observed on separate database `jpvbootcamp_legacy`, schema `jpvbootcamp`.
The production role is currently labelled `jpvbootcamp_staging_user`, which is
recorded drift and is not repaired here. Transitional staging migration
evidence does not match the repository registry. E1 is therefore `BLOCKED` and
does not authorize Gate B database/schema/role repair, migration execution,
Dokploy changes, routing, push, merge, or deployment. See the complete
topology and preview-to-staging inventory in
`JPV_ENVIRONMENT_TOPOLOGY_V1.md` and `JPV_PREVIEW_TO_STAGING_INVENTORY.md`.

## Current production authority

| Authority | Current value | Evidence boundary |
| --- | --- | --- |
| Release branch | `main` | Verified locally after fetch; `origin/main` matches. |
| Production commit | `08605e52af4abb0b1bdcdfbe6890d010c545b636` | Supplied production evidence and local `main`/`origin/main` verification. |
| GitHub Actions | Run `33093612107` passed | Supplied production evidence. |
| Deployment | Dokploy production deployment converged | Supplied production evidence. |
| Live identity | Exact production SHA; `deploymentEnv=production` | Supplied production evidence. |
| Database change | Required Payload relationship-table migration applied | Supplied production evidence; not re-run by A0. |
| Health | Production health green | Supplied production evidence. |
| Working tree | Reported clean at the production checkpoint | Current architecture worktree is clean before A0 edits. |

`main` is the production release authority. Historical feature, UX, staging,
and release branches are evidence or future-review inputs only until a packet
explicitly classifies and adopts a specific change.

## A1 authorization and Server Action foundation

A1 is complete on `codex/production-architecture-consolidation`, descended
from A0 commit `c43e899824b993200b05f1b337993eb55fae0905`. The implementation is
behavior-preserving and does not change `main`, production data, schemas,
providers, routes, or login routing.

- `requirePortalAdmin()` is the canonical server-only administrator gate. It
  first uses `requirePortalAccess()`, then narrows the actor to `AdminActor`;
  `requirePortalMember()` and `requirePortalAccess()` remain separate existing
  boundaries.
- Portal administrator Server Actions expose
  `PortalAdminActionResult<T>`: successful operations return `{ ok: true,
  data }`; failures return a bounded error code, safe message, and optional
  field errors. Unexpected failures are logged server-side and become a
  generic `internal_error` result.
- `privilegedPayloadAccess()` is the named, server-only boundary for the
  exceptional `overrideAccess: true` used by these administrator actions. It
  requires an already-authorized admin actor and an explicit reason; it is not
  a general Payload bypass.
- The course and community administrator action adapters now use the canonical
  gate, typed privileged access, normalized results, targeted revalidation, and
  their existing domain operations. Client admin UI remains presentation-only.
- Focused tests cover member/admin/unauthenticated separation, UI-state
  independence, member access preservation, safe error translation, and the
  scoped action adapters.

The A2 packet is complete locally on the consolidation branch. It adds the
canonical shared validation, relationship-ID, and plain-text Lexical
primitives, replaces equivalent duplicate helpers, and records the active
portal administrator service boundaries in
`JPV_PORTAL_ADMIN_SERVICE_MAP.md`.

The A3 Community Domain Convergence packet is complete locally from A2 HEAD
`45625bd6ea96ce8281021910bad46cc1e6bcd135`. It adds the shared community
actor policy, Payload persistence boundary, edit/delete/moderation commands,
and thin member/admin transports. The behavior matrix is recorded in
`JPV_COMMUNITY_DOMAIN_CONTRACT.md`; member post creation, rate limits, mention
and post notifications, and admin audit/revalidation semantics remain
preserved. No production merge, push, build, deployment, migration, provider
mutation, or historical branch cleanup was performed.

The A4 Course / Creator Domain Convergence packet is complete locally from
`876b127145f0c190fb4dfc253cd6eedb2a724d8d`. It moves course, module, and lesson
validation, relationship/dependency policy, Payload persistence, reorder
rollback, rich-text/media preservation, and audit orchestration into bounded
`src/lib/courseAdmin/*` modules while keeping
`src/lib/portalAdmin/courseAdminActions.ts` as the thin authenticated
transport. The contract is recorded in `JPV_COURSE_CREATOR_DOMAIN_CONTRACT.md`.
No member learning, Creator UI, provider, schema, database, migration, or
production behavior was changed. No production merge, push, deployment, or
historical branch cleanup was performed. A5.1 is now complete locally and A6
remains separately gated.

## Architectural hold

The system is live. Normal feature development is paused while A0–A6 establish
one coherent ownership model. This is a behavior-preserving consolidation, not
a rewrite. A0 established the production truth, A1 established the
authorization and Server Action foundation, A2 established the shared domain
primitives and service-boundary map, and A3 established the shared community
mutation boundary, and A4 established the bounded course/Creator mutation
boundary. A5.1 is complete locally and A6 remains a gated packet; A6 is not
implied by this implementation.

## A4 current implementation boundary

The course Creator transport is intentionally stable and thin:

- `src/lib/portalAdmin/courseAdminActions.ts` owns the public Server Action
  signatures, `requirePortalAdmin('/portal')`, safe result normalization, and
  targeted `revalidatePath` calls.
- `src/lib/courseAdmin/courseCommands.ts`, `moduleCommands.ts`, and
  `lessonCommands.ts` own the existing operation semantics and canonical audit
  payloads.
- `src/lib/courseAdmin/policy.ts` owns explicit deletion confirmation,
  complete reorder validation, and duplicate-write classification.
- `src/lib/courseAdmin/persistence.ts` owns Payload reads, relationship
  traversal, privileged writes, and sequential reorder rollback; it has no
  actor policy or provider calls.

This is a local architectural boundary, not a production release claim. The
next packet is A6 Full Regression + Controlled Production Integration.

## A5 source-of-truth and architecture enforcement completion

A5 is complete locally on `codex/production-architecture-consolidation` from
the verified A4 HEAD `c1fa6a0bdaf908013ed2a215e00ccd5200bf192d`. It records the
production data-flow map, privileged-access register, direct Prisma inventory,
provider boundaries, identity/billing ownership, and architecture risks. It
also adds executable checks for privileged Payload access, page/component
persistence, direct Prisma drift, browser/server-only imports, administrator
helper duplication, design-token declarations, and reconciliation dry-run
write safety.

The A5 dry-run contract now prevents checkpoint callbacks from running outside
apply mode. A5.1 additionally separates read-only administrator resolution
from explicit provisioning, selects the canonical local billing projection,
closes support/sponsored/partner/email ownership, moves reviewed route/page
persistence behind named server-only services, and adds path-aware guards. No
reconciliation, administrator-link backfill, migration, database/provider
mutation, merge, push, or deployment was performed by A5.1. Remaining A6 rows
are live-evidence requirements only.

## System surfaces

1. **Public frontend** — the public Next.js surface for the JPV Bootcamp brand,
   product explanation, registration entry, checkout entry, sponsored access,
   support, and public course previews.
2. **Authentication** — Payload-backed administrator authentication and the
   member authentication/session flows used by `/portal`; authentication and
   authorization remain server-side concerns.
3. **Member Portal** — the authenticated `/portal` experience for learning,
   community, updates, live sessions, member profile/account, billing, and
   member-facing engagement.
4. **Creator/Admin Mode** — an administrator-only presentation and operation
   mode inside the Member Portal for day-to-day course, lesson, community,
   update, and live-session content administration.
5. **Payload Admin** — the `/admin` advanced/recovery/system console for
   Payload records, billing and provider operations, identity review,
   compliance/audit, migrations, and recovery actions.
6. **Provider/infrastructure integrations** — PostgreSQL, Stripe, LiveKit,
   Bunny, Resend, object storage, deployment/runtime health, and monitoring.

## Target relationship

```text
Payload CMS / PostgreSQL
        |
        +-- Public Next.js frontend
        |
        +-- Member Portal
        |      |
        |      +-- member mode
        |      +-- Creator/Admin Mode
        |
        +-- Payload Admin
               |
               +-- advanced operations
               +-- billing/system/compliance
               +-- recovery console
```

The diagram is a relationship model, not permission to bypass domain services.
Provider truth remains with the provider; local records are projections,
operational state, or audit state according to the source-of-truth map.

## Non-negotiable architectural statements

- Payload remains the CMS/data authority for Payload domains. A Payload record
  must not be shadowed by a second writable store without an explicit domain
  decision.
- Portal Creator Mode is the day-to-day content administration surface for
  course, lesson, community, update, and live-session work. It uses the same
  domain operations and actor policy as other server entry points.
- Payload Admin remains the advanced/recovery/system console for billing,
  provider reconciliation, identity, compliance, migrations, audit, and
  recovery. It is not a second content model.
- Member and admin identities remain distinct. A Payload administrator may have
  a linked portal member profile, but the link is explicit and does not turn
  the two identities into one record or create a synthetic subscription.
- Creator “member preview” is a scoped preview of member-facing presentation;
  it is not impersonation and must not inherit a member’s identity or bypass
  actor authorization.
- Portal scroll ownership is architectural law: the route that owns the
  scroll container owns focus, mutation preservation, deep-link restoration,
  and no-jump behavior. Components must not reset the page or outer container
  as a side effect of an interaction.
- JPV Design Authority v1 and its executable token source remain canonical:
  `docs/design/JPV_DESIGN_SYSTEM_AUTHORITY_V1.md` and
  `src/lib/brand/jpvDesignSystem.ts`. Consolidation may simplify composition,
  but may not create a competing token or brand authority.
- Production `main` is the release authority. A feature branch, worktree,
  staging image, or provider dashboard is not a release authority by itself.

## Current implementation boundary

The repository already contains both Payload collections and Prisma/provider
integration modules. That is evidence of the current implementation, not proof
that every implementation path has live proof. The canonical ownership
decisions are recorded in `JPV_DOMAIN_SOURCE_OF_TRUTH.md` and
`JPV_OWNERSHIP_DECISIONS_V1.md`; unknown or duplicate runtime joins remain
review-required and must not be silently collapsed.

The A0 branch inventory also found historical worktrees and isolated commits.
They remain intact. No branch, worktree, database, provider record, or runtime
was deleted or mutated by A0.

## Authority chain

1. Production evidence and `main` establish the release baseline.
2. This document establishes the architectural relationship and laws.
3. `JPV_DOMAIN_SOURCE_OF_TRUTH.md` establishes domain ownership and ambiguity.
4. `JPV_ENGINEERING_PRINCIPLES.md` establishes implementation constraints.
5. `JPV_ARCHITECTURE_CONSOLIDATION_PLAN.md` establishes packet order, scope,
   validation, stop conditions, and rollback expectations.
6. Existing historical release, roadmap, handoff, and design documents remain
   useful provenance only where their status banners identify them as history.
