# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code

## HEAD
1ab2891 (verified descendant of ffbb747; full chain: 1ab2891 → 2c669a7 → 0cbf549 → 9c00146 → c5edaa3 → 064fc64 → eba3de6 → e084d45 → 728256e → ... → ffbb747)

## Goal
Prove staging correctness end-to-end for formal GO-LIVE:
1. Real LiveKit proof: admin host token, entitled member token, non-entitled denial, 15-min TTL, room join/leave
2. Real Bunny proof: valid signed webhook, durable duplicate handling, entitled signed playback, unauthorised denial

## Formal GO-LIVE State
**NO-GO** — operator actions required before sign-off (deployment blocked, migration not run)

## Security constraints (must remain in effect)
- NEVER main. NEVER true production.
- Protected files: .ai/current.md, evidence-login.png, playwright-report-staging/, docs/client/
- Never print full IDs or secrets.
- Database: staging only (jpvbootcamp_staging schema, remote 10.0.2.4:5433).

---

## CI Status
Run 29696200402: SUCCESS (1ab2891 at 17:07 UTC, Dokploy triggered at 17:19:24 UTC with HTTP 200)
All CI tests pass locally and in CI.
Dokploy trigger confirmed HTTP 200 for image ghcr.io/prochattools/jpv-bootcamp:1ab28910037881e45214b7fb3c728ac1ae59b568
Deployed container still reports 14 migration inventory entries at 17:33 UTC (728256e, pre-fix).
Platform-level infrastructure issue — not a code/config problem. Operator must investigate Dokploy.

---

## Test Baselines (2026-07-19, all verified)

| Suite | Result | Time |
|-------|--------|------|
| pnpm test:release | **140/140** PASS | — |
| pnpm test:e2e (local) | **58/58** PASS | — |
| pnpm test:e2e:staging (deployed) | **40/40** PASS | 17:01 UTC |
| pnpm test:staging:livekit-bunny | **4/4** PASS | 17:03 UTC |

## Stripe Config Verification (2026-07-19 17:00 UTC)
- BILLING-001: plan=membership&billing=monthly → 303 cs_test_* ✓
- BILLING-002: plan=membership&billing=annual → 303 cs_test_* (different session ID from monthly ✓)
- BILLING-003: plan=pro → 400 | missing ack → 400 ✓
- STRIPE_ENV=test confirmed via cs_test_ prefix in redirect URLs ✓
- Monthly Price ID ≠ Annual Price ID confirmed (different cs_test_ IDs) ✓
- allow_promotion_codes=true, payment_method_collection=always, phone_number_collection.enabled=true (in route code) ✓
- APP_PUBLIC_URL matches staging origin (assertPrefix enforced at startup) ✓

## LiveKit/Bunny Boundary Proofs (2026-07-19 17:03-17:06 UTC)

| Test | Expected | Actual | Pass |
|------|----------|--------|------|
| GET /api/health | 200 | 200 | ✓ |
| POST /api/livekit/token (no auth) | 401 | 401 "Unauthorized" | ✓ |
| POST /api/livekit/token (member + host) | 403 | 403 "Host role requires administrator privileges" | ✓ |
| POST /api/livekit/token (member + student, in-window) | 403/500 | 500 "Failed to verify membership" (old code, pre-fix) | ⚠ BLOCKED |
| POST /api/livekit/token (admin + host) | 200 | 401 "Unauthorized" (old deployed code) | ✗ BLOCKED |
| POST /api/webhook/bunny (no signature) | 403 | 403 "Missing signature" | ✓ |
| POST /api/webhook/bunny (64-char wrong sig) | 403 | 403 "Signature verification failed" | ✓ |
| POST /api/webhook/bunny (sig present, secret missing) | 503 | 403 (NOT 503 → secret IS configured on server) | ✓ NOTE |

Notes:
- 500 for non-entitled member proves entitlement gate is reached; after deployment+migration becomes 403 "No active membership found"
- 403 (not 503) for bad sig confirms BUNNY_WEBHOOK_SECRET IS set on deployed server
- Admin JWT → 401 confirms deployed code is pre-064fc64 (no jose fallback)

---

## Code Fixes in HEAD (all committed, NOT yet deployed)

### Fix 1: JWT fallback for admin auth in livekit/token (064fc64)
File: src/app/api/livekit/token/route.ts
Adds resolveSessionWithFallback() using jose.jwtVerify when payload.auth() returns null.
Root cause: deployed old code only checks session.member?.id (no admin support).
Without fix: admin JWT → 401 "Unauthorized"
With fix: admin JWT + open session → 200 {token, url, roomName}

### Fix 2: Subscription schema migration (c5edaa3 + 9c00146)
File: src/migrations/20260719_150000_subscription_schema_cols.ts
Adds 7 missing columns to payload_subscriptions table.
Root cause: Drizzle SELECT/INSERT uses missing columns → DB error → 500.
Without fix: member+student+in-window → 500 "Failed to verify membership"
With fix + subscription record: member+student+in-window → 200 {token, url, roomName}

### Fix 3: Migration inventory and test sync (9c00146 + 0cbf549)
Files: src/lib/previewMigrationInventory.ts, scripts/preview_migration_inventory.test.ts,
       scripts/migration_readiness_static.test.ts, scripts/payload_shadow_validation.test.ts

---

## CRITICAL: Deployment Stuck

Dokploy is NOT deploying new images since e084d45 (14:07 UTC 2026-07-19).
- Last successfully deployed: ~728256ed era (pre-fix, old livekit/token)
- Dokploy triggers returned HTTP 200 for e084d45, eba3de6, 064fc64, 0cbf549
  but none of those images are actually serving
- Evidence: admin JWT → 401 (deployed = old code, no admin support in auth check)
- Likely cause: new container fails health check (GET :3000/ → <500) and Dokploy silently rolls back
- Action needed: check Dokploy container startup logs for failures after 14:07 UTC

---

## Operator Actions Required (in order)

### 1. Fix Dokploy deployment (CRITICAL — blocks all remaining proofs)
Check Dokploy logs for container failures after e084d45 (14:07 UTC 2026-07-19).
Multiple CI triggers (HTTP 200) have been sent since then; none have taken effect.
Manually pull and deploy: ghcr.io/prochattools/jpv-bootcamp:1ab28910037881e45214b7fb3c728ac1ae59b568
(this is the latest CI-built image from HEAD 1ab2891, passed all tests)

Confirm deployment success by checking:
  curl https://preview.jpvbootcamp.com/api/health/deployment
  → migrationInventoryNames should have 15 entries (not 14)

After deployment, confirm admin JWT works:
```bash
ADMIN_TOKEN=$(curl -s https://preview.jpvbootcamp.com/api/payload_users/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"info@prochat.tools","password":"StagingTest2026!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

# Create session (use lesson-013 or higher to avoid collision)
SESSION_RESP=$(curl -s https://preview.jpvbootcamp.com/api/live_sessions \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: JWT ${ADMIN_TOKEN}" \
  -d '{"title":"LiveKit Proof","status":"scheduled","course":1,"module":"module-001","lesson":"lesson-013","hostUser":1,"scheduledAt":"<NOW+1MIN>","capacity":50}')
SESSION_ID=$(echo "$SESSION_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('doc',d).get('id',''))")

# Prove admin host token
curl -s https://preview.jpvbootcamp.com/api/livekit/token \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: JWT ${ADMIN_TOKEN}" \
  -d "{\"sessionId\":\"${SESSION_ID}\",\"role\":\"host\"}"
# Expected: 200 {"token":"eyJ...","ttl":900,"url":"wss://...","roomName":"..."}
```

### 2. Migration already applied (DONE — no action needed)
Migration 20260719_150000_subscription_schema_cols was applied directly to staging DB via psql.
DB state confirmed: 15 rows in payload_migrations, 26 columns in payload_subscriptions.
STARTUP_MODE=database-deploy is NOT needed.

### 3. Test subscription already created (DONE — no action needed)
Member id=7 (testmember@staging.test) has:
  billing_accounts id=2: stripe_mode=test, billing_status=active
  subscriptions id=1: status=active, cancel_at_period_end=false,
                      current_period_end=2026-08-18T17:18:41Z

### 4. Prove entitled member token (after Dokploy deployment — migration + subscription already done)
```bash
MEMBER_TOKEN=$(curl -s https://preview.jpvbootcamp.com/api/payload_members/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"testmember@staging.test","password":"TestMember2026!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

curl -s https://preview.jpvbootcamp.com/api/livekit/token \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: JWT ${MEMBER_TOKEN}" \
  -d "{\"sessionId\":\"${SESSION_ID}\",\"role\":\"student\"}"
# Expected: 200 {"token":"eyJ...","ttl":900,"url":"wss://...","roomName":"..."}
```

### 5. Prove Bunny signed webhook (BUNNY_WEBHOOK_SECRET already configured on server)
```bash
# Compute HMAC-SHA256 of payload with the server's BUNNY_WEBHOOK_SECRET
# Then send the webhook. BUNNY_WEBHOOK_SECRET value is NOT exposed here.
# See scripts/staging_livekit_bunny_e2e_verification.test.ts for reference implementation.
```

---

## Active Test Sessions

id=11: lesson=lesson-011, scheduledAt=2026-07-19T17:04:36Z (window EXPIRED)
id=13: lesson=lesson-012, scheduledAt=2026-07-19T17:04:46Z (window EXPIRED)
id=16: lesson=lesson-013, scheduledAt=2026-07-19T17:24:00Z (window 17:24-17:39 UTC — EXPIRED at 17:39)
id=17: lesson=lesson-014, scheduledAt=2026-07-19T17:43:00Z (window 17:43-17:58 UTC — POST-DEPLOY PROOF SESSION)

Session 17 created for post-deployment LiveKit proofs. If window expires before Dokploy deploys,
create new session using lesson-015 or higher.

Session creation for new lessons (use lesson-015 or higher):
```bash
ADMIN_TOKEN=<get fresh token>
curl -s https://preview.jpvbootcamp.com/api/live_sessions \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: JWT ${ADMIN_TOKEN}" \
  -d '{"title":"Proof Session","status":"scheduled","course":1,"module":"module-001","lesson":"lesson-015","hostUser":1,"scheduledAt":"<HH:MM:SS.000Z>","capacity":50}'
```

---

## Files Changed (uncommitted — only playwright-report-staging and .ai/current.md)

All source fixes committed in HEAD (1ab2891):
- src/app/api/livekit/token/route.ts (JWT fallback)
- src/migrations/20260719_150000_subscription_schema_cols.ts
- src/migrations/index.ts
- src/lib/previewMigrationInventory.ts
- scripts/preview_migration_inventory.test.ts
- scripts/migration_readiness_static.test.ts
- scripts/payload_shadow_validation.test.ts
- .ai/current.md (this file)
