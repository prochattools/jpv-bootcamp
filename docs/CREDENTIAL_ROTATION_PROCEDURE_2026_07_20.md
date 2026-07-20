# Credential Rotation Procedure — Staging Test Member — 2026-07-20

**Status**: ⚠️ **NOT EXECUTED** (requires interactive staging mailbox access and live app)  
**Reason**: Rotation requires real-time email receipt (step 2 below), which is not available in automated/sandbox context  
**Operator Action Required**: Execute this procedure immediately before beginning D/E verification testing

---

## Credential Status

| Item | Value | Risk | Exposure |
|------|-------|------|----------|
| **Test Member** | `[member-test-01]` | MEDIUM | Git history commits a6c4660..5d01aae (private feature branch) |
| **Exposed Password** | `[REDACTED-password]` | MEDIUM | Same commits |
| **Current Status** | **ACTIVE in staging database** | ⚠️ | Accessible via valid credentials |
| **Mitigation** | Rotate password immediately | — | New password invalidates old; sessions cleared |

---

## Step-by-Step Rotation Procedure

### Phase 1: Request Password Reset

**Time**: 30 seconds

**Action**: Call the password reset request endpoint

```bash
curl -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"[member-test-01]"}'
```

**Expected Response**:
```json
{
  "ok": true,
  "message": "If an eligible account exists, a password reset email will be sent shortly."
}
```

**What happens**: The staging app queues a reset email via Resend to the test member's inbox.

**Verify**: Check the database to confirm email event was created:
```sql
SELECT * FROM jpvbootcamp_staging.payload_email_events 
WHERE template = 'member-password-reset' 
ORDER BY created_at DESC 
LIMIT 1;
```

Expected: One row with `delivery_status: 'queued'` and `metadata` containing a `resetPasswordUrl` with a token.

---

### Phase 2: Retrieve Reset Token from Email

**Time**: 1-2 minutes (wait for email delivery)

**Action**: Check the test member's email inbox

1. Log into the email account configured for `[member-test-01]`
2. Check for email from `enquiries@jpvbootcamp.com`
3. Look for subject line containing "reset" or "password"
4. Open the email and copy the reset link

**Example reset link**:
```
https://preview.jpvbootcamp.com/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Extract the token**: Copy everything after `token=` in the URL

**Do NOT share this token with anyone** — it's single-use and grants password reset.

---

### Phase 3: Complete Password Reset

**Time**: 30 seconds

**Action**: Call the password reset completion endpoint with the token and new password

```bash
NEW_PASSWORD="[Generate-Strong-Password-Here]"
RESET_TOKEN="[Paste-Token-From-Email-Here]"

curl -X POST https://preview.jpvbootcamp.com/api/member-password/reset \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$RESET_TOKEN\",
    \"password\": \"$NEW_PASSWORD\",
    \"passwordConfirmation\": \"$NEW_PASSWORD\"
  }"
```

**Expected Response**:
```json
{
  "ok": true,
  "destination": "/portal?mode=login"
}
```

**Verify in database**:
```sql
SELECT password_hash, updated_at FROM jpvbootcamp_staging.payload_members 
WHERE email = '[member-test-01]'
LIMIT 1;
```

Expected: `password_hash` changed, `updated_at` updated to current timestamp.

---

### Phase 4: Prove Old Password Fails

**Time**: 30 seconds

**Action**: Attempt login with old password; should fail

```bash
curl -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"[member-test-01]",
    "password":"[REDACTED-password]"
  }'
```

**Expected Response** (HTTP 401):
```json
{
  "message": "The email or password provided is incorrect."
}
```

**Record**: Screenshot or copy this failure as **proof of old credential invalidity**.

---

### Phase 5: Prove New Password Works

**Time**: 30 seconds

**Action**: Attempt login with new password; should succeed

```bash
curl -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"[member-test-01]",
    "password":"[New-Password-You-Set-In-Phase-3]"
  }'
```

**Expected Response** (HTTP 200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 9,
    "email": "[member-test-01]",
    "emailVerifiedAt": "2026-07-20T09:48:00.365Z",
    "accountStatus": "active"
  }
}
```

**Record**: Copy the JWT token as **proof of new credential validity**. (Token is session-temporary and safe to share in reports.)

---

### Phase 6: Invalidate Pre-Existing Sessions (Optional)

**Time**: 1 minute

**Action**: Clear all sessions created before rotation (forces any live sessions to re-authenticate)

**Via CLI**:
```bash
pnpm exec tsx << 'EOF'
import { getPayload } from 'payload'
const payload = await getPayload()
await payload.db.drizzle.delete()
  .from(payload_members_sessions)
  .where(lt(payload_members_sessions.expiresAt, new Date('2026-07-20T11:00:00Z')))
EOF
```

Or **via database**:
```sql
DELETE FROM jpvbootcamp_staging.payload_members_sessions 
WHERE expires_at < '2026-07-20T11:00:00Z';
```

**Verify**: Query shows 0 or fewer rows deleted (depends on test session count).

---

## Completion Checklist

- [ ] **Phase 1**: Password reset email queued (database confirmed)
- [ ] **Phase 2**: Reset token retrieved from inbox email
- [ ] **Phase 3**: Password reset completed successfully (HTTP 200)
- [ ] **Phase 4**: Old password fails login (HTTP 401) — screenshot attached
- [ ] **Phase 5**: New password succeeds login (HTTP 200) — JWT captured
- [ ] **Phase 6** (optional): Pre-existing sessions invalidated

**Completion Date/Time**: _______________  
**Operator Name**: _______________  
**Evidence Location**: (Attach screenshots, JWT tokens, SQL query results)

---

## Why This Wasn't Executed in the Automated Session

1. **No interactive mailbox access**: The rotation process requires reading email in real-time. Automated/sandbox contexts cannot access live inboxes.
2. **No live app credentials**: Token generation happens only when the email is delivered and opened by a real user.
3. **Single-use tokens**: Tokens are valid for minutes only; they must be extracted and used immediately.

**This is a **hard requirement** that only an operator with staging mailbox access can complete.**

---

## After Rotation: Operator D/E Testing

Once rotation is complete and verified:

1. Document the new password securely (password manager, not git)
2. Use new password for all operator D/E mailbox/browser verification
3. Do NOT use the old password; confirm it remains invalid
4. Proceed with `docs/OPERATOR_MAILBOX_BROWSER_CHECKLIST_2026_07_20.md` testing

---

## Security Notes

- **Never commit passwords to git** — this document uses `[REDACTED-password]` and `[member-test-01]` placeholders only
- **New password must be strong**: Minimum 12 characters, mix of uppercase, lowercase, numbers, symbols
- **Keep new password private**: Store in password manager or secure vault, not in documents
- **Proof artifacts**: JWT tokens and error responses are safe to share in reports (they're session-temporary and read-only)
- **SQL evidence**: Query results showing password_hash changes are safe to share (hash is one-way; cannot be reversed)

