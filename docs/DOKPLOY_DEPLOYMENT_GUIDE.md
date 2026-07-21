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

## ABSOLUTE DENY-LIST

`web-public-jpv-bootcamp-l66egq` is the **production application** and is deny-listed.

No automated, scripted, or manual operation in this repository may:
- Call, query, inspect, or read logs from `web-public-jpv-bootcamp-l66egq`
- Deploy, restart, or reconfigure `web-public-jpv-bootcamp-l66egq`
- Use its webhook, change its env/secrets, or perform any operation against it

The `deploy-preview.yml` and `deploy.yml` workflows both contain runtime guards that
reject `web-public-jpv-bootcamp-l66egq` as an app ID. See `scripts/staging-gates/stagingPolicy.ts`.

**If the production webhook was visible in any screenshot or log, only an authorized
production owner may rotate it. Do not record webhooks, tokens, or secrets in this repo.**

---

## GitHub Secret Naming (Required)

The staging workflow uses **`DOKPLOY_PREVIEW_APP_ID`** (not the generic `DOKPLOY_APP_ID`).
The production workflow uses **`DOKPLOY_PROD_APP_ID`** (not the generic `DOKPLOY_APP_ID`).

Operator action required: rename or add secrets in GitHub repository settings:
1. `DOKPLOY_PREVIEW_APP_ID` → value: `clients-jpv-bootcamp-app-tp9xrk`
2. `DOKPLOY_PROD_APP_ID` → value: the production app ID (authorized production owner only)

The generic `DOKPLOY_APP_ID` secret is no longer used and should be removed to
prevent accidental cross-environment targeting.

---

## GitHub Main Branch Protection (Operator Action Required)

To prevent direct pushes and force-pushes to `main`, a repository owner must:

1. Go to GitHub repository → Settings → Branches → Add branch ruleset
2. Create ruleset for `main`:
   - Require pull request before merging: **enabled**
   - Require status checks to pass: **enabled** (add `validate-and-publish` and TypeScript check)
   - Restrict deletions: **enabled**
   - Block force pushes: **enabled**
   - Restrict creations: **disabled** (allows branch creation)
3. Optionally: require approvals (1 reviewer minimum)

Without this ruleset, direct pushes to `main` are possible and could trigger the
production `deploy.yml` workflow.

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

- **HEAD**: `a77ecc9` (feature/course-branding-and-preview)
- **Deployed image HEAD**: `de1e9c68ba18bc6d1b08894145f69d4ff555c75b`
- **GHCR digest (AMD64)**: `sha256:ce47b0cbb54dd6d461e7238cf1e72e05d13950837d3ce0895a10dc7182247a71`
- **Running service**: `clients-jpv-bootcamp-app-tp9xrk` (replicated 1/1, healthy)
- **Verified routes**: `/api/bunny/video` → 401, `/api/webhook/bunny` → 403, `/api/health` → 200 `{imageTag: "de1e9c68..."}`

## Deployed Proof Results (2026-07-20)

All 7 DEPLOYED PROOF items verified:

1. **Health returns imageTag** ✓ — `{"imageTag":"de1e9c68ba18bc6d1b08894145f69d4ff555c75b"}`
2. **Staging video record created** ✓ — webhook wrote `bunny_videos` row id=4, status=ready
3. **Valid signed webhook received** ✓ — `VideoFinishedProcessing` with HMAC-SHA256 → 200 `{ok:true}`
4. **Ready state persisted** ✓ — DB confirms `status=ready, duration=300`
5. **Duplicate idempotency** ✓ — second identical webhook call → 200 `{ok:true}`
6. **Invalid sig → 403** ✓ | **Unauthenticated video → 401** ✓
7. **40/40 smoke tests** ✓ | **Focused E2E verification** ✓

## Migration Note

`payload_locked_documents_rels` was missing FK columns for new collections added
after initial schema setup. Migration `20260720_000000_locked_docs_rels_new_collections`
adds all missing columns. Apply it before next production deployment.
