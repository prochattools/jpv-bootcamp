# Dokploy Cron Job Setup — Email Queue Processor

## Purpose
Process pending emails from the queue every 5 minutes so transactional emails (password reset, verification, etc.) are sent automatically.

## EXACT CRON JOB CONFIGURATION

### Copy This Exactly

```cron
*/5 * * * * root curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer YOUR_PAYLOAD_ADMIN_TOKEN" >> /var/log/jpv-email-queue.log 2>&1
```

### Fields Explained

| Field | Value | Meaning |
|-------|-------|---------|
| `*/5` | Every 5 minutes | Run frequently to send emails quickly |
| `* * *` | (Hour Day Month) | Every day, all day |
| `root` | Run as root | User account (in `/etc/cron.d/`) |
| `curl` | HTTP client | Make the request |
| `-s` | Silent | No progress output |
| `-X POST` | HTTP POST | Request method |
| `https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue` | Endpoint URL | Email queue processor |
| `-H "Authorization: Bearer ..."` | Auth header | Replace with your admin token |
| `>> /var/log/jpv-email-queue.log 2>&1` | Log file | Both success and error output |

---

## STEP-BY-STEP SETUP IN DOKPLOY

### Step 1: Get Your Payload Admin Token

Generate or retrieve a Payload admin token. You can find it in:
- Dokploy dashboard → Environment variables
- Or ask Steve for: `PAYLOAD_ADMIN_TOKEN` or similar

**Token placeholder (replace with real value):**
```
YOUR_PAYLOAD_ADMIN_TOKEN
```

### Step 2: SSH into Dokploy Server

```bash
ssh master@68.221.139.108
```

### Step 3: Create Cron File

Open a new cron file (or edit existing one):

```bash
sudo nano /etc/cron.d/jpv-email-queue
```

### Step 4: Paste This Exact Content

```cron
# JPV Bootcamp Email Queue Processor
# Sends pending transactional emails every 5 minutes

*/5 * * * * root curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer YOUR_PAYLOAD_ADMIN_TOKEN" >> /var/log/jpv-email-queue.log 2>&1
```

**Important:** Replace `YOUR_PAYLOAD_ADMIN_TOKEN` with your actual admin token.

### Step 5: Save and Exit

- Press `Ctrl+X`
- Press `Y` (yes)
- Press `Enter` (keep filename)

### Step 6: Verify It Works

```bash
# Check the file was created
cat /etc/cron.d/jpv-email-queue

# Tail the log (should show activity after 5 minutes)
tail -f /var/log/jpv-email-queue.log
```

---

## TESTING THE CRON JOB

### Manual Test (Immediate)

```bash
# Trigger the email queue processor now
curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer YOUR_PAYLOAD_ADMIN_TOKEN" \
  -w "\nHTTP: %{http_code}\n"
```

Expected output:
```
{"ok":true,"processed":0,"sent":0,"failed":0}
HTTP: 200
```

### Check Log File

```bash
# View recent logs
tail -20 /var/log/jpv-email-queue.log

# Watch live (Ctrl+C to exit)
tail -f /var/log/jpv-email-queue.log
```

### Verify Cron is Running

```bash
# Check cron service is active
sudo systemctl status cron

# List system cron jobs
sudo cat /etc/cron.d/jpv-email-queue
```

---

## DOKPLOY INTEGRATION (If Using Dokploy UI)

### Option A: Via Dokploy Dashboard

If Dokploy has a cron job UI:

1. **Name:** `jpv-email-queue`
2. **Schedule:** `*/5 * * * *` (every 5 minutes)
3. **Command:**
```
curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue \
  -H "Authorization: Bearer YOUR_PAYLOAD_ADMIN_TOKEN" \
  >> /var/log/jpv-email-queue.log 2>&1
```
4. **Enabled:** ✅ Yes

### Option B: Via SSH (Above Steps)

Add directly to `/etc/cron.d/jpv-email-queue` — this is system-wide and persistent.

---

## TOKEN VALUE REFERENCE

If you don't have an admin token yet, create one via:

### Via Payload Admin Dashboard

1. Navigate to: `https://preview.jpvbootcamp.com/admin`
2. Login with admin credentials
3. Go to **Payload Users** or **API Keys**
4. Create/retrieve API key with admin scope
5. Copy the token value

### Via Direct Query

```bash
# SSH into Dokploy
ssh master@68.221.139.108

# Query the database for admin user
docker exec -it $(docker ps --filter "name=clients-jpv-bootcamp-app" -q) \
  psql "$DATABASE_URL" -c "
  SELECT id, email FROM jpvbootcamp_staging.payload_users LIMIT 1;
  "
```

---

## TROUBLESHOOTING

### Cron Job Not Running

**Check 1:** Is cron service running?
```bash
sudo systemctl status cron
# If not: sudo systemctl start cron
```

**Check 2:** Is the cron file valid syntax?
```bash
sudo crontab -l -f /etc/cron.d/jpv-email-queue
```

**Check 3:** Check system logs
```bash
sudo tail -20 /var/log/syslog | grep CRON
```

### Token Invalid (401 Error)

**Symptom:** Log shows `HTTP: 401`

**Fix:** 
1. Verify the token is correct
2. Check token hasn't expired
3. Generate a new admin API key

### Log File Not Created

**Issue:** `/var/log/jpv-email-queue.log` doesn't exist

**Fix:** Create it manually
```bash
sudo touch /var/log/jpv-email-queue.log
sudo chmod 644 /var/log/jpv-email-queue.log
```

---

## PRODUCTION MONITORING

### Recommended Alerts

Set up alerts for:

1. **Stuck emails (queued > 1 hour)**
```bash
# SSH and check
docker exec -it $(docker ps --filter "name=clients-jpv-bootcamp-app" -q) \
  psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM jpvbootcamp_staging.payload_email_events
  WHERE delivery_status = 'queued'
  AND created_at < NOW() - INTERVAL '1 hour';
  "
```

2. **High failure rate**
```bash
# Check failed count
docker exec -it $(docker ps --filter "name=clients-jpv-bootcamp-app" -q) \
  psql "$DATABASE_URL" -c "
  SELECT delivery_status, COUNT(*) FROM jpvbootcamp_staging.payload_email_events
  WHERE created_at > NOW() - INTERVAL '1 day'
  GROUP BY delivery_status;
  "
```

3. **Cron not running (no log entries for 15 min)**
```bash
# Check log timestamp
ls -la /var/log/jpv-email-queue.log
```

---

## SUMMARY

**Exact Cron Line:**
```
*/5 * * * * root curl -s -X POST https://preview.jpvbootcamp.com/api/admin/process-payload-email-queue -H "Authorization: Bearer YOUR_PAYLOAD_ADMIN_TOKEN" >> /var/log/jpv-email-queue.log 2>&1
```

**Where:** `/etc/cron.d/jpv-email-queue` on Dokploy server (68.221.139.108)

**What it does:** Processes pending emails every 5 minutes

**Verification:** `tail -f /var/log/jpv-email-queue.log` → should see output every 5 min

**Required:** Replace `YOUR_PAYLOAD_ADMIN_TOKEN` with actual token value
