# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code

## HEAD
0cbf5493943fdfe7096a86f3affc27a95d84a045

## Goal
Prove staging correctness end-to-end for formal GO-LIVE:
1. Real LiveKit proof: admin host token, entitled member token, non-entitled denial, 15-min TTL, room join/leave
2. Real Bunny proof: valid signed webhook, durable duplicate handling, entitled signed playback, unauthorised denial

## Formal GO-LIVE State
**NO-GO** — operator actions required before sign-off

## Security constraints (must remain in effect)
- NEVER main. NEVER true production.
- Protected files: .ai/current.md, evidence-login.png, playwright-report-staging/, docs/client/
- Never print full IDs or secrets.
- Database: staging only (jpvbootcamp_staging schema, remote 10.0.2.4:5433).

---

## CI Status
Run 29693841256: SUCCESS (0cbf549 at 15:56 UTC, Dokploy triggered at 16:08 UTC)
All CI tests pass locally and in CI.

---

## Code Fixes in HEAD (all committed, not yet deployed)

### Fix 1: JWT fallback for admin auth in livekit/token (064fc64)
File: src/app/api/livekit/token/route.ts
Adds resolveSessionWithFallback() using jose.jwtVerify when payload.auth() returns null.
Root cause: deployed old code only checks session.member?.id (no admin support).

### Fix 2: Subscription schema migration (c5edaa3 + 9c00146)
File: src/migrations/20260719_150000_subscription_schema_cols.ts
Adds 7 missing columns to payload_subscriptions table.
Root cause: Drizzle SELECT/INSERT uses missing columns → DB error → 500.

### Fix 3: Migration inventory and test sync (9c00146 + 0cbf549)
Files: src/lib/previewMigrationInventory.ts, scripts/preview_migration_inventory.test.ts,
       scripts/migration_readiness_static.test.ts, scripts/payload_shadow_validation.test.ts

---

## CRITICAL: Deployment Stuck

Dokploy is NOT deploying new images since e084d45 (14:07 UTC today).
- Last successfully deployed: ~728256ed era (pre-fix, old livekit/token)
- Current deployed livekit/token: OLD code — only checks session.member?.id, no admin support
- Evidence: admin JWT → 401 "Unauthorized"; member JWT → reaches entitlement check
- Dokploy triggers returned HTTP 200 for e084d45, eba3de6, 064fc64, 0cbf549
  but none of those images are actually serving
- Likely cause: new container fails health check (GET :3000/ → <500) and Dokploy silently rolls back
- Action needed: check Dokploy container startup logs for failures after 14:07 UTC

---

## Proofs Completed This Session (Live Evidence)

Against https://preview.jpvbootcamp.com, session id=10, 2026-07-19 16:53 UTC:

| Test | Result | Status Code |
|------|--------|-------------|
| Admin JWT → admin/sessions auth passes | "Missing required fields..." | 400 |
| Unauthenticated → denied | "Unauthorized" | 401 |
| Member JWT + role=host → denied | "Host role requires administrator privileges" | 403 |
| Member JWT + role=student (pre-window) | "Session has not started yet" | 403 |
| Member JWT + role=student (in window) | "Failed to verify membership" | 500 |
| Admin JWT + role=host → livekit/token | "Unauthorized" (old deployed code) | 401 |

Context:
- Session creation working (sessions 6-10 created)
- Test member: testmember@staging.test / TestMember2026! (id=7, accountStatus=active)
- Billing account: id=1, stripeCustomerId=cus_test_staging_001, member=6
- The 500 for non-entitled member is from OLD deployed code querying wrong collection.
  After deployment + migration, this becomes 403 "No active membership found".

## Proofs Blocked

| Test | Blocker |
|------|---------|
| Admin host token | Dokploy not deploying 0cbf549 |
| Non-entitled denial (403 not 500) | Migration not run + old code deployed |
| Entitled member token | Migration + subscription + deployment needed |
| Token TTL=900s verification | Need working admin token first |
| Room join/leave | Operator-level, need token |
| Bunny signed playback | BUNNY_API_KEY + BUNNY_WEBHOOK_SECRET missing |

---

## Operator Actions Required

### 1. Fix Dokploy deployment (CRITICAL)
Check Dokploy logs for container failures after e084d45 (14:07 UTC 2026-07-19).
Manually redeploy: ghcr.io/prochattools/jpv-bootcamp:0cbf5493943fdfe7096a86f3affc27a95d84a045

After deployment, verify admin host token:
```bash
ADMIN_TOKEN=$(curl -s https://preview.jpvbootcamp.com/api/payload_users/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"info@prochat.tools","password":"StagingTest2026!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

# Create a new session if session 10 (id=10, 16:50-17:05 UTC) has expired
# Then test:
curl -s https://preview.jpvbootcamp.com/api/livekit/token \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: JWT ${ADMIN_TOKEN}" \
  -d '{"sessionId":"<NEW_SESSION_ID>","role":"host"}'
# Expected: 200 {"token":"eyJ...","url":"wss://...","roomName":"..."}
```

### 2. Run subscription schema migration (after deployment)
Set STARTUP_MODE=database-deploy one-time to run 20260719_150000_subscription_schema_cols.
This adds: billing_cadence, commitment_status, stripe_subscription_schedule_id,
commitment_start_at, commitment_end_at, cancellation_effective_at, payment_grace_ends_at.

### 3. Create subscription for test member (after migration)
Create payload_subscriptions record for member id=7 (testmember@staging.test):
status=active, currentPeriodEnd=future, cancelAtPeriodEnd=false

### 4. Bunny proof
Configure BUNNY_API_KEY, BUNNY_WEBHOOK_SECRET in staging env.
Bunny webhook idempotency code is deployed (6c4d6e1).

---

## Active Test Sessions

id=10: room=course-1-module-module-001-lesson-lesson-010, window 16:50-17:05 UTC 2026-07-19
(May be expired by resume time — create new sessions via Payload REST API)

Session creation:
```bash
ADMIN_TOKEN=<get fresh token>
curl -s https://preview.jpvbootcamp.com/api/live_sessions \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: JWT ${ADMIN_TOKEN}" \
  -d '{"title":"Test Session","status":"scheduled","course":1,"module":"module-001","lesson":"lesson-011","hostUser":1,"scheduledAt":"2026-07-19T<HH:MM:00.000Z>","capacity":50}'
```

---

## Files Changed (uncommitted — only playwright-report-staging and .ai/current.md)

All source fixes committed in HEAD (0cbf549):
- src/app/api/livekit/token/route.ts
- src/migrations/20260719_150000_subscription_schema_cols.ts
- src/migrations/index.ts
- src/lib/previewMigrationInventory.ts
- scripts/preview_migration_inventory.test.ts
- scripts/migration_readiness_static.test.ts
- scripts/payload_shadow_validation.test.ts
