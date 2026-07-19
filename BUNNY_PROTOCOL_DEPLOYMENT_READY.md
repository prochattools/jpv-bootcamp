# BUNNY PROTOCOL IMPLEMENTATION — DEPLOYMENT READY

**Date**: 2026-07-19 22:45 UTC  
**Status**: ✅ READY FOR STAGING DEPLOYMENT  
**Branch**: feature/course-branding-and-preview  

---

## 🎯 What Changed

### Code Fixes (Commit f4c150a)

**Webhook Protocol** — Now uses official Bunny v1 protocol:
- ✅ Validates all three signature headers: X-BunnyStream-Signature-Version, X-BunnyStream-Signature-Algorithm, X-BunnyStream-Signature
- ✅ Enforces version v1 and algorithm hmac-sha256
- ✅ Uses Read-Only API key (BUNNY_STREAM_WEBHOOK_SECRET) for signature verification
- ✅ Removed legacy BUNNY_WEBHOOK_SECRET fallback
- ✅ Uses configured CDN hostname instead of hard-coded cdn.bunnycdn.com
- ✅ Handles idempotent webhook retries (unique constraint on libraryId:videoId)

**Playback Token** — Now uses official Bunny token-auth format:
- ✅ Token format: `libraryId:videoId:expiresUnixTimestamp:hmacHash`
- ✅ HMAC generated with Signing Key (BUNNY_STREAM_SIGNING_KEY)
- ✅ Expiry is Unix timestamp, not ISO8601
- ✅ Token never expires before 900 seconds in future

**Testing**:
- ✅ Updated webhook tests to validate all three signature headers
- ✅ Added tests for wrong version, wrong algorithm, invalid signature
- ✅ Added test for duplicate webhook idempotency
- ✅ Tests for missing headers, misconfigured secret
- ✅ TypeScript: No errors

---

## 📦 Docker Image

**Built**: 2026-07-19T22:45:44Z  
**SHA Tag**: `f4c150aa67b4af702979bf7f84fac4736e987dbd`  
**Image ID**: `sha256:601ea7d4544850282a27152eeba15ca01f7bc4e1931e2e672d6acd64ff2b8be1`  
**Size**: 1.3 GB  
**Repository**: `ghcr.io/prochattools/jpv-bootcamp`  
**Full Tag**: `ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd`  

**Build Arguments** (staging):
```
NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com
APP_BASE_URL=https://preview.jpvbootcamp.com
NEXT_PUBLIC_SERVER_URL=https://preview.jpvbootcamp.com
```

**Image Includes**:
- ✅ All Bunny protocol fixes (webhook headers, playback token)
- ✅ All prior commits through e3df38b (operator runbook)
- ✅ Documentation: test plan, deployment guide
- ✅ Staging URLs baked into Next.js build
- ✅ All 15 migrations pre-built

---

## 🚀 Deployment Instructions

### Option 1: Dokploy API (Automated)

```bash
DOKPLOY_URL="https://dokploy.yourdomain.com"
API_KEY="<your-dokploy-api-key>"
IMAGE_SHA="f4c150aa67b4af702979bf7f84fac4736e987dbd"

# Step 1: Discover application internal ID
INTERNAL_APP_ID=$(curl -s -X POST "${DOKPLOY_URL}/api/trpc/project.all" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" | \
  jq -r '.result.data[].applications[] | select(.displayName | contains("jpv-bootcamp")) | .id' | head -1)

echo "Application ID: $INTERNAL_APP_ID"

# Step 2: Deploy
curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.deploy" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"query\": {
      \"id\": \"${INTERNAL_APP_ID}\",
      \"tag\": \"${IMAGE_SHA}\",
      \"service\": \"ghcr.io/prochattools/jpv-bootcamp:${IMAGE_SHA}\"
    }
  }" | jq '.'

# Step 3: Verify
sleep 10
curl -s https://preview.jpvbootcamp.com/api/health | jq '.git_sha, .deployed_at'
```

### Option 2: Dokploy UI (Manual)

1. Log into Dokploy dashboard
2. Navigate: Projects → jpv-bootcamp → Applications → clients-jpv-bootcamp-app-tp9xrk
3. Select image: `ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd`
4. Click **Deploy** or **Redeploy**
5. Wait for pod startup (~2-3 min)
6. Monitor health check and logs

See `docs/DOKPLOY_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

## ✅ Post-Deployment Verification

### Immediate (5 min)

```bash
# 1. Health check
curl -s https://preview.jpvbootcamp.com/api/health | jq .

# Expected: HTTP 200, status: ok, git_sha: f4c150a...

# 2. Bunny endpoint reachability
curl -s -X GET "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=test" | jq .

# Expected: HTTP 401 (auth required), NOT 404 (route not found)

# 3. Webhook health
curl -s https://preview.jpvbootcamp.com/api/health | jq '.webhook_configured'

# Expected: true (if Bunny URL is configured)
```

### Integration Test (30 min)

Follow `docs/BUNNY_INTEGRATION_TEST_PLAN.md`:

1. **Phase 1**: Verify Bunny library configuration (5 min)
2. **Phase 2**: Upload test video (5 min)
3. **Phase 3**: Verify webhook reception & idempotency (10 min)
4. **Phase 4**: Test signed playback token (10 min)
5. **Phase 5**: Test failure scenarios (10 min)
6. **Phase 6**: Browser E2E tests (20 min, optional)

---

## 🔐 Environment Variables (Staging)

Ensure these are configured in Dokploy before deployment:

```
# Bunny Stream Configuration
BUNNY_API_KEY=<staging-stream-api-key>
BUNNY_STREAM_LIBRARY_ID=<staging-library-id>
BUNNY_STREAM_HOSTNAME=<staging-cdn-hostname>
BUNNY_STREAM_SIGNING_KEY=<staging-signing-key>
BUNNY_STREAM_WEBHOOK_SECRET=<staging-read-only-api-key>
BUNNY_STREAM_TOKEN_TTL_SECONDS=900

# Database
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/jpvbootcamp_staging

# Application
NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com
NEXT_PUBLIC_SERVER_URL=https://preview.jpvbootcamp.com
APP_BASE_URL=https://preview.jpvbootcamp.com
NODE_ENV=production

# NextAuth / Auth (if configured)
NEXTAUTH_URL=https://preview.jpvbootcamp.com
NEXTAUTH_SECRET=<staging-secret>
```

---

## 📋 Git State

**Branch**: `feature/course-branding-and-preview`  
**HEAD**: `bf3610b` (docs: add test plan and deployment guide)  
**Parent commits**:
- `f4c150a` ← Bunny protocol fixes
- `e46ee94` ← Final deployment-ready report
- `e3df38b` ← Operator deployment runbook
- `7992f0c` ← CI optimization (disable push trigger)

**Protected**:
- ✅ .ai/current.md (session notes)
- ✅ playwright-report-staging/
- ✅ docs/client/* (PowerPoint deck, fixtures)

**Branch status**:
- ✅ All commits pushed to origin
- ✅ No uncommitted changes
- ✅ CI workflow disabled for push (workflow_dispatch only)
- ✅ NEVER touched main

---

## 🧪 What Still Needs Testing

After deployment:

1. **Real Bunny video upload** → webhook received
2. **Idempotent webhook** → duplicate events handled
3. **Signed playback token** → correct format and expiry
4. **Entitlement checking** → denied for non-members
5. **Error scenarios** → correct HTTP status codes
6. **Browser E2E** → 40 tests passing

See `docs/BUNNY_INTEGRATION_TEST_PLAN.md` for full checklist.

---

## 🔄 Rollback

If critical issues occur post-deployment:

```bash
# 1. Identify previous good image
git log --oneline -2 | tail -1 | awk '{print $1}'
# Expected: e46ee94

# 2. Redeploy previous
curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.redeploy" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": {
      \"id\": \"${INTERNAL_APP_ID}\",
      \"tag\": \"e46ee9484a52e0e5ba5032bd9840fba53f250bac\"
    }
  }"

# 3. Verify
curl -s https://preview.jpvbootcamp.com/api/health | jq '.git_sha'
```

---

## 📊 Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Code Fixes** | ✅ COMPLETE | Official Bunny v1 protocol, token-auth playback |
| **Tests** | ✅ UPDATED | All webhook and playback tests updated |
| **TypeScript** | ✅ CLEAN | No compilation errors |
| **Docker Image** | ✅ BUILT | f4c150a, 1.3GB, staging URLs baked in |
| **Documentation** | ✅ COMPLETE | Test plan, deployment guide, troubleshooting |
| **Branch State** | ✅ CLEAN | All changes committed and pushed |
| **Deployment** | 🟡 PENDING | Awaiting operator to deploy image |
| **Live Verification** | 🟡 PENDING | Awaiting post-deployment testing |

---

## 🎯 Next Steps (Operator)

1. **Deploy image** using Dokploy API or UI (see above)
2. **Verify health** at https://preview.jpvbootcamp.com/api/health
3. **Run integration test** following `docs/BUNNY_INTEGRATION_TEST_PLAN.md`
4. **Test real Bunny flow**: upload video → webhook → signed playback
5. **Run E2E tests**: `BASE_URL=https://preview.jpvbootcamp.com pnpm test:e2e:staging`
6. **Update status**: Mark deployment complete in registry and roadmap

---

**Image Ready**: ✅ ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd  
**Documentation**: ✅ Complete (test plan, deployment guide, troubleshooting)  
**Branch**: ✅ feature/course-branding-and-preview (NEVER main)  
**Status**: 🟢 **READY FOR DEPLOYMENT**
