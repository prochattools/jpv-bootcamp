# JPV Bootcamp Staging Verification Guide

**Date:** 2026-07-18  
**Environment:** https://preview.jpvbootcamp.com  
**Database Schema:** jpvbootcamp_staging  
**Branch:** feature/course-branding-and-preview  
**HEAD:** 278bdc5 (updated staging env vars, fixed test selectors)

---

## STARTUP FIXES APPLIED

### Environment Configuration (COMPLETED ✅)
- ✅ `NEXT_PUBLIC_SERVER_URL` → `https://preview.jpvbootcamp.com`
- ✅ `APP_BASE_URL` → `https://preview.jpvbootcamp.com`
- ✅ `NODE_ENV` → `production`
- ✅ All redirect URLs updated from localhost:3000 to staging URL
- ✅ Enables Payload admin login and email verification links

### Stripe Sandbox Verified (COMPLETED ✅)
- ✅ Keys: `sk_test_*` and `pk_test_*` (test mode only)
- ✅ Product: `prod_TeVFTxnBP7eNzM` (JPV Bootcamp Membership)
- ✅ Monthly Price: `price_1ShCFFLIsSm7aAuazujPzhrO` (GBP 80)
- ✅ Annual Price: `price_1ShCFeLIsSm7aAuaBlSSHi7e` (GBP 800)
- ✅ Webhook endpoint: `/api/webhook/stripe` (configured)
- ✅ Never uses live-mode objects

### Test Suite Improvements (COMPLETED ✅)
- ✅ Fixed landing page CTA selectors to be more resilient
- ✅ Changed test waiter from `networkidle` to `domcontentloaded` (avoids Stripe timeout)
- ✅ Fixed 404 page validation (removed false positive on Next.js metadata)
- ✅ Smoke test results: 30/40 passing

---

## MANUAL VERIFICATION CHECKLIST

**CRITICAL PATH** — Must pass for GO decision

### 1. Admin Login & Portal Access
- [ ] Navigate to `https://preview.jpvbootcamp.com/admin/login`
- [ ] Create admin test account or use existing credentials
- [ ] Login successful → admin dashboard loads
- [ ] Collections accessible: Users, Courses, Media, Pages, Posts
- [ ] No console errors or redirects

**Credentials format:** Email + password (set in Payload admin)

---

### 2. Student Onboarding
- [ ] Open `https://preview.jpvbootcamp.com/` in private/incognito window
- [ ] Click "Get Started" or "Sign Up" CTA button
- [ ] Register new email (e.g., `test+staging@example.com`)
- [ ] **Verify email message queued** (check console logs for Resend/email confirmation)
- [ ] **Verify email link contains `https://preview.jpvbootcamp.com`** (not localhost or wrong domain)
- [ ] Click email verification link → email verified
- [ ] Dashboard loads → no console errors

---

### 3. Monthly Checkout Flow
- [ ] Student dashboard → "Upgrade" or billing section
- [ ] Click "Monthly" plan (GBP 80)
- [ ] Stripe checkout page loads
- [ ] Use test card: `4242 4242 4242 4242` (success)
- [ ] Complete checkout
- [ ] **Verify webhook event received** (check database for customer, subscription, payment)
- [ ] Student account now has active subscription
- [ ] Dashboard shows subscription status
- [ ] No console errors

---

### 4. Annual Checkout Flow
- [ ] Login as new student
- [ ] Select "Annual" plan (GBP 800)
- [ ] Complete checkout with test card
- [ ] Verify subscription created with annual interval
- [ ] Verify billing portal access
- [ ] Check database for correct pricing (80000 pence = GBP 800)

---

### 5. Voucher/Free Checkout (100% Coupon)
- [ ] If applicable, test checkout with 100% coupon code
- [ ] Verify checkout amount shows GBP 0.00
- [ ] Complete free checkout
- [ ] Verify subscription created with 100% discount applied
- [ ] Verify webhook events processed correctly

---

### 6. Pay-It-Forward (Sponsored Seats)
- [ ] Navigate to sponsored seats checkout
- [ ] Select quantity > 1 (e.g., 2 or 3 seats)
- [ ] Complete checkout (creates multiple subscription records)
- [ ] Verify sponsored_seats table updated with claim links
- [ ] Test claim link with new account
- [ ] Claimed account receives access to course

---

### 7. Billing Portal & Subscription Management
- [ ] Logged-in student → Account settings
- [ ] Access "Billing" or "Subscription" section
- [ ] Click "Manage Subscription" or "Customer Portal"
- [ ] Stripe Customer Portal loads
- [ ] Available actions:
  - [ ] Update payment method (works without error)
  - [ ] Pause/resume subscription (if enabled)
  - [ ] Change plan (monthly ↔ annual)
  - [ ] Download invoice
  - [ ] Cancel subscription (safe, doesn't error)

---

### 8. Password Reset Email
- [ ] Logout
- [ ] Click "Forgot Password" on login page
- [ ] Enter registered email
- [ ] **Verify reset email sent** (check logs for Resend/email)
- [ ] **Verify reset link contains `https://preview.jpvbootcamp.com`**
- [ ] Click reset link → password reset form loads
- [ ] Set new password → login works with new password

---

### 9. Course Dashboard & Lesson Access
- [ ] Login as student with active subscription
- [ ] Navigate to courses
- [ ] Verify course list loads
- [ ] Click course → lesson list loads
- [ ] Click lesson → content renders
- [ ] Check lesson progress tracking
- [ ] **Video playback** (Bunny protected resource) — video loads (or shows placeholder)

---

### 10. Landing Page & Public Flows
- [ ] Landing page loads: `https://preview.jpvbootcamp.com/`
- [ ] Verify branding (JPV logo, colors, layout)
- [ ] Check pricing section (GBP 80 monthly, GBP 800 annual)
- [ ] Legal pages accessible: `/privacy`, `/terms`
- [ ] 404 page safe (shows "404" without exposing internals)
- [ ] No console errors on public pages
- [ ] Sitemap accessible: `/sitemap.xml` (valid XML)

---

### 11. Accessibility & Mobile
- [ ] **Keyboard Navigation**: Tab through all interactive elements on landing page
  - [ ] Focus indicators visible
  - [ ] No keyboard traps
  - [ ] Logical tab order
- [ ] **Screen Reader** (optional but recommended):
  - [ ] VoiceOver (macOS) or JAWS/NVDA (Windows)
  - [ ] Page structure reads correctly
  - [ ] All buttons/links have accessible labels
- [ ] **Mobile** (iPhone 12 or Pixel 7 equivalent):
  - [ ] Landing page responsive (no horizontal scroll)
  - [ ] Touch targets >= 44px (easy to tap)
  - [ ] Login form accessible
  - [ ] Checkout flows work on mobile

---

### 12. No Console Errors
- [ ] Open browser DevTools (F12)
- [ ] Filter to "Errors" only
- [ ] Complete each flow above while monitoring Console
- [ ] **Expected:** No unhandled errors
- [ ] **Warnings OK:** These are normal for Next.js
- [ ] **Network errors OK:** External service failures don't break core flows

---

### 13. Admin Operations
- [ ] Admin login: `https://preview.jpvbootcamp.com/admin/login`
- [ ] Review queues (if configured)
- [ ] Create/edit course content
- [ ] View subscription/payment records
- [ ] Export data if applicable

---

## STRIPE TEST CARDS

Use these in checkout flows to test different scenarios:

| Scenario | Card Number | Exp | CVC |
|----------|-------------|-----|-----|
| ✅ Success | 4242 4242 4242 4242 | 12/26 | 123 |
| ❌ Decline | 4000 0000 0000 0002 | 12/26 | 123 |
| 🔐 3D Secure | 4000 0025 0000 3155 | 12/26 | 123 |

---

## EXPECTED WEBHOOK EVENTS

When completing checkouts, these events should be logged:

1. `checkout.session.completed` — payment received
2. `customer.subscription.created` — subscription activated
3. `invoice.paid` — payment processed (recurring)

Check webhook logs:
```bash
# View recent webhook events
stripe events list

# Get details
stripe events retrieve evt_1234567890
```

---

## DATABASE VERIFICATION

Connect to staging database and verify schema:

```sql
-- Verify schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'jpvbootcamp_staging';

-- Check key tables
SELECT COUNT(*) FROM jpvbootcamp_staging.payload_users;
SELECT COUNT(*) FROM jpvbootcamp_staging.members;
SELECT COUNT(*) FROM jpvbootcamp_staging.billing_customers;
SELECT COUNT(*) FROM jpvbootcamp_staging.billing_subscriptions;

-- Verify indexes
SELECT * FROM information_schema.statistics WHERE table_schema = 'jpvbootcamp_staging';
```

---

## COMMON ISSUES & TROUBLESHOOTING

### Issue: Checkout redirects to live Stripe instead of test
- **Cause:** STRIPE_ENV not set to 'test' or wrong keys configured
- **Fix:** Verify `STRIPE_ENV=test` and keys start with `sk_test_` and `pk_test_`

### Issue: Email verification links broken or point to wrong domain
- **Cause:** APP_BASE_URL or NEXT_PUBLIC_SERVER_URL not set correctly
- **Fix:** Ensure both are set to `https://preview.jpvbootcamp.com`

### Issue: Admin login page 404 or redirects to portal
- **Cause:** Payload CMS not initialized or NEXT_PUBLIC_SERVER_URL incorrect
- **Fix:** Verify NEXT_PUBLIC_SERVER_URL matches staging domain

### Issue: Webhook events not received
- **Cause:** Webhook endpoint URL wrong or secret not rotated
- **Fix:** Verify webhook configured to `https://preview.jpvbootcamp.com/api/webhook/stripe`

### Issue: Form validation hangs or errors
- **Cause:** Database connection issues or validation service down
- **Fix:** Check database connectivity; verify Payload migrations applied

---

## GO/NO-GO DECISION MATRIX

### MUST PASS (Blocker if fails)
- [ ] Landing page loads without errors
- [ ] Admin login works
- [ ] Student signup + email verification works
- [ ] Monthly checkout completes to Stripe
- [ ] Annual checkout completes to Stripe
- [ ] Webhook events processed (customer, subscription created)
- [ ] Billing portal accessible
- [ ] Course dashboard accessible with active subscription
- [ ] No unhandled console errors on critical paths
- [ ] Accessibility: keyboard navigation functional
- [ ] Accessibility: mobile viewport responsive

### SHOULD PASS (Release enhancement but not blocker)
- [ ] Voucher/coupon checkout works
- [ ] Pay-it-forward (sponsorships) works
- [ ] Password reset email works
- [ ] Admin review queues accessible
- [ ] Screen reader support verified (optional)
- [ ] Performance acceptable (<5s landing page load)

### CAN VERIFY LATER (Not blocking)
- [ ] Detailed course content (requires approval)
- [ ] Advanced Bunny playback features
- [ ] LiveKit video conferencing (if in scope)
- [ ] Analytics/reporting dashboards
- [ ] Email delivery confirmation (ISP dependent)

---

## OPERATOR SIGN-OFF

**Verified by:** _________________________  
**Date:** ___________  
**Time:** ___________  
**Environment:** https://preview.jpvbootcamp.com

### Verification Results
- [ ] All critical path items verified and passing
- [ ] No unhandled errors in console
- [ ] Accessibility verified (keyboard + mobile)
- [ ] All checkout flows tested with real cards
- [ ] Webhook events confirmed in logs
- [ ] Database records created and correct
- [ ] Admin login and operations verified
- [ ] Email verification links working
- [ ] Stripe test mode confirmed (never live mode)

### Final Decision
- [ ] ✅ **GO** — Ready for production release
- [ ] ⚠️  **GO WITH NOTES** — Ready but with documented limitations
- [ ] ❌ **NO-GO** — Blocking issues prevent release

### Blockers/Issues Found
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

### Sign-Off
I have completed verification of the JPV Bootcamp staging environment and confirm the above decision.

**Signature:** _________________________

---

## NEXT STEPS AFTER SIGN-OFF

1. **If GO:**
   - Merge feature branch to main
   - Trigger production deployment
   - Monitor production for issues
   - Archive this staging verification report

2. **If NO-GO:**
   - Document blocking issues in GitHub
   - Assign fixes to dev team
   - Re-run verification after fixes
   - Schedule new sign-off

---

**Test Data Retention:** Staging environment will retain test data for 30 days unless manually purged. Use test schema `jpvbootcamp_staging` for all testing.

**Support:** Contact dev team if verification cannot be completed or if encountering infrastructure issues.
