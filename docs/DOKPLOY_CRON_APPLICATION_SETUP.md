# Dokploy Application Cron Job Setup — Email Queue Processor

## Purpose
Set up a scheduled job in Dokploy to process email queue every 5 minutes.

---

## EXACT DOKPLOY VALUES

### In Dokploy Dashboard

Navigate to your application: **clients-jpv-bootcamp-app-tp9xrk**

#### Step 1: Go to Scheduled Jobs / Cron

In Dokploy:
1. Click: **Applications** → **clients-jpv-bootcamp-app-tp9xrk**
2. Click: **Scheduled Jobs** (or **Cron** section)
3. Click: **Add Scheduled Job** (or **+ New Job**)

#### Step 2: Fill In These Exact Values

| Field | Value |
|-------|-------|
| **Name** | `jpv-email-queue` |
| **Description** | `Process email queue every 5 minutes` |
| **Schedule** | `*/5 * * * *` |
| **Command** | `curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer $EMAIL_QUEUE_WORKER_SECRET" >> /var/log/jpv-email-queue.log 2>&1` |
| **Enabled** | ✅ Yes |

---

## FIELD EXPLANATIONS

### Name
```
jpv-email-queue
```
Identifier for this job in Dokploy.

### Schedule (Cron Expression)
```
*/5 * * * *
```
Meaning: Every 5 minutes

| Field | Value | Meaning |
|-------|-------|---------|
| `*/5` | Every 5 minutes | Run frequently |
| `*` | (Hour) | Every hour |
| `*` | (Day) | Every day |
| `*` | (Month) | Every month |
| `*` | (Day of week) | Every day of week |

### Command (Exact)
```
curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer $EMAIL_QUEUE_WORKER_SECRET" >> /var/log/jpv-email-queue.log 2>&1
```

Breaking it down:

```
curl                                    HTTP client
-s                                      Silent mode
-X POST                                 POST request
https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue
                                        Email queue endpoint (exact URL)
-H "Authorization: Bearer ..."          Auth header
$EMAIL_QUEUE_WORKER_SECRET                Your admin token (replace this)
>> /var/log/jpv-email-queue.log         Log file
2>&1                                    Capture errors too
```

---

## TOKEN VALUE

Replace: **$EMAIL_QUEUE_WORKER_SECRET**

Get from:
1. Your Dokploy environment variables (look for `PAYLOAD_ADMIN_TOKEN`)
2. Or check the application's `.env` in Dokploy
3. Or generate via Payload admin dashboard (/admin)
4. Or ask Steve

Format: `Bearer` followed by 32+ character key

Example (fake): `Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

## COMPLETE EXAMPLE (with fake token)

```
Name: jpv-email-queue
Schedule: */5 * * * *
Command: curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer $EMAIL_QUEUE_WORKER_SECRET" >> /var/log/jpv-email-queue.log 2>&1
Enabled: Yes
```

---

## VERIFICATION IN DOKPLOY

After adding the job:

1. **Check it appears in list:**
   - Applications → clients-jpv-bootcamp-app-tp9xrk → Scheduled Jobs
   - Should show: `jpv-email-queue` | Every 5 minutes | Enabled

2. **Watch logs:**
   - SSH to Dokploy: `ssh master@68.221.139.108`
   - Tail logs: `tail -f /var/log/jpv-email-queue.log`
   - Should see output every 5 minutes

3. **Manual trigger (test immediately):**
   ```bash
   curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
     -H "Authorization: Bearer $EMAIL_QUEUE_WORKER_SECRET" \
     -w "\nHTTP: %{http_code}\n"
   ```
   Expected: `HTTP: 200`

---

## ADVANTAGES OF DOKPLOY SCHEDULING

✅ Managed in application dashboard  
✅ Easy to enable/disable  
✅ No system-level cron files to manage  
✅ Logs visible in Dokploy UI  
✅ Easy to update command if needed  
✅ Application-level scheduling = cleaner

---

## DOKPLOY CONFIGURATION FILE (Alternative)

If Dokploy allows configuration via Docker Compose or config file, add to your service definition:

```yaml
services:
  app:
    image: ghcr.io/prochattools/jpv-bootcamp:latest
    environment:
      # ... existing env vars
      JPV_CRON_ENABLED: "true"
      JPV_CRON_SCHEDULE: "*/5 * * * *"
      JPV_CRON_COMMAND: "curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H 'Authorization: Bearer $EMAIL_QUEUE_WORKER_SECRET'"
```

(Exact format depends on your Dokploy version — check Dokploy docs)

---

## TROUBLESHOOTING

### Job not running?

**Check 1:** Is it enabled in Dokploy?
- Dashboard → Scheduled Jobs → verify toggle is ON

**Check 2:** Is the token valid?
- Manual test: `curl -X POST ... -H "Authorization: Bearer $TOKEN"`
- Should return `HTTP: 200`

**Check 3:** Check Dokploy logs
- `ssh master@68.221.139.108`
- `docker service logs clients-jpv-bootcamp-app-tp9xrk 2>&1 | grep -i cron`

### Token expired?

If you see `HTTP: 401` in logs:
1. Generate new Payload admin token
2. Update in Dokploy UI
3. Save and re-enable job

---

## SUMMARY

**Better way:** Use Dokploy's built-in scheduled jobs UI

**Exact values:**
- **Name:** `jpv-email-queue`
- **Schedule:** `*/5 * * * *`
- **Command:** `curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer $EMAIL_QUEUE_WORKER_SECRET" >> /var/log/jpv-email-queue.log 2>&1`
- **Enabled:** Yes

**Replace:** `$EMAIL_QUEUE_WORKER_SECRET` with your actual token

**Result:** Emails process automatically every 5 minutes, manageable from Dokploy dashboard.
