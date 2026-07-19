# Dokploy Deployment Guide — JPV Bootcamp Staging

**Target**: clients-jpv-bootcamp-app-tp9xrk  
**Dokploy app ID**: `I_2Vukga3cc3ZhaG-mUzU`  
**Domain**: `preview.jpvbootcamp.com`  
**Dokploy URL**: `https://dokploy.prochat.tools/api`  
**Credentials**: `/Users/Office/.config/dokploy/.env`

---

## Key Facts

- **Two JPV apps exist** in Dokploy. Only `I_2Vukga3cc3ZhaG-mUzU` (appName: `clients-jpv-bootcamp-app-tp9xrk`) serves `preview.jpvbootcamp.com`. The other (`aPR9SvYn_JvGdMTk3CzeI`, appName: `web-public-jpv-bootcamp-l66egq`) is a separate environment.
- **Build platform**: The Dokploy host runs `linux/amd64`. Always build with `--platform linux/amd64` when building locally on Apple Silicon. ARM64 images cause `exec format error` and silent rollback.
- **Deployment method**: Docker Swarm service update via SSH. The Dokploy REST API `application.deploy` updates config but does NOT force image re-pull. Use SSH + `docker service update --with-registry-auth`.

---

## Correct Deployment Procedure

### 1. Build AMD64 image

```bash
HEAD=$(git rev-parse HEAD)
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com \
  --build-arg APP_BASE_URL=https://preview.jpvbootcamp.com \
  --build-arg NEXT_PUBLIC_SERVER_URL=https://preview.jpvbootcamp.com \
  -t "ghcr.io/prochattools/jpv-bootcamp:${HEAD}" \
  -t "ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview" \
  --push \
  .
```

### 2. Verify AMD64 manifest

```bash
docker pull --platform linux/amd64 "ghcr.io/prochattools/jpv-bootcamp:${HEAD}"
docker inspect "ghcr.io/prochattools/jpv-bootcamp:${HEAD}" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d[0]['Architecture'], d[0]['Os'])"
# Expected: amd64 linux
```

### 3. Update Dokploy provider config (REST API)

```bash
source /Users/Office/.config/dokploy/.env
curl -s -X POST "${DOKPLOY_URL}/application.saveDockerProvider" \
  -H "Content-Type: application/json" \
  -H "${DOKPLOY_API_HEADER}: ${DOKPLOY_API_KEY}" \
  -d "{
    \"applicationId\": \"I_2Vukga3cc3ZhaG-mUzU\",
    \"dockerImage\": \"ghcr.io/prochattools/jpv-bootcamp:${HEAD}\",
    \"registryUrl\": \"ghcr.io\",
    \"username\": \"stevewesthoek\",
    \"password\": \"${GHCR_DOKPLOY_PULL_PAT}\"
  }"
```

### 4. Deploy via SSH (required — REST deploy doesn't force pull)

```bash
ssh dokploy \
  "docker service update \
    --image ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview \
    --with-registry-auth \
    clients-jpv-bootcamp-app-tp9xrk"
```

The `--with-registry-auth` flag passes GHCR credentials to the Swarm node.

### 5. Verify deployment

```bash
# Health
curl https://preview.jpvbootcamp.com/api/health
# Expected: {"ok":true,"status":"live",...}  HTTP 200

# Bunny video route — must return 401 (not 404)
curl "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=test"
# Expected: {"error":"Unauthorized"}  HTTP 401

# Webhook route — must return 403 with invalid sig
curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "Content-Type: application/json" \
  -H "x-bunnystream-signature-version: v1" \
  -H "x-bunnystream-signature-algorithm: hmac-sha256" \
  -H "x-bunnystream-signature: invalidsig" \
  -d '{}'
# Expected: {"error":"Signature verification failed"}  HTTP 403
```

---

## REST API Reference (Correct Endpoints)

All endpoints under `https://dokploy.prochat.tools/api/` (NOT `/api/trpc`).

| Operation | Method | Endpoint | Body |
|-----------|--------|----------|------|
| Read app config | GET | `/application.one?applicationId=<id>` | — |
| Update docker provider | POST | `/application.saveDockerProvider` | `{applicationId, dockerImage, registryUrl, username, password}` |
| Trigger deploy (config only) | POST | `/application.deploy` | `{"applicationId":"<id>"}` |
| List deployments | GET | `/deployment.all?applicationId=<id>` | — |
| Reload container | POST | `/application.reload` | `{applicationId, appName, type}` |

---

## Current State (2026-07-20)

- **HEAD**: `0662c9e1bf0448a6bbf563cbf2e92e8977fdb4fe`
- **GHCR digest (AMD64)**: `sha256:ce47b0cbb54dd6d461e7238cf1e72e05d13950837d3ce0895a10dc7182247a71`
- **Running service**: `clients-jpv-bootcamp-app-tp9xrk` (replicated 1/1, healthy)
- **Verified routes**: `/api/bunny/video` → 401, `/api/webhook/bunny` → 403, `/api/health` → 200
