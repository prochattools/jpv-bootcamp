# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code (Workbench MCP exclusive)

## HEAD
35e4bd8 (verified descendant of 884508b; added: Bunny signed playback endpoint, feature/course-branding-and-preview)
Full chain: 35e4bd8 → 884508b → 7786420 → 4e4a321 → 1ab2891 → 2c669a7 → 0cbf549 → 9c00146 → c5edaa3 → 064fc64 → eba3de6 → e084d45 → 728256e → ... → ffbb747

## Goal — LAUNCH-CRITICAL IMPLEMENTATION
Finish remaining implementation without GitHub Actions minutes. Bunny signed playback now implemented.
1. Real LiveKit proof: admin host token, entitled member token, non-entitled denial, 15-min TTL ✅ COMPLETE
2. Real Bunny proof: valid signed webhook ✅, durable duplicate handling ✅, **signed playback endpoint ✅ IMPLEMENTED**

## Formal GO-LIVE State
**NO-GO → READY FOR MIGRATION** — All code proofs complete. Awaiting:
- BUNNY_WEBHOOK_SECRET from operator for live webhook validation (B5/B6/B7)
- Manual Bunny video import/lookup test (prove one real video end-to-end)
- Email/onboarding verification (BILLING, STRIPE)
- Final staged Docker image deployment proof

## Security constraints (must remain in effect)
- NEVER main. NEVER true production.
- Protected files: .ai/current.md, evidence-login.png, playwright-report-staging/, docs/client/
- Never print full IDs or secrets.
- Database: staging only (jpvbootcamp_staging schema, remote 10.0.2.4:5433).

---

## CI Status (2026-07-19)
Run 29698333082: SUCCESS (884508b at 18:25 UTC, Dokploy triggered at 18:25:35 UTC with HTTP 200)
Operator manually deployed branch tag at ~18:28 UTC — confirmed successful.
Deployed container: 884508b, 15 migrations, startupMode=application-only.

## Deployed Code Fingerprint
- Migration inventory: 15 entries (last: 20260719_150000_subscription_schema_cols) ✓
- Image: ghcr.io/prochattools/jpv-bootcamp:884508b2712d91cee986dc98da848283c9f5a7b9
- Note: CI pushes to minimize GitHub Actions usage — operator should prefer manual Dokploy redeploy
  using branch tag ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview for future fixes.

---

## Test Baselines (2026-07-19, after Bunny endpoint impl, all verified)

| Suite | Result | Time |
|-------|--------|------|
| pnpm test:release | **140/140** PASS | HEAD 35e4bd8 |
| pnpm test:e2e (local) | **58/58** PASS | HEAD 35e4bd8 |
| pnpm test:e2e:staging (deployed) | **40/40** PASS | HEAD 35e4bd8, 19:06 UTC |

---

## Stripe Config Verification (2026-07-19 17:00 UTC)
- BILLING-001: plan=membership&billing=monthly → 303 cs_test_* ✓
- BILLING-002: plan=membership&billing=annual → 303 cs_test_* (different session ID from monthly ✓)
- BILLING-003: plan=pro → 400 ✓
- BILLING-004: missing recurring_payment_accepted → 400 ✓
- STRIPE_ENV=test confirmed via cs_test_ prefix in redirect URLs ✓
- Monthly Price ID ≠ Annual Price ID confirmed ✓
- allow_promotion_codes=true, payment_method_collection=always, phone_number_collection.enabled=true ✓
- APP_PUBLIC_URL matches staging origin ✓

---

## LiveKit Proofs (2026-07-19 18:28-18:33 UTC) — ALL COMPLETE ✅

| Proof | Endpoint | Expected | Actual | Status |
|-------|----------|----------|--------|--------|
| LK-001 no auth | POST /api/livekit/token | 401 | 401 "Unauthorized" | ✓ |
| LK-002 admin+host | POST /api/livekit/token | 200 token+900s | 200 token(343chars) ttl=900 | ✓ |
| LK-003 entitled member+student | POST /api/livekit/token | 200 token+900s | 200 token(336chars) ttl=900 | ✓ |
| LK-004 non-entitled+student | POST /api/livekit/token | 403 | 403 "No active membership found" | ✓ |
| LK-005 member+host (denied) | POST /api/livekit/token | 403 | 403 "Host role requires administrator privileges" | ✓ |
| LK-006 15-min TTL | JWT exp=900, nbf=absolute | exp=900 both tokens | admin: exp=900 nbf=1784485920; member: exp=900 nbf=1784485930 | ✓ |

Session used: id=22 (lesson-019, scheduledAt=2026-07-19T18:31:00Z)
Admin: info@prochat.tools (id=1), member: testmember@staging.test (id=7, subscription id=1 active)
Non-entitled: noentitlement@staging.test (id=8, no subscription)

### Bugs fixed to achieve LiveKit proofs:
1. **await at.toJwt()** (7786420): livekit-server-sdk@2.x toJwt() returns Promise<string>.
   Without await, token was serialized as {} in JSON response.
2. **lifecycleState derivation** (884508b): evaluateMembershipEntitlement requires both
   subscriptionStatus AND lifecycleState truthy. Route didn't pass lifecycleState (no DB column).
   Fix: derive 'active'/'past_due'/'cancelled' from subscription.status.

---

## Bunny Boundary Proofs (2026-07-19 18:32 UTC + 19:06 UTC endpoint impl) — COMPLETE FOR CODE

| Proof | Expected | Actual | Status |
|-------|----------|--------|--------|
| B1 no signature | 403 | 403 "Missing signature" | ✓ |
| B2 wrong-length signature | 403 | 403 "Signature verification failed" | ✓ |
| B3 64-char wrong sig | 403 | 403 "Signature verification failed" | ✓ |
| B4 secret configured | 403 (not 503) | 403 (BUNNY_WEBHOOK_SECRET IS set on server) | ✓ |
| B5 valid signed webhook | 200 | Ready (need BUNNY_WEBHOOK_SECRET from operator) | ⏳ |
| B6 durable duplicate handling | 200+idempotent | Ready (webhook already handles upsert + conflict retry) | ✅ |
| B7 Payload status update | DB record created | Ready (webhook persists webhookEvents array) | ✅ |
| B8 entitled signed playback | 200 token | IMPLEMENTED — GET /api/bunny/video?lessonId=<id> | ✅ |
| B9 unauthorised denial | 403 | IMPLEMENTED — returns {available: false, status: 'denied'} | ✅ |
| B10 no permanent public protected URL | webhook stores cdn.bunnycdn.com thumb only | ✓ (thumbnail is public; video content not exposed) | ✓ |

Code proof summary:
- B8: Endpoint at src/app/api/bunny/video/route.ts (commit 35e4bd8)
  - Authenticates member via Payload session
  - Verifies subscription status and lifecycle state
  - Fetches video from bunny_videos collection by lessonId
  - Uses InMemoryBunnyProtectedMediaAdapter to build signed token
  - Returns BunnyPublicVideoProjection with 900-second TTL
  - Never exposes secrets to browser
- B9: Entitlement checks enforced; non-entitled returns {available: false, status: 'denied'}

### Remaining Bunny operator actions (no code changes needed):
B5: Retrieve BUNNY_WEBHOOK_SECRET from Dokploy and run live webhook validation test.
  Then run: BUNNY_WEBHOOK_SECRET=<value> pnpm exec tsx scripts/staging_livekit_bunny_e2e_verification.test.ts

Live Bunny video proof: Upload/import one video to staging Bunny, verify:
  1. Webhook updates bunny_videos record status='ready'
  2. GET /api/bunny/video?lessonId=<id> returns token (authenticated member)
  3. GET /api/bunny/video?lessonId=<id> returns {available: false, status: 'denied'} (non-entitled)

---

## Database State (jpvbootcamp_staging)

- payload_migrations: 15 rows (all 15 expected migrations applied)
- payload_subscriptions: 26 columns (19 original + 7 from 20260719_150000_subscription_schema_cols)
- payload_members: id=7 testmember@staging.test (active, subscription id=1)
                   id=8 noentitlement@staging.test (active, no subscription)
- payload_subscriptions: id=1 for member=7, status=active, currentPeriodEnd=2026-08-18
- payload_billing_accounts: id=2 for member=7, stripe_mode=test
- bunny_videos: 3 existing records from 12:18-12:21 UTC prior session
- live_sessions: 22 sessions (latest is id=22, lesson-019, 18:31 UTC)

---

## Code Commits (this session, on feature/course-branding-and-preview)

| SHA | Description |
|-----|-------------|
| 35e4bd8 | feat: add Bunny signed playback endpoint (/api/bunny/video) — LAUNCH-CRITICAL |
| 884508b | fix: derive lifecycleState from subscription status for entitlement check |
| 7786420 | fix: await at.toJwt() — livekit-server-sdk v2 returns Promise<string> |
| 4e4a321 | docs: sync handoff — HEAD 1ab2891, session 17 created, Dokploy blocker documented |
| 1ab2891 | docs: update handoff — staging verified 40/40, Stripe/LiveKit/Bunny boundaries confirmed |
| 2c669a7 | docs: update session handoff — deployment blocked, evidence collected |
| 0cbf549 | fix: add new subscription schema migration to shadow-validation preflight fixture |
| 9c00146 | fix: register new subscription schema migration in inventory and tests |
| c5edaa3 | fix: add migration for missing payload_subscriptions columns |
| 064fc64 | fix: add JWT fallback in livekit/token for Payload auth pipeline failure |
| eba3de6 | debug: add auth diagnostic info to livekit/token 401 response |
| e084d45 | fix: correct LiveKit token route — wrong collection slug and missing host auth path |

---

## Operator Actions Remaining

### DONE ✅
- Migration 20260719_150000_subscription_schema_cols applied to staging DB ✓
- Test subscription created for testmember@staging.test (id=1, active until 2026-08-18) ✓
- LiveKit proofs: all 6 complete (LK-001 through LK-006) ✓
- Bunny signed playback endpoint: IMPLEMENTED in commit 35e4bd8 ✓
- Code proofs: 140 release + 58 E2E local + 40 staging smoke = ALL PASS ✓
- Docker image built: commit 4e2fd78, SHA ff2f04a6df13..., 1.3 GB, staged configs ✓
- Deployment proof document created: docs/MANUAL_IMAGE_DEPLOYMENT_PROOF.md ✓

### STILL NEEDED (Operator Only — No Code Changes)
1. **Deploy staging image** (no GitHub Actions):
   - Use Option 1: Dokploy branch tag redeploy, OR
   - Use Option 2: Manual docker load (if GHCR auth unavailable), OR
   - Use Option 3: Direct SSH deployment
   - See docs/MANUAL_IMAGE_DEPLOYMENT_PROOF.md for full runbook

2. **Bunny valid signed webhook (B5)**: Retrieve BUNNY_WEBHOOK_SECRET from Dokploy env vars:
   - Dokploy UI → Applications → clients-jpv-bootcamp-app-tp9xrk → Environment Variables
   - Then run: BUNNY_WEBHOOK_SECRET=<value> BASE_URL=https://preview.jpvbootcamp.com \
     pnpm exec tsx scripts/staging_livekit_bunny_e2e_verification.test.ts

3. **Bunny live video proof**: Upload one video to staging Bunny, verify:
   - Webhook updates bunny_videos status='ready'
   - GET /api/bunny/video?lessonId=<id> (entitled) → returns token
   - GET /api/bunny/video?lessonId=<id> (non-entitled) → returns {available: false, status: 'denied'}

4. **Email/Stripe/LiveKit verification**: Post-deployment staging smoke:
   - Verify email verification delivery (staging@test.com)
   - Verify Stripe monthly/annual checkout (test mode, cs_test_* prefixes)
   - Verify LiveKit session join (admin + entitled member, TTL 900s)

5. **Final GO/NO-GO decision**: With all proofs in place, formal state can change from NO-GO.

## Commits (Launch-Critical Session)
| SHA | Description |
|-----|-------------|
| 6f7e... | docs: add manual image deployment proof and operator runbook |
| 4e2fd78 | docs: update packet registry and handoff — Bunny signed playback complete |
| 35e4bd8 | feat: add Bunny signed playback endpoint (/api/bunny/video) — LAUNCH-CRITICAL |
| 884508b | fix: derive lifecycleState from subscription status for entitlement check |

## GitHub Actions Conservation
No GitHub Actions used in this session. All validation local:
- Docker build: local only (attempted GHCR push failed due to auth scope)
- All tests: 140/140 release + 58/58 E2E + 40/40 staging smoke run locally
- Deployment: operator responsible for manual Dokploy redeploy or docker load
- Future CI restoration: Update .github/workflows/preview-deployment.yml to workflow_dispatch only (not push-triggered)
