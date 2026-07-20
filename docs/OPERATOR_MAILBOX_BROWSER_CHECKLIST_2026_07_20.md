# Operator Checklist: Mailbox & Browser Proof — 2026-07-20

**Purpose**: Verify remaining evidence levels D (mailbox delivery) and E (browser interaction) for steps 2, 6, 9, and 10.

**Status**: Backend API/DB verified (B level) ✓. Mailbox and browser remain operator-verified.

---

## Prerequisite

- You have access to the inbox configured as the **test email address** in the staging environment.
- The staging app is running: https://preview.jpvbootcamp.com/health → HTTP 200 ✓

---

## D: Mailbox Delivery Checklist

### Check 1: Email Inbox for Verification Message

**Action**: Log into your email inbox and check for messages from `enquiries@jpvbootcamp.com` (the configured sender).

**Look for**: Subject containing "verify" or "verification" sent around 2026-07-20 09:47 UTC.

**Evidence to Record**:
- [ ] Email received from enquiries@jpvbootcamp.com
- [ ] Subject line visible
- [ ] Message contains a link with `/api/member-email-verification/complete?token=...`
- [ ] Link is clickable (not mangled)
- [ ] Email renders correctly (no broken images, proper formatting)

**Redaction**: You may record "Email received ✓" without exposing the full link or token.

---

### Check 2: Email Inbox for Password Reset Message

**Action**: Continue checking the same inbox.

**Look for**: Subject containing "reset" or "password" sent around 2026-07-20 09:48 UTC (later than verification email).

**Evidence to Record**:
- [ ] Email received from enquiries@jpvbootcamp.com
- [ ] Subject line visible
- [ ] Message contains a link with `/reset-password?token=...`
- [ ] Link is clickable
- [ ] Email renders correctly

**Redaction**: Record "Email received ✓" without exposing the full link or token.

---

## E: Browser Interaction Checklist

### Check 3: Admin Login & Browser Session

**Action**: Open browser to https://preview.jpvbootcamp.com/admin

**Steps**:
1. Enter admin username and password (staging credentials)
2. Submit login form
3. Verify: Redirected to admin dashboard (HTTP 200, not 401)

**Evidence to Record**:
- [ ] Login form appears at `/admin`
- [ ] After submit: Dashboard displays (not error page)
- [ ] URL changes to `/admin/...` or similar (indicates session active)

**Redaction**: Do not record credentials; only record success/failure.

---

### Check 4: Browser HTTP Headers (Developer Tools)

**Action**: With browser open to staging app, open Developer Tools (F12) and inspect network traffic.

**Steps for Step 10 (Cookie Security)**:
1. Open DevTools → Network tab
2. Perform any API call (e.g., login again or refresh)
3. Find the request in Network tab
4. Click → Response Headers
5. Look for `Set-Cookie` header

**Evidence to Record**: For the Set-Cookie header, verify presence of:
- [ ] `Secure` flag present (ensures HTTPS-only)
- [ ] `HttpOnly` flag present (prevents JS access)
- [ ] `SameSite=Strict` present (CSRF protection)

**Redaction**: You may record "Secure ✓, HttpOnly ✓, SameSite=Strict ✓" without recording the full cookie value.

---

### Check 5: Email Verification Link (Browser Click)

**Prerequisite**: You have received the verification email (Check 1).

**Action**: Click the verification link in the email.

**Steps**:
1. Open the verification email
2. Click the link: `https://preview.jpvbootcamp.com/verify-email?token=...`
3. Observe: Browser should redirect to `/portal?verification=...` or similar

**Evidence to Record**:
- [ ] Link is clickable (not broken)
- [ ] Browser loads the page (no 404 or 500)
- [ ] Page displays feedback (e.g., "Verification complete" or redirects to login)
- [ ] No console errors (F12 → Console)

**Redaction**: Record "Link works ✓" without recording the token.

---

### Check 6: Password Reset Link (Browser Click)

**Prerequisite**: You have received the password reset email (Check 2).

**Action**: Click the password reset link in the email.

**Steps**:
1. Open the password reset email
2. Click the link: `https://preview.jpvbootcamp.com/reset-password?token=...`
3. Observe: Browser should display a password reset form

**Evidence to Record**:
- [ ] Link is clickable (not broken)
- [ ] Browser loads the form page (no 404 or 500)
- [ ] Form displays input fields (password, password confirm, submit button)
- [ ] No console errors

**Redaction**: Record "Link works ✓, form displays ✓" without recording the token.

---

## Summary

**After completing the above**:

Record these results in an operator sign-off document:

```
OPERATOR MAILBOX/BROWSER PROOF SIGN-OFF — 2026-07-20

D Level (Mailbox Delivery):
- [ ] Verification email received ✓
- [ ] Password reset email received ✓

E Level (Browser Interaction):
- [ ] Admin login successful ✓
- [ ] Set-Cookie headers verified (Secure, HttpOnly, SameSite=Strict) ✓
- [ ] Verification link clickable and functional ✓
- [ ] Password reset link clickable and displays form ✓

All remaining proof complete.
```

**Report this back for final go/no-go decision.**

---

## Technical Notes

- **Verification link** calls `/api/member-email-verification/complete` internally (backend already proven working)
- **Password reset link** loads a form; form submission calls `/api/member-password/reset` (backend already proven working)
- **Browser cookies** should be automatically set by Payload CMS auth middleware (source code verified)
- **Admin login** uses Payload's native auth system (infrastructure already proven)

**No new code testing needed.** This is pure infrastructure validation (mailbox delivery, browser rendering, HTTP headers).

---

**Timeline**: ~10 minutes to complete all checks.
