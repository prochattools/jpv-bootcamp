# JPV Bootcamp Production Architecture v1

**Status:** CURRENT ARCHITECTURE AUTHORITY — A1 FOUNDATION COMPLETE

**Date:** 2026-08-27

This document is the architectural authority for the live JPV Bootcamp system
and for the post-launch consolidation packets A1–A6. It describes the target
relationship of existing surfaces. It does not authorize a rewrite, schema
change, provider mutation, migration, or feature batch. Those actions require
the packet-specific authorization and validation described in
`JPV_ARCHITECTURE_CONSOLIDATION_PLAN.md`.

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

The next packet is A2. A2–A6 remain not started; no production merge, push,
build, deployment, migration, provider mutation, or historical branch cleanup
is authorized by A1.

## Architectural hold

The system is live. Normal feature development is paused while A0–A6 establish
one coherent ownership model. This is a behavior-preserving consolidation, not
a rewrite. A0 established the production truth and A1 established the
authorization and Server Action foundation. A2–A6 remain gated packets and are
not implied by this implementation.

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
that every split is final. The canonical domain ownership decision is recorded
in `JPV_DOMAIN_SOURCE_OF_TRUTH.md`; rows marked **split/ambiguous** are
deliberate A1–A4 review inputs and must not be silently collapsed.

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
