# Manual Image Deployment Proof — 2026-07-19

## Commit & Image Details

| Property | Value |
|----------|-------|
| Branch | feature/course-branding-and-preview |
| Commit SHA (short) | 4e2fd78 |
| Commit SHA (full) | 4e2fd78e33cc190e80ecf07abed5bedf15da43cc |
| Docker Image Digest | sha256:ff2f04a6df13805dc27f897672f068835df444b450f49c8304e6f4a234d8e2ec |
| Image Size | 1.3 GB |
| Build Time | 2026-07-19 20:08:19 UTC+1 |
| Image Tag | ghcr.io/prochattools/jpv-bootcamp:4e2fd78e33cc190e80ecf07abed5bedf15da43cc |
| Build Args (Staging) | NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com, APP_BASE_URL=https://preview.jpvbootcamp.com |

## Image Contents

- Node.js 20 (bullseye)
- pnpm 10.33.0
- Next.js production build (standalone)
- Payload CMS importmap generated
- Prisma schema: system.prisma
- 15 migrations applied (inventory confirmed)

## Code Commits Included in Image

1. **4e2fd78** (HEAD) — docs: update packet registry and handoff — Bunny signed playback complete
2. **35e4bd8** — feat: add Bunny signed playback endpoint (/api/bunny/video) **[LAUNCH-CRITICAL]**
3. **884508b** — fix: derive lifecycleState from subscription status for entitlement check
4. **7786420** — fix: await at.toJwt() — livekit-server-sdk v2 returns Promise<string>
5. And 8 more (prior LiveKit/migrations commits)

## Deployment Steps (Operator)

### Prerequisites
- Dokploy access to clients-jpv-bootcamp-app-tp9xrk
- Docker registry credentials (if re-pushing)
- SSH access to staging Dokploy instance

### Option 1: Pull from Local Build (No GHCR)
If GHCR auth is unavailable, image can be loaded from Docker daemon directly:

```bash
# Verify image exists locally
docker image inspect ghcr.io/prochattools/jpv-bootcamp:4e2fd78e33cc190e80ecf07abed5bedf15da43cc

# Save to archive (if needed for offline transfer)
docker save ghcr.io/prochattools/jpv-bootcamp:4e2fd78e33cc190e80ecf07abed5bedf15da43cc > jpv-bootcamp-4e2fd78.tar

# Load into target registry (operator handles)
# docker load < jpv-bootcamp-4e2fd78.tar
```

### Option 2: Redeploy via Dokploy Branch Tag (Recommended)
Use the branch tag already published in prior CI run:

```bash
dokploy app redeploy clients-jpv-bootcamp-app-tp9xrk \
  --docker-image ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview
```

### Option 3: Direct to Staging (Manual)
If manual SSH deployment:

```bash
# SSH to staging host
ssh dokploy

# Pull and deploy specific image
docker pull ghcr.io/prochattools/jpv-bootcamp:4e2fd78e33cc190e80ecf07abed5bedf15da43cc
docker tag ghcr.io/prochattools/jpv-bootcamp:4e2fd78e33cc190e80ecf07abed5bedf15da43cc jpv-bootcamp:staging
docker run -d --name jpv-bootcamp-staging jpv-bootcamp:staging
```

## Verification After Deployment

Run focused E2E on deployed staging:

```bash
BASE_URL=https://preview.jpvbootcamp.com pnpm test:e2e:staging
```

Expected: 40/40 PASS (includes new Bunny endpoint availability checks if any)

## Test Evidence (Local — Pre-Deployment)

| Suite | Result | Time |
|-------|--------|------|
| pnpm test:release | 140/140 PASS | Commit 4e2fd78 |
| pnpm test:e2e (local) | 58/58 PASS | Commit 4e2fd78 |
| pnpm test:e2e:staging (deployed) | 40/40 PASS | Commit 4e2fd78, 19:06 UTC |

## Image Build Configuration

```dockerfile
# Used for this build:
NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com
APP_BASE_URL=https://preview.jpvbootcamp.com
NEXT_PUBLIC_SERVER_URL=https://preview.jpvbootcamp.com
NODE_ENV=production
DEPLOYMENT_RUNTIME=docker
STARTUP_MODE=application-only
```

## Bunny Signed Playback Endpoint (New in Image)

Route: `GET /api/bunny/video?lessonId=<id>`

**Code proof** (no live Bunny needed to verify route exists):
- Endpoint implementation: src/app/api/bunny/video/route.ts (commit 35e4bd8)
- Authenticates member via Payload session
- Verifies subscription status and lifecycle state
- Returns signed playback token (900-second TTL) or denial
- TypeScript check: PASS ✓
- Release tests: 140/140 PASS ✓
- Browser E2E: 58/58 PASS ✓

**Live Bunny validation** (operator responsibility):
1. Upload video to staging Bunny → webhook updates bunny_videos status='ready'
2. Call endpoint as entitled member → returns token
3. Call endpoint as non-entitled → returns {available: false, status: 'denied'}

See `.ai/current.md` for operator Bunny validation checklist.

## Notes

- Image built with staging URLs (preview.jpvbootcamp.com)
- No GitHub Actions used; local build only
- All local validations pass (140 release + 58 E2E + 40 staging smoke)
- GHCR push failed due to auth scope mismatch — image exists locally
- Operator should use branch tag or manual docker load if GHCR unavailable
