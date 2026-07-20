# URGENT: Credential Rotation — Operator Immediate Actions — 2026-07-20

**PRIORITY**: 🔴 **CRITICAL**  
**Status**: Rotation reset email has been sent; operator must complete within 5 minutes  
**Exposed Credential**: `[member-test-01]` (step6test@staging.test) — **CONFIRMED VALID** (tested 2026-07-20 11:07 UTC)

---

## Proof of Vulnerability

The exposed credential **IS CURRENTLY FUNCTIONAL** in staging:

```
✅ Test: POST https://preview.jpvbootcamp.com/api/payload_members/login
✅ Credentials: [member-test-01] / [REDACTED-password]
✅ Result: HTTP 200 — Authentication succeeded
✅ JWT token issued and valid
✅ Member ID 9 is active in jpvbootcamp_staging
```

**This is a LIVE CREDENTIAL VULNERABILITY.** The password must be rotated immediately.

---

## What Has Been Done

1. ✅ **Credential validated**: Live API test confirmed password works
2. ✅ **Password reset requested**: `/api/member-password/forgot` called
3. ✅ **Reset email sent**: Resend has queued email to test member inbox

**What remains**: Only YOU can complete (requires mailbox access).

---

## Operator Action Items (Required Now)

### Step 1: Check Inbox (Immediately)

```
Inbox: [staging-test-member-email]
From: enquiries@jpvbootcamp.com
Subject: Contains "reset" or "password"
Time sent: ~2026-07-20 11:07 UTC (check within 5 minutes)
```

**Action**: Log into the test member's email and find the reset message.

---

### Step 2: Extract Reset Token

**In the email**, find the reset link. It will look like:

```
https://preview.jpvbootcamp.com/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Copy the token**: Everything after `token=` (the entire JWT-like string)

**Action**: Copy the full token value (you may need to right-click → Copy Link Address)

---

### Step 3: Complete the Password Reset

Use curl (or Postman) to complete the rotation:

```bash
TOKEN="[paste-token-from-email-here]"
NEW_PASSWORD="[Generate-Strong-NewPass-Here]"

curl -X POST https://preview.jpvbootcamp.com/api/member-password/reset \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"password\": \"$NEW_PASSWORD\",
    \"passwordConfirmation\": \"$NEW_PASSWORD\"
  }"
```

**Expected response**:
```json
{
  "ok": true,
  "destination": "/portal?mode=login"
}
```

**Action**: If you see `"ok": true`, the password has been rotated.

---

### Step 4: Prove Old Password Fails (Validation)

Test that the OLD exposed password no longer works:

```bash
curl -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"[member-test-01]",
    "password":"[REDACTED-password]"
  }'
```

**Expected response** (HTTP 401):
```json
{
  "message": "The email or password provided is incorrect."
}
```

**If you see HTTP 401**, rotation succeeded. **Screenshot this as proof.**

---

### Step 5: Prove New Password Works (Validation)

Test that the NEW password is functional:

```bash
curl -X POST https://preview.jpvbootcamp.com/api/payload_members/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"[member-test-01]",
    "password":"[Your-New-Password-From-Step-3]"
  }'
```

**Expected response** (HTTP 200):
```json
{
  "ok": true,
  "message": "Authentication Passed",
  "token": "[valid-JWT-token]",
  "user": {
    "id": 9,
    "email": "[member-test-01]",
    "accountStatus": "active"
  }
}
```

**If you see HTTP 200 and a JWT token**, rotation succeeded. **Screenshot this as proof.**

---

### Step 6: Invalidate Pre-Existing Sessions (Optional)

If you have database access, invalidate all sessions created before rotation to prevent token reuse:

```sql
DELETE FROM jpvbootcamp_staging.payload_members_sessions 
WHERE member_id = 9;

-- Verify
SELECT COUNT(*) as remaining_sessions 
FROM jpvbootcamp_staging.payload_members_sessions 
WHERE member_id = 9;
```

Expected: `remaining_sessions = 0`

---

## Completion Checklist

- [ ] **Email received**: Reset email in inbox
- [ ] **Token extracted**: Full token copied from link
- [ ] **Reset completed**: HTTP 200 response
- [ ] **Old password fails**: HTTP 401 (screenshot attached)
- [ ] **New password works**: HTTP 200 with JWT (screenshot attached)
- [ ] **Sessions invalidated** (optional): Database updated

---

## Timeline & Deadline

| Time | Action |
|------|--------|
| 2026-07-20 11:07 UTC | Reset email sent |
| **NOW** | ⚠️ **Operator must check inbox** |
| Within 5 minutes | Extract token and complete rotation |
| After rotation | Proceed with D/E verification testing |

**Token expires in ~5 minutes.** If you miss the window, request a new reset via `/api/member-password/forgot`.

---

## Proof Evidence Required

For the final session report, provide:

1. **Email screenshot**: Inbox showing reset email received
2. **Old password test**: HTTP 401 response (failed login attempt)
3. **New password test**: HTTP 200 response with JWT token
4. **Completion timestamp**: Date/time rotation was completed

---

## What This Accomplishes

✅ Invalidates the exposed credential  
✅ Proves old password no longer works (HTTP 401)  
✅ Proves new password is functional (HTTP 200)  
✅ Completes the rotation chain initiated in this session  
✅ Allows D/E verification to proceed with clean credentials

---

## If You Miss the 5-Minute Window

The token will expire. Simply request a new reset:

```bash
curl -X POST https://preview.jpvbootcamp.com/api/member-password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"[member-test-01]"}'
```

A new reset email will be sent. Repeat steps 1-5.

---

## Questions?

- **Reset email not received?** Check spam folder; it may take 1-2 minutes
- **API returns HTTP 400?** Verify token format (no line breaks or extra quotes)
- **Password too short?** Must be at least 12 characters
- **Sessions still active?** Session invalidation is optional; member will need to log back in

---

## After Rotation Is Complete

1. Record completion timestamp and evidence screenshots
2. Proceed with operator D/E mailbox/browser verification (OPERATOR_MAILBOX_BROWSER_CHECKLIST)
3. Update CREDENTIAL_ROTATION_EXECUTION_2026_07_20.md with completion status
4. Formal release state: NO-GO → awaiting client go/no-go decision

