# JPV Bootcamp — Frozen Launch Readiness Evidence Package (Staging)

> **Historical/non-operative checkpoint — 2026-08-21.** This is a duplicate
> staging evidence package retained for audit provenance. Its “READY FOR
> PRODUCTION AUTHORIZATION REVIEW” wording, migration count, deployment SHA,
> and acceptance claims are not current exact-SHA evidence. Use the canonical
> Phase 9.5 baseline at `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md`;
> production and Phase 10 remain unauthorized.

**Checkpoint date:** 2026-08-21  
**Environment:** Staging only  
**Production status:** Not authorized

## Purpose

This document freezes the verified staging readiness position before any future production authorization discussion.

No production operation, migration, or cutover is included in this package.

## Deployment Boundary

- Branch: `feature/course-branding-and-preview`
- Staging URL: `https://preview.jpvbootcamp.com`
- Dokploy application: `clients-jpv-bootcamp-app-tp9xrk`
- Database target: `jpvbootcamp_staging`
- Environment: `DEPLOYMENT_ENV=staging`

## Completed Roadmap Scope

### Phase 8 — Member Portal Operationalization

Status: COMPLETE

Verified scope:

- Member authentication flows operational
- Dashboard, courses, community, account, and billing journeys validated
- Community performance regression resolved
- Portal navigation performance restored

### Phase 9 — LiveKit Group Calls

Status: COMPLETE

Verified scope:

- Migration 36 applied
- Space-based live sessions enabled
- LiveKit token endpoint deployed
- Authentication and authorization gates verified
- Browser acceptance completed

## Migration Evidence

Current staging migration state:

- Payload migrations: 36/36 applied
- Phase 9 migration: `20260820_000000_live_session_space`
- No additional staging migrations authorized from this checkpoint

## Deployment Reliability Evidence

Status: COMPLETE

Resolved deployment issue:

- Dokploy GHCR registry configuration corrected
- Registry namespace corrected to `prochattools/jpv-bootcamp`
- Registry credentials corrected with appropriate package permissions
- Automatic deployment flow restored

## Acceptance Evidence

Verified:

- Release gates: 164/164 passing
- Portal acceptance flows passing
- LiveKit browser acceptance passing
- Authentication boundaries verified
- Staging health endpoint operational

## LiveKit Evidence

Verified:

- LiveKit environment configured in staging
- Anonymous token requests rejected
- Authorized participants receive tokens
- Host permissions validated
- Member permissions validated
- Browser acceptance completed

Remaining optional validation:

- Real-device microphone/camera WebRTC test

## Remaining Non-Blocking Items

1. Optional real-device LiveKit media validation
2. Optional deployment SSH fallback hardening
3. Future production cutover planning under separate authorization

## Hard Stops

Do not:

- Touch production
- Apply additional staging migrations without authorization
- Begin Phase 10 production cutover without explicit approval
- Add unrelated features before production decision

## Final Staging Position

**Status: READY FOR PRODUCTION AUTHORIZATION REVIEW**

The staging environment is considered complete for the current roadmap scope.

Future work requires a separate authorized decision.
