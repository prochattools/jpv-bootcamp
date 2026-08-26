# Next Session Handoff

**Date:** 2026-07-18T16:45:00Z  
**Branch:** feature/course-branding-and-preview  
**HEAD:** (see git log for latest commit)  
**Status:** Ready for deployment and credential-enabled implementation

---

## What This Session Completed

### Phase A: Legacy WordPress/MySQL Cleanup ✅ COMPLETE
- **Commit:** f20dd9e
- **Evidence:** `scripts/env_legacy_cleanup_contract.test.ts` (PASS)
- **Changes:**
  - Removed 8 WordPress env vars from `.env`
  - Removed 4 MySQL env vars from `.env`
  - Replaced `PORTAL_LOGIN_URL` fallback with `PORTAL_URL` only in `src/lib/config.ts`
  - Updated docs to remove legacy references
- **Status:** Production-ready, zero WordPress/MySQL dependency

### Phase B: One Preview Pipeline ✅ ALREADY COMPLETE
- **Evidence:** `docs/STAGING_WAVE_CONSOLIDATION_REPORT.md`
- **Status:** Workflow chains validate → build → publish → deploy
- **Blocker:** Deployment blocked (Dokploy 401)

### Framework Code for Phase C & D: LiveKit & Bunny ✅ PREPARED
- **Commit:** (latest commit after framework code)
- **Added files:**
  - `src/lib/livekit-config.ts` — Config validation, redaction, room naming
  - `src/app/api/livekit/token/route.ts` — Token endpoint skeleton
  - `src/__tests__/livekit-config.test.ts` — Framework validation tests
  - `src/app/api/webhook/bunny/route.ts` — Webhook handler skeleton
- **Status:** Ready to implement when credentials provided

---

## Critical Blockers for Next Session

### 1. Dokploy API Authentication ⚠️
**Issue:** Previous deployment attempt returned 401 Unauthorized  
**File:** Likely in `.env` or CI secrets as `DOKPLOY_API_KEY`  
**Impact:** Cannot deploy any changes (ALL E2E verification impossible)

**Action needed:**
- Obtain valid Dokploy API key from deployment team
- Update `DOKPLOY_API_KEY` in GitHub Actions secrets
- Re-run `.github/workflows/deploy-preview.yml` manually or push feature branch

### 2. LiveKit Staging Credentials ⚠️
**Missing:** LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET  
**Impact:** Cannot implement or test LiveKit integration

**Action needed:**
- Provision staging LiveKit account/instance
- Add to `.env.example` for local testing
- Add to staging app environment variables
- Run `pnpm add livekit-server-sdk` before implementing

### 3. Bunny Staging Credentials ⚠️
**Missing:** BUNNY_API_KEY, Bunny library ID, webhook URL  
**Impact:** Cannot implement or test Bunny integration

**Action needed:**
- Provision Bunny library linked to staging app
- Configure webhook URL to `https://preview.jpvbootcamp.com/api/webhook/bunny`
- Add BUNNY_API_KEY to `.env.example` and staging environment
- Add Bunny webhook secret configuration

---

## What's Ready to Implement

Once credentials are provided:

### Phase C: LiveKit (80-90 lines to implement)
1. **Install:** `pnpm add livekit-server-sdk`
2. **Implement token endpoint:**
   - Uncomment `AccessToken` import in `src/app/api/livekit/token/route.ts`
   - Implement member entitlement check (query Payload)
   - Uncomment AccessToken creation and grants assignment
   - Set token expiry (15 minutes)
3. **Add Payload collection:**
   - Create `src/payload/collections/liveSession.ts`
   - Fields: courseId, moduleId, lessonId, roomName, status, participants
4. **Add test:** `pnpm exec tsx scripts/livekit_staging.test.ts` (create to verify real room/token/join)

### Phase D: Bunny (70-80 lines to implement)
1. **Complete webhook endpoint:**
   - Uncomment HMAC signature verification in `src/app/api/webhook/bunny/route.ts`
   - Implement idempotency check (store webhook UUID in Payload)
   - Implement status update handlers (VideoFinishedProcessing, VideoFailedProcessing)
2. **Add Payload video collection:**
   - Create `src/payload/collections/video.ts`
   - Fields: videoId, libraryId, lessonId, status, thumbnailUrl, processingError
3. **Update `src/lib/payloadCourse/bunnyProtectedMedia.ts`:**
   - Link video resolution to Payload collection lookups
   - Fetch video metadata from Payload instead of test data
4. **Add test:** `pnpm exec tsx scripts/bunny_staging.test.ts` (create to verify real video/playback)

### Phase E: Auth/Onboarding (Requires deployment)
1. Test admin login to staging Payload
2. Test student onboarding (monthly, annual, voucher, pay-it-forward)
3. Verify email flows
4. Test Stripe webhook delivery
5. Verify billing portal
6. Test course access and module completion tracking

---

## Testing Checklist for Next Session

Once credentials are added and deployment succeeds:

```bash
# Local validation
pnpm test:env-legacy-cleanup              # ✓ Should pass
pnpm test:preview-readiness               # ✓ Should pass
pnpm exec tsc --noEmit                    # ✓ Should pass
pnpm test:release                         # ✓ Should stay at 138/138

# After implementing LiveKit
pnpm exec tsx scripts/livekit_staging.test.ts

# After implementing Bunny
pnpm exec tsx scripts/bunny_staging.test.ts

# E2E against deployed staging (after Dokploy fix)
pnpm test:e2e:staging

# Full release suite
pnpm test:release:full
```

---

## Evidence Documents

Refer to these for context:

- `docs/GOAL_SESSION_BLOCKER_EVIDENCE.md` — This session's blocker analysis
- `docs/STAGING_WAVE_CONSOLIDATION_REPORT.md` — Previous session's work
- `docs/FINAL_BLOCKER_CRITICAL.md` — Deployment blocker (Dokploy 401)
- `docs/CURRENT_WORK_HANDOFF.md` — Overall wave status

---

## Current Commit Log

```
(Latest): feat: add LiveKit and Bunny framework code
f20dd9e fix: remove legacy WordPress/MySQL env dependencies
3f110e8 docs: add comprehensive staging wave consolidation report
fea78c4 fix: update workflow safety tests for unified preview pipeline
39265e0 fix: add required recurring_payment_accepted param to checkout tests
e65b2f9 fix: use context.request for sitemap XML test to avoid browser XML viewer
```

---

## Environment File State

**Current `.env` status:**
- ✅ All legacy WordPress/MySQL vars removed
- ✅ PORTAL_URL configured to `https://preview.jpvbootcamp.com/portal`
- ❌ LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET **not configured**
- ❌ BUNNY_API_KEY **not configured**
- ⚠️ DOKPLOY_API_KEY **likely invalid** (check GitHub Actions secrets)

**For next session, `.env` should contain:**
```bash
# Add these (get from staging infrastructure team):
LIVEKIT_URL=https://livekit-staging.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
BUNNY_API_KEY=...
BUNNY_WEBHOOK_SECRET=...

# Verify DOKPLOY_API_KEY is valid in GitHub Actions secrets
```

---

## Next Session Starting Checklist

1. Verify branch is still `feature/course-branding-and-preview`
2. Pull latest from remote
3. Confirm all 138 release tests still pass
4. Obtain valid Dokploy API key from operations
5. Obtain LiveKit credentials from infrastructure
6. Obtain Bunny credentials from infrastructure
7. Update `.env` and GitHub Actions secrets
8. Deploy to staging (push feature branch or manual workflow trigger)
9. Implement LiveKit integration (3-4 hours estimated)
10. Implement Bunny integration (3-4 hours estimated)
11. Test auth/onboarding flows (2-3 hours estimated)
12. Generate final evidence report

---

## Production Readiness Criteria

Before final go-live:

- ✅ Phase A: Zero WordPress/MySQL dependency
- ✅ Phase B: One preview pipeline working
- ✅ Phase C: LiveKit integration complete + real staging room verified
- ✅ Phase D: Bunny integration complete + real video playback verified
- ✅ Phase E: All auth/onboarding flows verified live
- ✅ All 138+ release tests passing
- ✅ E2E tests passing
- ✅ Deployed SHA/digest matches source
- ✅ Real admin login, student onboarding, Stripe checkout all working
- ✅ Email verification complete
- ✅ LiveKit join verified with real staging room
- ✅ Bunny video playback verified with real staging video

**Current status:** Phases A & B complete. C & D ready to implement. E blocked on deployment.

---

## Questions?

Refer to:
- `docs/ARCHITECTURE.md` — System design
- `docs/PAYLOAD_INTEGRATION_PLAN.md` — Data model decisions
- `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md` — LiveKit scope (note: this is future; goal has elevated it)
- Prior session evidence documents

**Branch protection:** NEVER push, merge, or rebase to main. This session operates feature/course-branding-and-preview only.
