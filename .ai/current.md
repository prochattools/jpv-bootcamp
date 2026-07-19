# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code

## HEAD
6c4d6e1 — fix: make Bunny webhook idempotent via conflict-retry upsert

## Goal
Prove staging correctness end-to-end: migrations applied, LiveKit/Bunny endpoints verified, real Checkout working, all test suites green.

## Status
2026-07-19T12:36 — PARTIAL PASS. All automated verification complete. Formal state remains NO-GO pending operator LiveKit proof (real room join/leave) and Bunny signed playback proof.

## Test scores
- Release tests:  140/140 PASS
- Local E2E:       58/58  PASS
- Staging E2E:     40/40  PASS (run 2026-07-19T12:35)
- CI:              run 29687166710 PASS

## Staging migrations applied
All pending migrations applied to jpvbootcamp_staging:
- 20260707_130000_remove_table_plan_from_payload_enums (batch 8)
- 20260718_103726_membership_support_schema (batch 9)
- 20260718_000000_live_sessions (batch 10)
- 20260718_110000_bunny_videos (batch 10)

Tables confirmed: live_sessions, bunny_videos with indexes.

## What was fixed this session
1. **4 migration bugs** (previous session):
   - Schema hardcoding in enum migration (used 'jpvbootcamp' instead of staging schema)
   - Missing vip→pro remap before enum recreation
   - 3 missing CREATE TYPE statements in membership_support_schema
   - CREATE INDEX schema-qualified index names (PostgreSQL syntax error)

2. **Bunny webhook idempotency** (this session):
   - Second call to /api/webhook/bunny with same (libraryId, videoId) returned 500
   - Root cause: payload.find() silently swallowed an error, then create() hit unique constraint
   - Fix: conflict-retry upsert pattern — if create throws 23505/unique, re-find and update
   - File: src/app/api/webhook/bunny/route.ts

## Deployed verification
- Bunny webhook: 403 on no-signature, 403 on invalid-signature ✓
- LiveKit token: 401 on unauthenticated request ✓
- Health: 200 ✓
- Checkout: /api/stripe/checkout?plan=membership&billing=monthly → 303 to checkout.stripe.com ✓

## Remaining for full GO-LIVE
- Operator: real LiveKit room join/leave proof (admin host token + entitled member token)
- Operator: real Bunny signed playback proof (entitled member gets signed URL, non-entitled denied)
- Staging database backup pre-production-migrate
- Go-live decision: formal NO-GO → GO-LIVE only after operator evidence

## Protected files (do not modify)
- evidence-login.png
- playwright-report-staging/
- docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx
- docs/client/fixtures/

## Security constraints
- NEVER main. NEVER true production.
- Staging only: jpvbootcamp_staging schema, 10.0.2.4:5433

## Resume prompt
Resume from 6c4d6e1 in jpv-bootcamp (feature/course-branding-and-preview). Migrations applied, Bunny idempotency fixed, 40/40 staging E2E passed. Remaining: operator LiveKit proof and Bunny signed playback proof before formal GO-LIVE decision.
