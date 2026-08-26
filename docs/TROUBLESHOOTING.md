# Troubleshooting Guide

**Last updated:** 2026-07-29

## Common Issues & Solutions

### 1. "No email adapter provided" Warning

**Symptom:** Logs show: `WARN: No email adapter provided. Email will be written to console.`

**Root cause:** Payload v3 requires explicit email configuration.

**Solution:** ✓ FIXED in commit with email adapter. No action needed.

**Status:** Resolved as of 2026-07-29.

---

### 2. Media Upload Fails or Files Missing

**Symptom:** 
- Upload form accepts file but then errors
- Error: `File proof-image-c3a1995.png for collection payload_media is missing on the disk`
- Expected path: `/app/public/media/proof-image-c3a1995.png`

**Root cause:** Media stored to local disk in Docker container (not durable). Files lost on container restart or volume unmount.

**Current configuration:**
- `PAYLOAD_MEDIA_STORAGE_MODE` not set (defaults to `local`)
- No S3 or Bunny CDN configured
- Files stored at `/app/public/media/`

**Solutions:**

**Option A: Local uploads (development only)**
- Recreate the file manually
- Upload again
- ⚠️ File will be lost on next container restart

**Option B: Configure S3 (recommended for staging)**
- Set environment variables:
  ```bash
  PAYLOAD_MEDIA_STORAGE_MODE=s3
  PAYLOAD_MEDIA_S3_BUCKET=your-bucket
  PAYLOAD_MEDIA_S3_REGION=us-east-1
  PAYLOAD_MEDIA_S3_ACCESS_KEY_ID=xxx
  PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY=xxx
  ```
- Redeploy
- Re-upload media

**Option C: Use Bunny CDN (already configured for video)**
- Bunny Stream is configured for protected video playback through the Bunny service layer.
- The canonical entitled-member community attachment route is `src/app/api/community/files/route.ts`; it validates the member's space access, writes private media, creates the Payload media/file records, and leaves the attachment pending moderation review.
- Live provider/storage round-trip verification remains an operator gate; do not treat a local route test as live Bunny evidence.

**Status:** The current attachment path is implemented and locally covered. Further Bunny/storage hardening is a separate operational/provider gate, not a reason to retain the removed placeholder upload route.

---

### 3. Password Reset or Other Forms Not Working

**Symptom:** User attempts password reset, form submitted, but no email received or redirect fails.

**Diagnosis Steps:**

**Step 1:** Verify endpoint responds

```bash
curl -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -w "\nHTTP:%{http_code}\n"
```

Expected: `HTTP:200` + `{"ok":true,"message":"If an eligible account exists..."}`

**Step 2:** Check if event was queued to DB

```bash
ssh master@100.71.31.88 'psql postgresql://supabase_admin:...@10.0.2.4:5433/jpvbootcamp -c "
SELECT id, to_email, template_key, created_at FROM jpvbootcamp_staging.payload_email_events
WHERE template_key = 'member-password-reset'
ORDER BY created_at DESC LIMIT 5;
"'
```

**Step 3:** Check if queue was processed

Same query but check `delivery_status` column:
- `queued` = waiting to be sent
- `sent` = processed by Resend
- `failed` = Resend error

**Step 4:** Manually trigger queue

```bash
curl -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w "\nHTTP:%{http_code}\n"
```

**Common causes:**
- ❌ No cron job running (queue stays `queued`)
- ❌ Resend API key invalid or missing (status = `failed`)
- ❌ Email address not in staging whitelist (dropped silently)
- ❌ Database connection down (event not saved)

**Status:** ✓ Working. Issue likely in queue processing cron (missing).

---

### 4. Database Connection Timeout

**Symptom:** 
- Pages load but show "timeout" error
- Logs: `Error: connect ETIMEDOUT` after exactly 10 seconds
- Both Payload and Prisma fail to connect

**Root cause (resolved 2026-07-29):** Tailscale daemon lost auth token after auto-update.

**Solution (already applied):**
- ✓ Re-authenticated Tailscale node
- ✓ Disabled auto-update: `tailscale set --auto-update=false`
- ✓ pg-pool keepalive added (60s delay, 600s idle timeout)

**If this recurs:**

```bash
# Check Tailscale status on Dokploy
ssh master@68.221.139.108 'tailscale status | grep supabase'
# Should show: supabase ... active

# If not active, re-authenticate
ssh master@68.221.139.108 'tailscale up'
# Visit the login URL in the output

# Verify 10.0.2.4:5433 is reachable
ssh master@68.221.139.108 'nc -zv 10.0.2.4 5433 -w 5'
# Expected: Connection ... succeeded
```

**Status:** ✓ Resolved. Prevention: auto-update disabled.

---

### 5. Staging Tests Fail on Specific Viewports

**Symptom:** 
- E2E tests pass on desktop but fail on mobile/tablet
- Error: "element hidden" or "locator not found"

**Root cause:** Mobile hamburger menu hides navigation links.

**Solution:** ✓ FIXED in commit. Tests now use `:visible` selector to skip hidden elements.

**Status:** Resolved as of 2026-07-29. All 84/84 tests passing.

---

## Operational Runbooks

### Daily Checks

```bash
# 1. Is the app healthy?
curl -s https://preview.jpvbootcamp.com/api/health | jq .

# 2. Is the database connected?
curl -s https://preview.jpvbootcamp.com/admin && echo "DB OK" || echo "DB DOWN"

# 3. Are emails queuing?
ssh master@100.71.31.88 'psql postgresql://...:jpvbootcamp -c "
SELECT COUNT(*) as total_events FROM jpvbootcamp_staging.payload_email_events;
"'

# 4. Is Tailscale up?
ssh master@68.221.139.108 'tailscale status | grep -E "supabase|active"'
```

### Weekly Email Queue Verification

```bash
# Process pending emails
curl -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check for stuck items (> 1 hour queued)
ssh master@100.71.31.88 'psql postgresql://...:jpvbootcamp -c "
SELECT id, to_email, template_key, created_at
FROM jpvbootcamp_staging.payload_email_events
WHERE delivery_status = 'queued'
AND created_at < NOW() - INTERVAL '1 hour'
LIMIT 10;
"'
```

### Emergency: Hard Reset Email Queue

**⚠️ Use only if queue is stuck.**

```bash
# Mark all queued items as failed (do NOT delete)
ssh master@100.71.31.88 'psql postgresql://...:jpvbootcamp -c "
UPDATE jpvbootcamp_staging.payload_email_events
SET delivery_status = '\''failed'\'', updated_at = NOW()
WHERE delivery_status = '\''queued'\''
AND created_at < NOW() - INTERVAL '\'\'1 hour'\'';
"'

# Re-process those items later or manually notify users
```

---

## Known Limitations & Deferred Work

| Issue | Severity | Status | Plan |
|-------|----------|--------|------|
| Media files not durable (local disk) | IMPORTANT | ⏳ Deferred | Switch to S3/Bunny in M2 |
| No cron job for email queue | IMPORTANT | ⏳ Deferred | Scheduled task in M2 |
| Email templates not tested in all clients | POLISH | ⏳ Deferred | Add email rendering tests in M2 |
| Taiiledcale auto-update can break Tailscale | IMPORTANT | ✓ Fixed | Disabled; monitoring in place |

---

## Contact & Escalation

For issues not covered above:

1. **Check logs:** SSH to Dokploy and review `docker service logs`
2. **Check database:** Run queries against `jpvbootcamp_staging` schema
3. **Check Resend:** https://resend.com/emails for send failures
4. **Check infrastructure:** `docs/INFRASTRUCTURE_NETWORKING.md` for Tailscale/firewall setup
