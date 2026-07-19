# Bunny Integration Test Plan — JPV Bootcamp Staging

**Goal**: Verify end-to-end Bunny Stream integration with real video, webhook, and signed playback.

**Environment**: https://preview.jpvbootcamp.com (staging)  
**Database**: jpvbootcamp_staging (PostgreSQL)  
**Date**: 2026-07-19

---

## Prerequisites

1. **Bunny Stream staging library** already configured
   - Library ID: (from env BUNNY_STREAM_LIBRARY_ID)
   - Stream API Key: (from env BUNNY_API_KEY)
   - Webhook Read-Only API Key: (from env BUNNY_STREAM_WEBHOOK_SECRET)
   - Signing Key for playback: (from env BUNNY_STREAM_SIGNING_KEY)
   - CDN hostname: (from env BUNNY_STREAM_HOSTNAME)

2. **Staging app deployed** with new Bunny protocol fixes:
   - Webhook: POST /api/webhook/bunny (accepts X-BunnyStream-Signature-Version, X-BunnyStream-Signature-Algorithm, X-BunnyStream-Signature)
   - Playback: GET /api/bunny/video?lessonId=<id> (returns signed token in official format)

3. **Database tables** created:
   - bunny_videos (schema: libraryId, videoId, lessonId, status, webhookEvents, etc.)
   - lessons (with videoId foreign key)
   - members (with subscription)

4. **Test credentials**:
   - Admin API token for Payload CMS
   - Member account with active subscription
   - Test API key for Dokploy (if using API deploy)

---

## Test Sequence

### Phase 1: Verify Library Configuration (5 min)

**Objective**: Confirm Bunny library is reachable and webhook URL is set.

```bash
# 1. Test Bunny Stream API access
BUNNY_API_URL="https://api.bunnycdn.com/videolibrary/${BUNNY_STREAM_LIBRARY_ID}"

curl -s -X GET "$BUNNY_API_URL" \
  -H "Authorization: Bearer ${BUNNY_API_KEY}" | jq '.Name, .Id'

# Expected: {"Name": "jpvbootcamp-staging", "Id": 12345}

# 2. Verify webhook URL is configured
curl -s -X GET "$BUNNY_API_URL" \
  -H "Authorization: Bearer ${BUNNY_API_KEY}" | jq '.WebhookUrl'

# Expected: "https://preview.jpvbootcamp.com/api/webhook/bunny"
```

### Phase 2: Upload Test Video (5 min)

**Objective**: Create a video in Bunny and trigger initial webhook.

```bash
# 1. Create video record in bunny_videos (pending)
# Using Payload API or direct SQL:

INSERT INTO bunny_videos (
  title, library_id, video_id, lesson_id, status, created_at, updated_at
) VALUES (
  'Test Video 1', 
  ${BUNNY_STREAM_LIBRARY_ID}, 
  9999,  -- placeholder, will be updated by webhook
  'lesson-abc123', 
  'processing',
  now(), now()
);

# 2. Upload test video via Bunny dashboard or API
# (Manual step; alternative: use Bunny API upload or test-mode video creation)

# 3. Bunny will process and send webhook when ready
# Monitor logs: tail -f logs/webhook.log (watch for "Updated bunny_videos")
```

### Phase 3: Verify Webhook Reception & Storage (10 min)

**Objective**: Confirm webhook was received, validated, and video marked as ready.

```bash
# 1. Query database for video status
psql postgresql://... jpvbootcamp_staging <<EOF
SELECT 
  id, 
  title, 
  library_id, 
  video_id, 
  lesson_id, 
  status, 
  thumbnail_url, 
  webhook_events,
  updated_at
FROM bunny_videos 
WHERE lesson_id = 'lesson-abc123'
ORDER BY updated_at DESC 
LIMIT 1;
EOF

# Expected: status = 'ready', webhook_events contains VideoFinishedProcessing event

# 2. Verify webhook event log structure
# webhook_events should be JSONB array like:
# [
#   {
#     "type": "VideoFinishedProcessing",
#     "timestamp": "2026-07-19T...",
#     "status": "ready"
#   }
# ]

# 3. Test idempotency: resend webhook manually (using production Bunny webhook header format)
WEBHOOK_PAYLOAD=$(cat <<'PAYLOAD'
{
  "Type": "VideoFinishedProcessing",
  "VideoLibraryId": ${BUNNY_STREAM_LIBRARY_ID},
  "VideoId": 9999,
  "VideoTitle": "Test Video 1",
  "Duration": 300,
  "VideoCodec": "h264"
}
PAYLOAD
)

WEBHOOK_SIG=$(echo -n "$WEBHOOK_PAYLOAD" | openssl dgst -sha256 -hmac "${BUNNY_STREAM_WEBHOOK_SECRET}" | cut -d' ' -f2)

curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "Content-Type: application/json" \
  -H "X-BunnyStream-Signature-Version: v1" \
  -H "X-BunnyStream-Signature-Algorithm: hmac-sha256" \
  -H "X-BunnyStream-Signature: $WEBHOOK_SIG" \
  -d "$WEBHOOK_PAYLOAD"

# Expected: HTTP 200 + {"ok": true}
# Database should NOT have duplicate webhook event (idempotent)
```

### Phase 4: Test Signed Playback Token Generation (10 min)

**Objective**: Request and validate signed playback token for entitled member.

```bash
# 1. Get member auth token
# (Using Payload login or test credential)
MEMBER_TOKEN=$(curl -X POST https://preview.jpvbootcamp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@test.local","password":"testpass"}' \
  | jq -r '.token')

# 2. Request playback token
curl -s -X GET "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=lesson-abc123" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq .

# Expected response (if entitled):
# {
#   "available": true,
#   "provider": "bunny_stream",
#   "status": "ready",
#   "lessonId": "lesson-abc123",
#   "videoId": "9999",
#   "libraryId": "${BUNNY_STREAM_LIBRARY_ID}",
#   "playbackAssetId": "9999",
#   "thumbnailUrl": "https://${BUNNY_STREAM_HOSTNAME}/video/${BUNNY_STREAM_LIBRARY_ID}/9999/thumbnail.jpg",
#   "expiresAt": "2026-07-19T14:15:00.000Z",  (900s from now)
#   "token": "12345:9999:1753019700:abc123def456..."  (libraryId:videoId:expiresUnix:hmacHash)
# }

# 3. Validate token structure
# - Token format: libraryId:videoId:expiresUnix:hmacHash
# - Expiry is ~900 seconds in future
# - hmacHash is lowercase hex, 64 chars (SHA256)

# 4. Test playback denial for non-entitled member
# (Create member without subscription or with expired subscription)
DENIED_TOKEN=$(curl -X POST https://preview.jpvbootcamp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"denied@test.local","password":"testpass"}' \
  | jq -r '.token')

curl -s -X GET "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=lesson-abc123" \
  -H "Authorization: Bearer $DENIED_TOKEN" | jq .

# Expected response (if not entitled):
# {
#   "available": false,
#   "provider": "bunny_stream",
#   "status": "denied",
#   "lessonId": "lesson-abc123",
#   "diagnostics": {"entitlementReason": "..."}
# }
```

### Phase 5: Test Failure Scenarios (10 min)

**Objective**: Verify error handling for edge cases.

```bash
# 1. Test webhook with missing signature headers
curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "Content-Type: application/json" \
  -d '{"Type":"VideoFinishedProcessing"}'

# Expected: HTTP 403 + {"error": "Missing signature headers"}

# 2. Test webhook with wrong version
WEBHOOK_SIG=$(echo -n '{}' | openssl dgst -sha256 -hmac "${BUNNY_STREAM_WEBHOOK_SECRET}" | cut -d' ' -f2)

curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "Content-Type: application/json" \
  -H "X-BunnyStream-Signature-Version: v2" \
  -H "X-BunnyStream-Signature-Algorithm: hmac-sha256" \
  -H "X-BunnyStream-Signature: $WEBHOOK_SIG" \
  -d '{}'

# Expected: HTTP 403 + {"error": "Unsupported signature version"}

# 3. Test webhook with wrong algorithm
curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "Content-Type: application/json" \
  -H "X-BunnyStream-Signature-Version: v1" \
  -H "X-BunnyStream-Signature-Algorithm: hmac-sha512" \
  -H "X-BunnyStream-Signature: $WEBHOOK_SIG" \
  -d '{}'

# Expected: HTTP 403 + {"error": "Unsupported signature algorithm"}

# 4. Test webhook with invalid signature
curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "Content-Type: application/json" \
  -H "X-BunnyStream-Signature-Version: v1" \
  -H "X-BunnyStream-Signature-Algorithm: hmac-sha256" \
  -H "X-BunnyStream-Signature: invalidsignature" \
  -d '{"Type":"VideoFinishedProcessing"}'

# Expected: HTTP 403 + {"error": "Signature verification failed"}

# 5. Test playback for non-existent lesson
curl -s -X GET "https://preview.jpvbootcamp.com/api/bunny/video?lessonId=nonexistent" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq .

# Expected:
# {
#   "available": false,
#   "provider": "bunny_stream",
#   "status": "missing",
#   "lessonId": "nonexistent"
# }
```

### Phase 6: Browser E2E Test (20 min)

**Objective**: Verify full user flow in browser (optional, if UI is ready).

```bash
BASE_URL=https://preview.jpvbootcamp.com pnpm test:e2e:staging

# Expected: 40/40 tests PASS
# Including: video playback, entitlement checks, error states
```

---

## Success Criteria

✅ **All tests pass**:
- [ ] Bunny library reachable and webhook URL configured
- [ ] Test video uploaded and webhook received
- [ ] Webhook signature validated (X-BunnyStream-Signature-Version/Algorithm/Signature)
- [ ] Video status updated to 'ready' in database
- [ ] Webhook is idempotent (no duplicate events on retry)
- [ ] Signed playback token generated in official format (libraryId:videoId:expiresUnix:hmacHash)
- [ ] Expiry is ~900 seconds in future
- [ ] Playback denied for non-entitled members
- [ ] All error scenarios handled correctly (403 for invalid signature, etc.)
- [ ] Browser E2E tests pass (40/40)

---

## Rollback Plan

If critical failures occur:

1. **Revert commit**: `git revert f4c150a` (Bunny protocol fixes)
2. **Rebuild image**: `docker build --no-cache -t ghcr.io/prochattools/jpv-bootcamp:$(git rev-parse HEAD) .`
3. **Redeploy old image**: `pnpm db:migrate:prod` + restart app
4. **Verify**: `curl https://preview.jpvbootcamp.com/api/health | jq`

---

## Debugging Notes

**Webhook not received**:
- Check Bunny dashboard: Integrations → Webhook → verify URL and last delivery status
- Check staging app logs: `docker logs jpvbootcamp-app-staging | grep webhook`
- Verify secret: `echo $BUNNY_STREAM_WEBHOOK_SECRET` (should be read-only key, not Stream API key)

**Signature verification failed**:
- Ensure raw body is used (not parsed JSON)
- Use lowercase hex for comparison
- Verify Read-Only API key is used, not Stream API key
- Check header names are exactly: X-BunnyStream-Signature-Version, X-BunnyStream-Signature-Algorithm, X-BunnyStream-Signature

**Playback token invalid**:
- Verify format: libraryId:videoId:expiresUnix:hmacHash
- Confirm HMAC is generated with Signing Key (BUNNY_STREAM_SIGNING_KEY)
- Check expiry is Unix timestamp (not ISO8601)
- Verify expiresAt is future-dated

---

## Post-Test Documentation

After all tests pass, update:
1. `.ai/current.md` — session summary
2. `docs/TWO_DAY_PACKET_REGISTRY.json` — mark phase complete
3. `DEPLOYMENT_READY_FINAL_REPORT.md` — add verification proof
