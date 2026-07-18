# Staging Deployment Runbook

**Branch:** `feature/course-branding-and-preview`  
**HEAD:** `cc55f7a` (fix: Payload importmap generation for Docker builds)  
**Image Registry:** `ghcr.io/prochattools/jpv-bootcamp`  
**Staging URL:** https://preview.jpvbootcamp.com  
**App:** clients-jpv-bootcamp-app-tp9xrk  
**DB Schema:** jpvbootcamp_staging

## Phase 1: Get Published Image SHA

Wait for GitHub Actions run #176 to complete successfully, then extract the published image:

```bash
# Verify workflow completed
gh run view 176 --json conclusion

# Get the published image SHA tag from workflow logs
gh run view 176 --log | grep "ghcr.io/prochattools/jpv-bootcamp" | grep "sha256"
```

Expected output:
```
ghcr.io/prochattools/jpv-bootcamp:cc55f7a3d... (branch tag)
ghcr.io/prochattools/jpv-bootcamp:< git-sha > (immutable SHA tag)
```

## Phase 2: Back Up Staging Database

```bash
# Connect to staging PostgreSQL
STAGING_DB_HOST=<your-host>
STAGING_DB_NAME=jpvbootcamp_staging
STAGING_DB_USER=<your-user>

# Backup schema before migrations
pg_dump \
  -h $STAGING_DB_HOST \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME \
  --schema-only \
  > jpvbootcamp_staging_schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup full database
pg_dump \
  -h $STAGING_DB_HOST \
  -U $STAGING_DB_USER \
  -d $STAGING_DB_NAME \
  > jpvbootcamp_staging_full_backup_$(date +%Y%m%d_%H%M%S).sql
```

## Phase 3: Apply Payload Migrations to Staging

```bash
# Set staging database URL (must include schema parameter)
export DATABASE_URL="postgresql://<user>:<pass>@<host>:<port>/$STAGING_DB_NAME?schema=jpvbootcamp_staging"

# Check migration status
pnpm payload:staging:migrate --status

# Apply migrations (creates live_sessions and bunny_videos tables)
pnpm payload:staging:migrate

# Verify tables were created
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'jpvbootcamp_staging' 
  AND table_name IN ('live_sessions', 'bunny_videos')
  ORDER BY table_name;
"
```

Expected output:
```
 table_name   
--------------
 bunny_videos
 live_sessions
```

## Phase 4: Verify Migration Schema

```bash
# Verify live_sessions table structure
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "
  \d jpvbootcamp_staging.live_sessions
"

# Verify bunny_videos table structure
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "
  \d jpvbootcamp_staging.bunny_videos
"

# Verify indexes exist
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "
  SELECT schemaname, tablename, indexname 
  FROM pg_indexes 
  WHERE schemaname = 'jpvbootcamp_staging' 
  AND tablename IN ('live_sessions', 'bunny_videos')
  ORDER BY tablename, indexname;
"
```

Expected live_sessions indexes:
- live_sessions_room_name_idx (UNIQUE)
- live_sessions_course_id_idx
- live_sessions_host_user_id_idx
- live_sessions_status_idx
- live_sessions_scheduled_at_idx

Expected bunny_videos indexes:
- bunny_videos_library_video_idx
- bunny_videos_status_idx
- bunny_videos_lesson_id_idx
- bunny_videos_library_video_unique_idx (UNIQUE)

## Phase 5: Deploy Image to Staging App

Using Dokploy API (requires DOKPLOY_API_KEY, DOKPLOY_APP_ID):

```bash
export DOKPLOY_API_KEY="<your-api-key>"
export DOKPLOY_APP_ID="<clients-jpv-bootcamp-app-tp9xrk>"

# Get the published image SHA (from Phase 1)
export IMAGE_SHA="<ghcr.io/prochattools/jpv-bootcamp:SHA>"

# Trigger deployment
curl -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicationId\": \"$DOKPLOY_APP_ID\",
    \"title\": \"Deploy: feature/course-branding-and-preview\",
    \"description\": \"LiveKit & Bunny integration - staging deployment\"
  }"

# Wait for deployment to complete (typically 2-5 minutes)
sleep 180

# Verify deployment
curl -X GET "https://dokploy.prochat.tools/api/application/$DOKPLOY_APP_ID/status" \
  -H "x-api-key: $DOKPLOY_API_KEY"
```

## Phase 6: Verify Deployed Image

```bash
# Check deployed image SHA/digest
curl -s https://preview.jpvbootcamp.com/api/health | jq '.deployed_sha'

# Check pod logs
kubectl logs -n staging -l app=clients-jpv-bootcamp-app-tp9xrk --tail=50

# Verify migrations ran
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME -c "
  SELECT count(*) FROM information_schema.tables 
  WHERE table_schema = 'jpvbootcamp_staging'
  AND table_name IN ('live_sessions', 'bunny_videos');
"
```

## Phase 7: Run Full Staging Test Suite

### 7.1 Auth & Account

```bash
# Payload admin login
curl -X POST https://preview.jpvbootcamp.com/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<test-password>"}'

# Member login/logout
curl -X POST https://preview.jpvbootcamp.com/api/member-login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","password":"<test-password>"}'

# Email verification
curl -X POST https://preview.jpvbootcamp.com/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"<verification-token>"}'
```

### 7.2 Billing & Entitlements

```bash
# Monthly Checkout
curl -X POST https://preview.jpvbootcamp.com/api/checkout/start \
  -H "Content-Type: application/json" \
  -d '{
    "plan":"monthly",
    "amount":2999,
    "returnUrl":"https://preview.jpvbootcamp.com/portal"
  }'

# Stripe test webhook
curl -X POST https://preview.jpvbootcamp.com/api/webhook/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type":"charge.succeeded",
    "data":{"object":{"id":"ch_test_123","amount":2999}}
  }'
```

### 7.3 LiveKit Integration

```bash
# Admin create session
curl -X POST https://preview.jpvbootcamp.com/api/admin/sessions \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test Session",
    "courseId":1,
    "roomName":"test-room-001",
    "hostUserId":1,
    "scheduledAt":"2026-07-20T14:00:00Z",
    "capacity":50
  }'

# Member request token
curl -X POST https://preview.jpvbootcamp.com/api/livekit/token \
  -H "Authorization: Bearer <member-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":1,
    "role":"student"
  }'

# Verify token validity (should have 15-minute expiry)
# Parse JWT and check exp claim
```

### 7.4 Bunny Webhook Integration

```bash
# Simulate Bunny webhook: VideoFinishedProcessing
BUNNY_BODY='{"Type":"VideoFinishedProcessing","VideoLibraryId":12345,"VideoId":67890}'
BUNNY_SIGNATURE=$(echo -n "$BUNNY_BODY" | openssl dgst -sha256 -hmac "<webhook-secret>" -hex | cut -d' ' -f2)

curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "bunny-signature: $BUNNY_SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BUNNY_BODY"

# Verify webhook was persisted (idempotency: same webhook twice should not create duplicates)
curl -X POST https://preview.jpvbootcamp.com/api/webhook/bunny \
  -H "bunny-signature: $BUNNY_SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BUNNY_BODY"
```

### 7.5 Mobile & Accessibility

```bash
# Desktop test (Chrome)
pnpm test:e2e:staging --desktop-only

# Mobile test (Chrome Mobile)
pnpm test:e2e:staging --mobile-only

# Accessibility audit
pnpm test:a11y:staging
```

## Phase 8: Verification Checklist

- [ ] Workflow #176 completed successfully (conclusion: success)
- [ ] Image published to GHCR with branch and SHA tags
- [ ] Database backup created and verified
- [ ] Payload migrations applied to jpvbootcamp_staging
- [ ] live_sessions table exists with all required indexes
- [ ] bunny_videos table exists with all required indexes
- [ ] Image deployed to clients-jpv-bootcamp-app-tp9xrk
- [ ] Deployed SHA matches published image
- [ ] Staging app is responding at https://preview.jpvbootcamp.com
- [ ] Admin login works
- [ ] Member login/logout works
- [ ] Email verification works
- [ ] Monthly/Annual/Voucher checkout flows work
- [ ] Stripe test webhooks processed
- [ ] LiveKit token generation works (15-min TTL verified)
- [ ] Bunny webhook received and persisted
- [ ] Bunny webhook idempotency verified (no duplicates on retry)
- [ ] Mobile tests pass
- [ ] Accessibility tests pass
- [ ] All E2E tests pass (100%)

## Rollback Plan

If any stage fails:

```bash
# Rollback database to backup
psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME < jpvbootcamp_staging_full_backup_*.sql

# Rollback deployment to previous image
curl -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicationId\": \"$DOKPLOY_APP_ID\",
    \"title\": \"Rollback: feature/course-branding-and-preview\"
  }"
```

## Troubleshooting

**Migration fails with "module not found":**
- Ensure pnpm install completed in container
- Check that NODE_ENV=production is set
- Verify Payload config is valid

**LiveKit token generation fails:**
- Check LIVEKIT_URL and LIVEKIT_API_KEY environment variables are set
- Verify session exists in live_sessions table
- Check user entitlements

**Bunny webhook not processing:**
- Verify BUNNY_STREAM_WEBHOOK_SECRET matches webhook configuration
- Check HMAC signature is valid
- Verify raw body is used (not parsed JSON) for signature

**E2E tests timeout:**
- Check staging URL is reachable
- Verify database is connected
- Check if feature is actually deployed (pod logs)
