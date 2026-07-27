# Provider and Email Readiness

Repository-only checklist for provider/email readiness before any approved live send.

## Rules

- Branch: `feature/course-branding-and-preview`
- Verify environment variable names only. Never record secret values.
- Migrations applied: `No`
- Do not apply migrations from this checklist.
- Do not use this checklist as authorization to send live email by itself.
- Operator handoff summary: `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- Evidence review checklist: `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`

## Environment variables to verify by name only

- `APP_PUBLIC_URL` or `NEXT_PUBLIC_APP_URL`
- `PORTAL_URL`
- `STRIPE_ENV`
- `STRIPE_SECRET_KEY_TEST` or `STRIPE_SECRET_KEY_LIVE`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_TEST` or `STRIPE_WEBHOOK_SECRET_LIVE`
- `STRIPE_PRICE_PRO_TEST` or `STRIPE_PRICE_PRO_LIVE`
- `STRIPE_PRICE_PRO_ANNUAL_TEST` or `STRIPE_PRICE_PRO_ANNUAL_LIVE`
- `STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST` or `STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_LIVE`
- `STRIPE_PORTAL_CONFIGURATION_ID_TEST` or `STRIPE_PORTAL_CONFIGURATION_ID_LIVE`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `BILLING_PORTAL_HMAC_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM` or `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `SUPPORT_TO_EMAIL`
- `DISABLE_NON_WEBHOOK_EMAILS`

## Stripe mode sanity checks

1. Confirm `STRIPE_ENV` matches the intended staging verification mode.
2. Confirm the selected publishable key, secret key, webhook secret, Pro monthly price, Pro annual price, product id, and billing portal configuration id all align with that mode.
3. Confirm checkout accepts only `plan=membership` and optional `billing=monthly|annual`.
4. Confirm `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` remain same-origin with the approved public app URL.

## Email provider and live delivery checks

1. Confirm sender identity is configured through `RESEND_FROM` or `EMAIL_FROM`.
2. Confirm `RESEND_API_KEY` is present in the target environment.
3. Confirm `DISABLE_NON_WEBHOOK_EMAILS` is set to the reviewed mode for controlled sends.
4. Confirm provider dry-run or queue inspection is completed before any live send approval.
5. Confirm one controlled live-delivery verification plan exists for the target environment.

## Evidence capture

Use `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` to record the operator evidence after provider and email checks are run.

## Notification smoke list

- Failed payment notification smoke
- Support/pay-it-forward notification smoke
- Sponsored approval notification smoke
- Sponsored rejection notification smoke
- Billing recovery notification smoke

For each item record:
- Result:
- Controlled recipient scope:
- Notes:

## Escalation

- Owner:
- Approval reference:
- Blocking issue:
- Notes:
