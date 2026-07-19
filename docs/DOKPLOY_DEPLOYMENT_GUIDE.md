# Dokploy Deployment Guide — JPV Bootcamp Staging

**Target**: clients-jpv-bootcamp-app-tp9xrk (staging application)  
**Environment**: Dokploy  
**Deployment type**: Docker image SHA  

---

## Quick Deploy (API-Based)

### Prerequisites

1. **Dokploy API key** (x-api-key header)
   - Scope: application.deploy or application.redeploy
   - Format: Usually a long alphanumeric string

2. **Application ID** (not display name)
   - Display name: "clients-jpv-bootcamp-app-tp9xrk"
   - Internal ID: (discovered via API, not the display name)

### Discovery: Get Internal Application ID

```bash
DOKPLOY_URL="https://dokploy.yourdomain.com"
API_KEY="your-dokploy-api-key"

# Query application by display name
curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.search" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{"query":{"filter":"clients-jpv-bootcamp"}}' | jq '.result.data'

# Alternative: list all applications
curl -s -X POST "${DOKPLOY_URL}/api/trpc/project.all" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" | jq '.result.data[].applications[] | {id, displayName}'

# Store internal ID
INTERNAL_APP_ID="<from response above>"
```

### Deploy Using Internal ID

```bash
# Build image SHA
IMAGE_SHA=$(git rev-parse HEAD)
IMAGE_TAG="ghcr.io/prochattools/jpv-bootcamp:${IMAGE_SHA}"

# Option 1: Deploy with SHA tag
curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.deploy" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"query\": {
      \"id\": \"${INTERNAL_APP_ID}\",
      \"tag\": \"${IMAGE_SHA}\",
      \"service\": \"${IMAGE_TAG}\"
    }
  }" | jq '.result.data'

# Option 2: Deploy with exact digest
curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.redeploy" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "{
    \"query\": {
      \"id\": \"${INTERNAL_APP_ID}\",
      \"digest\": \"sha256:${DOCKER_DIGEST}\"
    }
  }" | jq '.result.data'
```

---

## Manual Deploy (UI-Based)

### Steps

1. **Log into Dokploy**
   - URL: https://dokploy.yourdomain.com
   - Navigate: Projects → jpv-bootcamp → Applications

2. **Locate application**
   - Display name: clients-jpv-bootcamp-app-tp9xrk
   - Note the internal ID from URL or dashboard

3. **Select image and deploy**
   - Image: `ghcr.io/prochattools/jpv-bootcamp:f4c150a` (or exact SHA)
   - Ensure registry authentication is configured (GHCR credentials)
   - Click "Deploy" or "Redeploy"

4. **Monitor deployment**
   - Wait for pod startup (usually ~2-3 min)
   - Verify health check passes
   - Check logs for startup errors

---

## Post-Deployment Verification

### Immediate Checks (5 min)

```bash
STAGING_URL="https://preview.jpvbootcamp.com"

# 1. Health check
curl -s "${STAGING_URL}/api/health" | jq .

# Expected: HTTP 200 + {"status":"ok",...}

# 2. Verify new image is running
curl -s "${STAGING_URL}/api/health" | jq '.deployed_at, .git_sha'

# Should match deployment SHA: f4c150a

# 3. Verify Bunny endpoint exists
curl -s -X GET "${STAGING_URL}/api/bunny/video?lessonId=test" | jq .

# Expected: HTTP 401 (unauthorized) or 400 (missing entitlement)
# NOT: HTTP 404 (route not found)
```

### Full Integration Test (30 min)

See `docs/BUNNY_INTEGRATION_TEST_PLAN.md` for end-to-end testing.

---

## Troubleshooting

### Deployment Fails / 401 Unauthorized

**Cause**: Missing or invalid API key.

**Steps**:
1. Check header name: must be exactly `x-api-key` (lowercase)
2. Verify key is not expired or revoked
3. Check key has application.deploy or application.redeploy permission
4. If using environment variable, check for whitespace/newlines: `echo "$API_KEY" | od -c | head`
5. Try read-only query first: `application.search` with same key to isolate auth issue

**Diagnosis**:
```bash
# Test key with read-only query first
curl -s -X POST "${DOKPLOY_URL}/api/trpc/project.all" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" | jq '.error'

# If 401 here, key is invalid or missing
# If 200 here but deploy fails, check deploy permission specifically
```

### Application ID Not Found

**Cause**: Internal ID format error or application doesn't exist.

**Steps**:
1. Verify application display name: `clients-jpv-bootcamp-app-tp9xrk`
2. Use `project.all` to list all applications and confirm it exists
3. Copy exact internal ID from response, not the display name
4. Ensure ID is UUID or alphanumeric format (not a human-readable name)

### Image Not Found / Registry Auth Error

**Cause**: GHCR registry credentials not configured in Dokploy.

**Steps**:
1. Log into Dokploy UI
2. Navigate: Admin → Registries (or Settings)
3. Add GitHub Container Registry (GHCR)
   - Registry: `ghcr.io`
   - Username: `<github-username>`
   - Password: `<github-token>`
   - Email: `<github-email>`
4. Test: Try pulling image via Dokploy UI
5. Retry deployment

### Deployment Success but App Unreachable

**Cause**: Networking, port binding, or startup error.

**Steps**:
1. Check pod logs in Dokploy UI
   - Should see "Server running on 0.0.0.0:3000"
2. Verify port mapping: 3000 (internal) → 443 (external HTTPS)
3. Check reverse proxy / ingress configuration
4. Verify environment variables (DATABASE_URL, etc.) are set
5. If migrations needed: `pnpm db:migrate:prod` (run in pod or pre-deployment hook)

---

## Rollback

If deployment is bad:

1. **Get previous image SHA**
   ```bash
   git log --oneline -2 | tail -1 | awk '{print $1}'
   ```

2. **Redeploy previous**
   ```bash
   curl -s -X POST "${DOKPLOY_URL}/api/trpc/application.redeploy" \
     -H "x-api-key: ${API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{
       \"query\": {
         \"id\": \"${INTERNAL_APP_ID}\",
         \"tag\": \"${PREVIOUS_SHA}\"
       }
     }"
   ```

3. **Verify**
   ```bash
   curl -s https://preview.jpvbootcamp.com/api/health | jq '.git_sha'
   ```

---

## Environment Variables Reference

**Staging-only Bunny config**:
```
BUNNY_API_KEY=<staging-stream-api-key>
BUNNY_STREAM_LIBRARY_ID=<staging-library-id>
BUNNY_STREAM_HOSTNAME=<staging-cdn-hostname>
BUNNY_STREAM_SIGNING_KEY=<staging-signing-key>
BUNNY_STREAM_WEBHOOK_SECRET=<staging-read-only-api-key>
BUNNY_STREAM_TOKEN_TTL_SECONDS=900
```

**Database**:
```
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/jpvbootcamp_staging
```

**NextAuth (if needed)**:
```
NEXTAUTH_URL=https://preview.jpvbootcamp.com
NEXTAUTH_SECRET=<staging-secret>
```

Ensure all are set in Dokploy environment before deployment.
