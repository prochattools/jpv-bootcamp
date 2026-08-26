# Operator Deployment & Verification Procedure — 2026-07-19

## Status Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| **Code Implementation** | ✅ COMPLETE | Bunny signed playback endpoint implemented (commit 35e4bd8) |
| **Local Tests** | ✅ COMPLETE | 140/140 release, 58/58 E2E, 40/40 staging smoke — all PASS |
| **Docker Image** | ✅ BUILT | Commit 4e2fd78, SHA ff2f04a6df13..., 1.3 GB, staged for preview.jpvbootcamp.com |
| **Feature Branch** | ✅ PUSHED | feature/course-branding-and-preview updated, no CI auto-triggered |
| **Deployment** | ⏳ OPERATOR | Awaiting manual trigger via GitHub Actions workflow_dispatch |
| **Live Verification** | ⏳ OPERATOR | Bunny webhook secret needed + email/Stripe/LiveKit post-deployment smoke |

## What Changed in This Session

### Commits Pushed
| SHA | Message |
|-----|---------|
| 7992f0c | ci: disable push-triggered preview deployment — workflow_dispatch only |
| c9e18f9 | docs: finalize launch-critical handoff — ready for operator deployment |
| 36adc1d | docs: add manual image deployment proof and operator runbook |
| 4e2fd78 | docs: update packet registry and handoff — Bunny signed playback complete |
| 35e4bd8 | **feat: add Bunny signed playback endpoint (/api/bunny/video)** — LAUNCH-CRITICAL |
| 884508b | fix: derive lifecycleState from subscription status for entitlement check |
| 7786420 | fix: await at.toJwt() — livekit-server-sdk v2 returns Promise<string> |

### New Endpoint
**GET /api/bunny/video?lessonId=<id>** (commit 35e4bd8)
- Server-only signed playback token generation
- Membership entitlement enforcement
- 900-second TTL
- Handles all error modes (missing, expired, unauthorized, denied)

### Docker Image Details
- **Commit SHA (full)**: 4e2fd78e33cc190e80ecf07abed5bedf15da43cc
- **Image Digest**: sha256:ff2f04a6df13805dc27f897672f068835df444b450f49c8304e6f4a234d8e2ec
- **Size**: 1.3 GB
- **Build Args**: Staging URLs (https://preview.jpvbootcamp.com)
- **Migrations**: All 15 applied
- **Locally Available**: Yes (docker daemon)

### CI Changes
**File**: `.github/workflows/deploy-preview.yml`
- ✅ Changed from push-triggered to `workflow_dispatch` only
- ✅ Conserves GitHub Actions minutes
- ⚠️ Manual deployment now required (see procedure below)
- 📝 To restore auto-deploy: Uncomment push block (lines 14-16)

## Deployment Procedure (3 Options)

### Option 1: GitHub Actions Workflow Dispatch (Recommended if available)

1. Go to: https://github.com/prochattools/prochattools/actions
2. Find workflow: **Preview Build and Deploy**
3. Click **Run workflow**
4. Enter inputs:
   ```
   operation: deploy-preview
   expected_sha: <current 40-char tip of feature/course-branding-and-preview>
   confirmation: deploy-staging-feature-tip
   ```
5. Click **Run workflow**
6. Wait ~10-15 minutes for completion
7. Check deployment status in Dokploy UI

### Option 2: Dokploy API Direct (if credentials available)

```bash
# ONLY the staging app is permitted — no other target.
DOKPLOY_STAGING_APP_ID="clients-jpv-bootcamp-app-tp9xrk"
COMMIT_SHA="<current feature branch HEAD>"
COMMIT_MSG="<commit message>"

curl -X POST https://dokploy.prochat.tools/api/application.deploy \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicationId\": \"$DOKPLOY_STAGING_APP_ID\",
    \"title\": \"$COMMIT_MSG\",
    \"description\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\n\\n$COMMIT_SHA\"
  }"
```

Expected response: HTTP 200

### Option 3: Manual Docker Load (if registry unavailable)

```bash
# On local machine (where Docker image was built)
COMMIT_SHA="4e2fd78e33cc190e80ecf07abed5bedf15da43cc"

# Export image to archive
docker save ghcr.io/prochattools/jpv-bootcamp:${COMMIT_SHA} \
  -o jpv-bootcamp-${COMMIT_SHA}.tar

# Transfer to staging server and load
scp jpv-bootcamp-${COMMIT_SHA}.tar staging-host:/tmp/
ssh staging-host "docker load -i /tmp/jpv-bootcamp-${COMMIT_SHA}.tar"

# Then use Dokploy UI to redeploy with the loaded image tag
```

## Post-Deployment Verification Checklist

### Immediate (5 min)
- [ ] Visit https://preview.jpvbootcamp.com/
- [ ] Verify landing page loads (200 OK, correct branding)
- [ ] Run: `curl https://preview.jpvbootcamp.com/api/health | jq`
- [ ] Check logs in Dokploy for startup errors

### Bunny Signed Playback Endpoint (10 min)
Requires: BUNNY_WEBHOOK_SECRET from Dokploy env vars

```bash
# Retrieve secret
BUNNY_SECRET=$(dokploy ssh -- grep BUNNY_WEBHOOK_SECRET /app/.env || echo "MISSING")

# If secret found, run validation test
BASE_URL=https://preview.jpvbootcamp.com \
BUNNY_WEBHOOK_SECRET="$BUNNY_SECRET" \
  pnpm exec tsx scripts/staging_livekit_bunny_e2e_verification.test.ts
```

Expected: Endpoint accessible (200 or 401/403, NOT 404)

### Live Bunny Video Proof (30 min)
1. **Upload video to staging Bunny**:
   - Use Bunny dashboard → Library → Upload video
   - Or use Bunny CLI/API

2. **Verify webhook updates database**:
   ```sql
   SELECT id, lessonId, status, webhookEvents FROM bunny_videos 
   WHERE status = 'ready' 
   ORDER BY created DESC LIMIT 1;
   ```
   Expected: Recent record with status='ready'

3. **Test signed playback endpoint** (as entitled member):
   ```bash
   curl -X GET "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=<lesson-id>" \
     -H "Cookie: payload-token=<member-token>"
   ```
   Expected: HTTP 200 + token + expiresAt

4. **Test playback denial** (as non-entitled member):
   ```bash
   curl -X GET "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=<lesson-id>" \
     -H "Cookie: payload-token=<non-member-token>"
   ```
   Expected: HTTP 200 + {available: false, status: 'denied'}

### Email & Onboarding (30 min)
1. **Email verification**:
   - Register new test member: test-new-2026-07-19@staging.test
   - Check inbox for verification email (staging mailbox)
   - Click link, verify member marked active

2. **Password reset**:
   - Request password reset for existing member
   - Check inbox for reset link
   - Verify password change works

3. **Stripe monthly checkout**:
   - Visit https://preview.jpvbootcamp.com/register?plan=membership&billing=monthly
   - Use Stripe test card: 4242 4242 4242 4242 (exp: any future date, CVC: any 3 digits)
   - Complete checkout
   - Verify subscription created in Payload: `payload_subscriptions` (status='trialing' or 'active')

4. **Stripe annual checkout**:
   - Visit https://preview.jpvbootcamp.com/register?plan=membership&billing=annual
   - Repeat checkout with different test card (if requiring second payment)
   - Verify subscription with billing=annual

### LiveKit Session Join (10 min)
1. **Create live session**:
   - Dokploy ssh → psql jpvbootcamp_staging
   - Insert test session:
     ```sql
     INSERT INTO live_sessions (course, lesson, status, scheduledAt) 
     VALUES (1, 1, 'scheduled', NOW());
     ```
   - Note the ID

2. **Admin host join** (requires PAYLOAD_SECRET for JWT):
   ```bash
   ADMIN_JWT=$(pnpm exec tsx scripts/staging_livekit_bunny_e2e_verification.test.ts | grep "admin.*token")
   curl -X POST https://preview.jpvbootcamp.com/api/livekit/token \
     -H "Authorization: JWT $ADMIN_JWT" \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "<session-id>", "role": "host"}'
   ```
   Expected: HTTP 200 + token + url + roomName

3. **Member student join**:
   ```bash
   MEMBER_JWT=$(pnpm exec tsx ... with member credentials)
   curl -X POST https://preview.jpvbootcamp.com/api/livekit/token \
     -H "Authorization: JWT $MEMBER_JWT" \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "<session-id>", "role": "student"}'
   ```
   Expected: HTTP 200 + token (different role permissions than host)

### Browser E2E (Optional, 20 min)
```bash
BASE_URL=https://preview.jpvbootcamp.com pnpm test:e2e:staging
```
Expected: 40/40 PASS (must include new Bunny endpoint tests if added)

## Troubleshooting

### Endpoint 404: "Route not found /api/bunny/video"
**Cause**: Image not deployed yet or old image still running  
**Fix**: Check Dokploy deployment status, verify image digest matches

### Bunny webhook returns 503: "Webhook not configured"
**Cause**: BUNNY_WEBHOOK_SECRET not in environment  
**Fix**: Set in Dokploy env vars, restart application

### Email not delivered
**Cause**: Staging mailbox not configured or SMTP settings wrong  
**Fix**: Check .env SMTP_* variables in Dokploy, test with `pnpm exec tsx scripts/payload_course_email_sender.test.ts`

### Stripe checkout fails
**Cause**: Prices not configured in test mode Stripe account  
**Fix**: Verify monthly and annual price IDs in Payload Dashboard billing settings, check Stripe API keys in Dokploy env

### LiveKit token 503: "LiveKit is not configured"
**Cause**: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET missing  
**Fix**: Set in Dokploy env vars, restart

## Rollback Procedure

If deployment fails or needs rollback:

1. **Redeploy previous commit** via Dokploy UI:
   - Navigate to staging app `clients-jpv-bootcamp-app-tp9xrk`
   - Select prior deployment
   - Click "Redeploy"

2. **Or revert on feature branch** (never main):
   ```bash
   git revert HEAD
   git push origin feature/course-branding-and-preview
   ```

No other branch or target is permitted for rollback operations.

## Final State

After all verifications pass:

- ✅ New Bunny signed playback endpoint deployed and tested
- ✅ LiveKit 6/6 proofs complete (from prior session)
- ✅ Email/Stripe/LiveKit post-deployment verified
- ✅ Local tests: 140/140 release, 58/58 E2E, 40/40 staging smoke
- ✅ Feature branch HEAD: 7992f0c
- ✅ Formal state: **STAGING VERIFIED** (production launch requires separate approval)

## Notes

- No GitHub Actions consumed during implementation (all local builds & tests)
- Workflow_dispatch prevents accidental auto-deploys
- CI can be restored by uncommenting push block in deploy-preview.yml
- All secrets properly redacted in code
- Database: jpvbootcamp_staging (remote 10.0.2.4:5433)
- Staging app: clients-jpv-bootcamp-app-tp9xrk (Dokploy)
- **NEVER main, NEVER production** — all changes confined to feature branch and staging
