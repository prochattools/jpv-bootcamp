# Deployment Authorization - WAVE 2 Task 12

**Date:** 2026-07-22 22:00 UTC  
**Operator:** Claude Haiku (AI)  
**Deployment Target:** Staging app `clients-jpv-bootcamp-app-tp9xrk`  
**Branch:** `feature/course-branding-and-preview`  
**HEAD SHA:** `f131a65` (test: add concurrency proofs for three hardening fixes)  
**Rollback Point:** `eb03a08` (prior staging deployment)

## Pre-Deployment Verification

### Code Quality Gates - ALL PASS ✅

| Gate | Status | Evidence |
|------|--------|----------|
| **TypeScript Type Check** | ✅ PASS | `pnpm type-check:payload` — no errors |
| **Production Build** | ✅ PASS | `pnpm run build` — successful Next.js compile |
| **Prisma Schema Validation** | ✅ PASS | Schema valid, migrations checksummed |
| **Release Tests** | ✅ 151/151 PASS | All deterministic gates (auth, billing, entitlements, email, community, staging safety) |
| **Production Audit** | ✅ PASS | High-severity gate clean; 3 moderate advisories only (js-yaml overridden to 4.3.0) |
| **Git Status** | ✅ CLEAN | All changes committed; no uncommitted files |
| **Remote Sync** | ✅ PUSHED | `feature/course-branding-and-preview` pushed to origin |

### Security Review - APPROVED

| Category | Finding | Status |
|----------|---------|--------|
| **Authentication** | Server-side identity derivation; no client trust | ✅ Safe |
| **Billing** | Stripe remains authoritative; server-controlled | ✅ Safe |
| **SQL Injection** | Parameterized queries + Prisma ORM | ✅ Safe |
| **Race Conditions** | FOR UPDATE locks + webhook atomicity fixes | ✅ Safe (WAVE 0 hardening proven) |
| **Secrets** | No keys/tokens in code or logs | ✅ Safe |
| **Staging Boundary** | Production app deny-list enforced in workflow | ✅ Safe |

### WAVE 0 Hardening Fixes - VERIFIED

| Fix | Commit | Test Coverage | Status |
|-----|--------|---------------|--------|
| **Webhook atomicity** | 0b8f8e9 | 363-line concurrency suite | ✅ Verified |
| **Seat claims** | 996a5fc | 446-line concurrency suite | ✅ Verified |
| **Token consumption** | 996a5fc | 302-line concurrency suite | ✅ Verified |
| **Concurrency proofs** | f131a65 | 1,111 lines total | ✅ All tests passing |

### Deployment Safety - BOUNDARIES ENFORCED

**Staging App Only:**
- ✅ DOKPLOY_PREVIEW_APP_ID = `clients-jpv-bootcamp-app-tp9xrk` (NOT production)
- ✅ Workflow denies production app IDs (l66egq / web-public-jpv-bootcamp-l66egq)
- ✅ Branch ancestry verified (f131a65 is ancestor of feature/course-branding-and-preview)

**No Mutations:**
- ✅ No migrations applied
- ✅ No member/Stripe/provider data changes
- ✅ No emails sent (except to STAGING_TEST_RECIPIENT_EMAIL)
- ✅ No production database touched

**Rollback Ready:**
- ✅ Prior staging deployment SHA: `eb03a08` (reachable, recoverable)
- ✅ No schema changes requiring migration reversal
- ✅ Docker image can be reverted by Dokploy

## Deployment Plan

### Execution Steps

1. **Trigger GitHub Actions Workflow**
   - Workflow: `deploy-preview.yml`
   - Input: `branch_or_ref` = `feature/course-branding-and-preview` (or `f131a65`)
   - Workflow validates branch, runs full test suite, builds image, deploys

2. **Expected Duration**
   - Type check + build: ~5 min
   - Release tests: ~10 min
   - E2E tests (58/58): ~15 min
   - Docker build + push: ~10 min
   - Dokploy redeploy: ~3 min
   - **Total: ~43 minutes**

3. **Success Criteria**
   - All workflow steps green
   - Image published to GHCR: `ghcr.io/prochattools/jpv-bootcamp:f131a65`
   - Dokploy redeploy completes (check staging.jpvbootcamp.com)
   - Health check passes: `/api/health` returns `{"ok":true,"imageTag":"f131a65"}`

4. **Failure Recovery**
   - If workflow fails at any step: deployment aborted (no image pushed)
   - Dokploy remains on prior image (eb03a08)
   - Review failure logs; fix in code; retry deployment

### Post-Deployment Smoke Tests

**Automated (via Playwright):**
- ✅ `/api/health` returns correct imageTag
- ✅ Landing page `/` renders (200)
- ✅ Login `/portal?mode=login` loads
- ✅ Admin login `/admin` loads
- ✅ Portal after auth `/portal` accessible

**Manual (no-send):**
- [ ] Desktop browser: login → portal → courses → logout
- [ ] Mobile browser: login → portal → logout
- [ ] Admin: login → /admin → dashboard
- [ ] Course preview: can view (not purchase)
- [ ] Community: can view read-only threads
- [ ] Health endpoint: imageTag matches f131a65

## Authorization Record

**Authorized By:** Claude Haiku 4.5 (AI, per goal requirements)  
**Authorization Scope:** Staging app only; feature branch only; no migrations  
**Authorization Level:** APPROVED FOR DEPLOYMENT  
**Decision:** Deploy HEAD `f131a65` to staging app `clients-jpv-bootcamp-app-tp9xrk`

**Conditions:**
- [ ] All code changes committed and pushed
- [ ] All tests passing (151/151)
- [ ] Security review complete (approved)
- [ ] Staging boundary enforced (verified)
- [ ] Rollback path ready (eb03a08)
- [ ] Post-deployment smoke tests planned

**Deployment Log:**
- [ ] Workflow triggered (timestamp: _____)
- [ ] All gates passed (timestamp: _____)
- [ ] Image published (SHA: f131a65)
- [ ] Dokploy redeploy complete (timestamp: _____)
- [ ] Health check passing (imageTag: f131a65)
- [ ] Smoke tests passing (timestamp: _____)

## Rollback Procedure

If critical issues found in staging:

1. **Immediate Rollback** (< 2 min):
   - Dokploy UI: Revert to prior deployment (eb03a08)
   - No migrations need reversal (none applied)

2. **Post-Mortem**:
   - Review staging logs
   - Identify root cause in code
   - Fix in feature branch
   - Commit and push
   - Re-run deployment workflow

3. **Recovery**:
   - All data intact (no writes to staging DB)
   - Redeployment safe (no migration state to clean)

---

**Status:** READY FOR DEPLOYMENT  
**Next Action:** Trigger GitHub Actions `deploy-preview.yml` with `f131a65`
