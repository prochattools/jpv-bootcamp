# Email & Notifications System

**Last updated:** 2026-07-29  
**Status:** Operational with async queue

## Architecture Overview

Emails flow through an **asynchronous queue system**:

```
Trigger (password reset, membership, etc.)
    ↓
Payload email event → payload_email_events table (queued)
    ↓
Admin/cron job processes queue
    ↓
Resend API sends to recipient
    ↓
Recipient receives (Gmail, Outlook, Apple Mail, etc.)
```

## Email Templates

All branded templates are stored in `src/components/email/`:

| Template | Trigger | Database Table | Status |
|----------|---------|---|--------|
| member-password-reset | User clicks "Forgot password" | payload_email_events | ✓ Operational |
| member-email-verification | Member signup | payload_email_events | ✓ Operational |
| member-password-changed | After password reset | payload_email_events | ✓ Operational |
| subscription-canceled | Stripe webhook | payload_email_events | ✓ Operational |
| admin-notification | Admin actions | payload_email_events | ✓ Operational |

## Email Configuration

### Environment Variables Required

```bash
RESEND_API_KEY=re_xxxxx                    # Resend API key for sending
RESEND_FROM=enquiries@jpvbootcamp.com      # Sender email address
EMAIL_FROM=enquiries@jpvbootcamp.com       # Fallback sender
SUPPORT_TO_EMAIL=enquiries@jpvbootcamp.com # Support inbox
```

### Payload Email Adapter

Added in `src/payload.config.ts` to configure Payload v3:

```typescript
email: buildPayloadEmailAdapter(),
```

The adapter logs emails to console (in staging) instead of throwing. Real sending happens via:
- Resend client in `src/lib/email.ts`
- Admin email processing routes
- Stripe webhook handlers

## Email Queue Processing

### Manual Queue Processing

Trigger the async queue manually to send pending emails:

```bash
curl -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Automatic Queue Processing (Cron)

**RECOMMENDED:** Set up a cron job to process the queue every 5-10 minutes:

```bash
# Every 5 minutes
*/5 * * * * curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer $PAYLOAD_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' >> /var/log/jpv-email-queue.log 2>&1
```

**Current state:** No cron job configured. Emails queue to DB but are NOT sent until manually triggered.

## Email Verification

### In Database

Query pending/sent emails:

```sql
-- Check queued emails
SELECT id, template_key, to_email, created_at, delivery_status
FROM jpvbootcamp_staging.payload_email_events
WHERE delivery_status = 'queued'
ORDER BY created_at DESC
LIMIT 10;

-- Check recent sends
SELECT id, template_key, to_email, created_at, delivery_status
FROM jpvbootcamp_staging.payload_email_events
ORDER BY created_at DESC
LIMIT 20;
```

### In Admin Dashboard

Navigate to:
- **Admin** → **Email Events** (view queue status)
- **Email Events** → Filter by `template_key` or `to_email`
- Click event to see rendered HTML, metadata, and send status

### Known Issues

**"No email adapter provided" warning (FIXED):**
- Old: Payload v3 didn't have email config → warning on startup
- Fixed: Added `buildPayloadEmailAdapter()` to suppress warning
- Result: Payload emails log instead of warning

**Media file errors (DEFERRED):**
- Uploaded images stored to local `/app/public/media/` (not durable)
- Error: "proof-image-c3a1995.png missing on the disk"
- Solution: Use Bunny CDN or S3 for durable storage (post-core M2)

## Testing Email Workflows

### 1. Trigger Password Reset

```bash
curl -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check DB for event:

```bash
ssh master@100.71.31.88 'psql postgresql://...:jpvbootcamp -c "
SELECT * FROM jpvbootcamp_staging.payload_email_events
WHERE template_key = 'member-password-reset'
ORDER BY created_at DESC LIMIT 1;
"'
```

### 2. Process Queue

```bash
curl -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 3. Verify Delivery

- Check Resend dashboard: https://resend.com/emails
- Check email inbox (Gmail, Outlook, Apple Mail)
- Check DB `delivery_status = 'sent'`

## Troubleshooting

### "Email events in DB but not sent"

**Cause:** No cron job running or manual queue processing not triggered.

**Fix:** Manually trigger queue:

```bash
curl -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer <admin-token>"
```

Or set up cron job (see "Automatic Queue Processing" above).

### "Emails not appearing in user inbox"

**Check 1:** Is event in DB?

```sql
SELECT COUNT(*) FROM jpvbootcamp_staging.payload_email_events;
```

**Check 2:** Is queue processing running?

```sql
SELECT delivery_status, COUNT(*) FROM jpvbootcamp_staging.payload_email_events
GROUP BY delivery_status;
```

**Check 3:** Is Resend API key valid?

```bash
curl -X GET https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Accept: application/json"
```

**Check 4:** Is email address in allowed staging list?

In staging, only addresses in `STAGING_TEST_RECIPIENT_EMAIL` / `STAGING_MEMBER_EMAIL` / `STAGING_ADMIN_EMAIL` can receive.

Check `.env.production`:

```bash
grep STAGING_.*_EMAIL .env.production
```

### "Password reset link expired"

**Issue:** Reset tokens expire after 5 minutes.

**Fix:** Click "Resend" or re-trigger "Forgot password" if timeout occurs.

## Production Readiness

### Before go-live:

- [ ] Cron job configured to process queue every 5-10 minutes
- [ ] Resend API key deployed to production
- [ ] Email templates reviewed by brand/legal
- [ ] Test end-to-end: trigger → queue → send → inbox
- [ ] Verify headers (From, Reply-To, Unsubscribe)
- [ ] Test in Gmail, Outlook, Apple Mail
- [ ] Monitor email events table for stuck items (delivery_status = 'queued' for > 1 hour)

### Monitoring

Set up alerts for:

```sql
-- Stuck emails (queued > 1 hour)
SELECT * FROM jpvbootcamp_staging.payload_email_events
WHERE delivery_status = 'queued'
AND created_at < NOW() - INTERVAL '1 hour';

-- High failure rate
SELECT delivery_status, COUNT(*) as count
FROM jpvbootcamp_staging.payload_email_events
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY delivery_status;
```

## See Also

- `src/lib/email.ts` — Resend client and email helpers
- `src/app/api/admin/process-payload-email-queue/route.ts` — Queue processor
- `src/components/email/` — Email templates
- `.env.production` — Email configuration
