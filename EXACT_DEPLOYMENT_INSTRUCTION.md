# EXACT DEPLOYMENT INSTRUCTION — JPV Bootcamp Bunny Protocol

**Status**: Ready for operator deployment  
**Date**: 2026-07-19 22:15 UTC  
**Target**: clients-jpv-bootcamp-app-tp9xrk (Dokploy staging application)  

---

## Image to Deploy

**Full Image Reference**:
```
ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd
```

**Image Digest** (for verification):
```
sha256:601ea7d4544850282a27152eeba15ca01f7bc4e1931e2e672d6acd64ff2b8be1
```

**Git SHA** (this image contains):
```
f4c150a (commit: fix(bunny): implement official webhook protocol and token-auth playback)
```

**Image Size**: 1.3 GB  
**Built**: 2026-07-19T22:45:44Z  
**Registry**: ghcr.io (GitHub Container Registry)  

---

## Deployment Options

### Option A: Dokploy API (Recommended if authenticated)

**Prerequisites**:
- Dokploy API key (x-api-key header) with application.deploy permission
- Internal application ID (NOT the display name "clients-jpv-bootcamp-app-tp9xrk")

**Step 1: Discover Application Internal ID**

```bash
DOKPLOY_URL="https://<your-dokploy-instance>"
API_KEY="<your-dokploy-api-key>"

# Get internal ID
curl -s -X POST "${DOKPLOY_URL}/api/trpc/project.all" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" | \
  jq '.result.data[].applications[] | select(.displayName | contains("jpv-bootcamp")) | {displayName, id}'

# Output should include: "id": "some-uuid-or-alphanumeric"
# Store this as: INTERNAL_APP_ID="..."
```

**Step 2: Deploy Exact Image SHA**

```bash
IMAGE_SHA="f4c150aa67b4af702979bf7f84fac4736e987dbd"
IMAGE_DIGEST="sha256:601ea7d4544850282a27152eeba15ca01f7bc4e1931e2e672d6acd64ff2b8be1"
IMAGE_FULL="ghcr.io/prochattools/jpv-bootcamp:${IMAGE_SHA}"

curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.deploy" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"query\": {
      \"id\": \"${INTERNAL_APP_ID}\",
      \"tag\": \"${IMAGE_SHA}\",
      \"service\": \"${IMAGE_FULL}\"
    }
  }" | jq '.'

# Expected response: {"ok": true, ...} or deployment status
# Wait 2-3 minutes for pod to start
```

### Option B: Dokploy UI (Manual)

**Steps**:
1. Log into Dokploy dashboard
2. Navigate: **Projects → jpv-bootcamp → Applications**
3. Click on: **clients-jpv-bootcamp-app-tp9xrk**
4. In deployment section, select image:
   ```
   ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd
   ```
5. Click **Deploy** or **Redeploy**
6. Monitor: Watch for pod startup and health check to pass
7. Logs: Check application logs for startup messages

### Option C: GitHub Workflow (Not Recommended)

The push-triggered deployment is disabled (see `.github/workflows/deploy-preview.yml`).

To re-enable for this one deployment:
1. Uncomment line 14 in `.github/workflows/deploy-preview.yml`
2. Push a dummy commit to trigger CI
3. Restore the disabled state after deployment

**NOT RECOMMENDED** — use Options A or B instead.

---

## Post-Deployment Verification

### Immediate Checks (5 min)

```bash
STAGING_URL="https://preview.jpvbootcamp.com"

# 1. Health check
curl -s "${STAGING_URL}/api/health" | jq .

# Expected: {"ok": true, "status": "live", ...}

# 2. Verify Bunny endpoint exists
curl -s -X GET "${STAGING_URL}/api/bunny/video?lessonId=test" | jq .

# Expected: HTTP 401 (unauthorized, not 404)
# Response should be JSON (not "Route not found")
# Example: {"error": "Unauthorized"}

# 3. Verify endpoint structure
curl -s -X GET "${STAGING_URL}/api/bunny/video?lessonId=test" 2>&1 | head -1

# Should start with { (JSON), not "Not found" or 404
```

### Integration Test (90 min)

Follow `docs/BUNNY_INTEGRATION_TEST_PLAN.md` completely:

1. **Phase 1**: Verify Bunny library configuration (5 min)
2. **Phase 2**: Upload test video (5 min)
3. **Phase 3**: Verify webhook reception & idempotency (10 min)
4. **Phase 4**: Test signed playback token (10 min)
5. **Phase 5**: Test failure scenarios (10 min)
6. **Phase 6**: Browser E2E tests (20 min, optional)

### E2E Test Suite

```bash
BASE_URL=https://preview.jpvbootcamp.com pnpm test:e2e:staging

# Expected: 40/40 PASS
# If fails: Check logs, see BUNNY_INTEGRATION_TEST_PLAN.md debugging section
```

---

## Verification of Exact SHA/Digest

**After deployment**, verify the exact image is running:

```bash
# 1. Get pod info from Dokploy UI or via:
kubectl get pods -n jpv-bootcamp | grep jpvbootcamp-app

# 2. Inspect container image
kubectl describe pod <pod-name> -n jpv-bootcamp | grep Image

# Expected output includes: ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd

# 3. Or verify via container runtime
docker inspect <container-id> | jq '.[0].Config.Image'

# Expected: ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd
```

---

## What This Image Contains

**Code Fixes**:
- ✅ Official Bunny v1 webhook protocol (X-BunnyStream-Signature-Version/Algorithm/Signature headers)
- ✅ Official Bunny token-auth playback format (libraryId:videoId:expiresUnix:hash)
- ✅ Read-Only API key for webhook signature validation
- ✅ Configured CDN hostname instead of hard-coded cdn.bunnycdn.com
- ✅ Idempotent webhook processing (unique constraint on libraryId:videoId)

**Tests Updated**:
- ✅ All webhook signature header validation
- ✅ Wrong version/algorithm rejection
- ✅ Invalid signature detection
- ✅ Duplicate webhook idempotency
- ✅ Missing secret handling

**Build Configuration**:
- ✅ Staging URLs baked in (NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com)
- ✅ All 15 migrations included
- ✅ Node 20, pnpm 10.33.0
- ✅ Next.js standalone mode

---

## Troubleshooting

### Deployment Fails: 401 Unauthorized

**Check**:
1. API key header name: must be exactly `x-api-key` (lowercase)
2. API key format: long alphanumeric string, not truncated
3. Check for whitespace/newlines in key:
   ```bash
   echo "$API_KEY" | od -c | head
   ```
4. Verify key has application.deploy permission
5. Try read-only query first to isolate auth:
   ```bash
   curl -X POST "${DOKPLOY_URL}/api/trpc/project.all" \
     -H "x-api-key: ${API_KEY}" \
     -H "Content-Type: application/json"
   # If this fails with 401, key is invalid
   ```

### Application ID Not Found

**Check**:
1. Use `project.all` to list all applications
2. Find the one with displayName containing "jpv-bootcamp"
3. Copy the internal `id` field (UUID or alphanumeric)
4. Do NOT use the displayName as ID

### Image Not Found / Registry Auth Failed

**Check**:
1. Verify GHCR registry credentials are configured in Dokploy
2. Test pull manually:
   ```bash
   docker pull ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd
   ```
3. If pull fails, configure GHCR auth in Dokploy: Admin → Registries

### Pod Starts but App Unreachable

**Check**:
1. View pod logs in Dokploy or via kubectl
2. Check for startup errors (database, migrations, env vars)
3. Verify environment variables are set:
   - BUNNY_STREAM_WEBHOOK_SECRET
   - BUNNY_STREAM_SIGNING_KEY
   - DATABASE_URL
   - etc.
4. Verify port mapping: 3000 (internal) → 443 (external HTTPS)

---

## Rollback

If deployment is bad:

**Get previous good SHA**:
```bash
git log --oneline -2 | tail -1 | awk '{print $1}'
# Output: e46ee94
```

**Redeploy previous image**:
```bash
curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.redeploy" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": {
      \"id\": \"${INTERNAL_APP_ID}\",
      \"tag\": \"e46ee9484a52e0e5ba5032bd9840fba53f250bac\"
    }
  }"
```

---

## Environment Variables Required

Ensure these are configured in Dokploy **before deployment**:

```bash
# Bunny Stream (server-only, never NEXT_PUBLIC_)
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

# NextAuth (if configured)
NEXTAUTH_URL=https://preview.jpvbootcamp.com
NEXTAUTH_SECRET=<staging-secret>
```

---

## Final Checklist

- [ ] Image SHA: f4c150aa67b4af702979bf7f84fac4736e987dbd
- [ ] Image digest: sha256:601ea7d4544850282a27152eeba15ca01f7bc4e1931e2e672d6acd64ff2b8be1
- [ ] Branch: feature/course-branding-and-preview (staging only)
- [ ] Dokploy target: clients-jpv-bootcamp-app-tp9xrk
- [ ] Environment variables: All set
- [ ] GHCR credentials: Configured
- [ ] Deployment method chosen (API/UI)
- [ ] Health check passes
- [ ] Bunny endpoint reachable (not 404)
- [ ] Integration tests run (90 min)
- [ ] E2E tests pass (40/40)
- [ ] Deployment marked complete in registry

---

**Status**: ✅ READY FOR DEPLOYMENT  
**Image**: ghcr.io/prochattools/jpv-bootcamp:f4c150aa67b4af702979bf7f84fac4736e987dbd  
**SHA**: f4c150aa67b4af702979bf7f84fac4736e987dbd  
**Digest**: sha256:601ea7d4544850282a27152eeba15ca01f7bc4e1931e2e672d6acd64ff2b8be1  
**Next Step**: Operator deploys using Option A (API) or Option B (UI)
