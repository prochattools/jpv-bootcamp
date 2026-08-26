# Stripe Membership Setup & Testing Scripts

This directory contains scripts for setting up and validating the JPV Bootcamp Stripe Membership product in test mode.

## Overview

The Stripe membership setup consists of:
- **Product**: JPV Bootcamp Membership
- **Prices**: Monthly (GBP 80) and Annual (GBP 800)
- **Discounts**: 100% coupon for 1-month (trials, sponsorships)
- **Portal**: Full self-service customer portal
- **Webhooks**: Real-time subscription event handling

## Quick Start

### 1. Setup (One-time)

```bash
# Run complete setup and testing
./scripts/stripe/setup-jpv-membership.sh

# This will:
# - Create/verify JPV Bootcamp Membership product
# - Set up monthly and annual prices in GBP
# - Create 100% discount coupon (1-month duration)
# - Configure Customer Portal
# - Create webhook endpoint
# - Run comprehensive integration tests
# - Output test-mode IDs and configuration
```

### 2. Save Configuration

```bash
# Generate configuration reference (no secrets)
npx tsx scripts/stripe/stripe-config-store.ts generate

# Verify configuration is correct
npx tsx scripts/stripe/stripe-config-store.ts verify
```

### 3. Validate Configuration

```bash
# Run full validation test suite
npx tsx scripts/stripe/validate-all-tests.ts

# Get JSON output for CI/CD
npx tsx scripts/stripe/validate-all-tests.ts --json
```

## Scripts

### `setup-jpv-membership.sh`

Complete setup script for JPV Bootcamp Stripe membership.

**Usage**:
```bash
./scripts/stripe/setup-jpv-membership.sh
```

**What it does**:
1. Validates test-mode credentials
2. Creates or verifies product
3. Sets up prices (monthly GBP 80, annual GBP 800)
4. Creates 100% coupon (1-month)
5. Configures Customer Portal
6. Creates webhook endpoint
7. Runs 5 integration tests:
   - Checkout session creation
   - Voucher/coupon application
   - Pay-it-forward (sponsored seats)
   - Webhook configuration
   - Data reconciliation

**Output**:
- Prints all configuration IDs
- Displays test results
- Shows environment variables to add to `.env`
- Validates all tests pass

**Requirements**:
- `.env` with `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Test-mode credentials (sk_test_*, pk_test_*)
- Node.js and npm

---

### `setup-jpv-membership.ts`

TypeScript implementation of setup logic. Called by shell script.

**Features**:
- Product creation/verification
- Price setup (monthly + annual)
- Coupon creation (100% discount, 1-month)
- Portal configuration
- Webhook endpoint setup
- 5 integration tests

**Test Types**:
1. **Checkout**: Creates valid checkout sessions
2. **Voucher**: Applies discounts correctly
3. **Pay-it-Forward**: Multiple-quantity for sponsorships
4. **Webhook**: Endpoint enabled with required events
5. **Reconciliation**: Data consistency verified

---

### `stripe-config-store.ts`

Stores and verifies Stripe configuration references (no secrets).

**Commands**:

```bash
# Generate configuration reference
npx tsx scripts/stripe/stripe-config-store.ts generate

# Verify stored configuration matches Stripe
npx tsx scripts/stripe/stripe-config-store.ts verify
```

**What it generates** (`.stripe-config.json`):
```json
{
  "product": { "id": "prod_...", "name": "JPV Bootcamp Membership" },
  "prices": {
    "monthly": { "id": "price_...", "amount": 8000, "currency": "gbp" },
    "annual": { "id": "price_...", "amount": 80000, "currency": "gbp" }
  },
  "coupons": { "coupon100Percent1Month": { "id": "coupon_..." } },
  "portalConfiguration": { "id": "bpc_..." },
  "webhookEndpoint": { "id": "we_...", "status": "enabled" }
}
```

**Why separate config**:
- Configuration is safe to commit (no secrets)
- Useful for audits and CI/CD verification
- No API calls needed to validate
- Enables automated reconciliation

---

### `validate-all-tests.ts`

Comprehensive validation test suite (28+ tests).

**Usage**:
```bash
# Run all tests
npx tsx scripts/stripe/validate-all-tests.ts

# Get JSON output
npx tsx scripts/stripe/validate-all-tests.ts --json
```

**Test Categories** (7 suites):

1. **Product & Pricing** (4 tests)
   - Product exists
   - Monthly price valid (GBP 80)
   - Annual price valid (GBP 800)
   - Same product for both prices

2. **Discounts & Coupons** (2 tests)
   - 100% coupon exists
   - Coupon applies to checkout

3. **Customer Portal** (3 tests)
   - Configuration exists
   - Required features enabled
   - Portal is active

4. **Webhooks** (3 tests)
   - Endpoint exists
   - Webhook is enabled
   - Required events subscribed

5. **Checkout Flows** (3 tests)
   - Basic checkout works
   - Metadata preservation
   - Multi-quantity (pay-it-forward)

6. **Data Integrity** (3 tests)
   - No orphaned prices
   - Currency consistency
   - Metadata present

7. **API Support** (1 test)
   - API version supported

**Output**:
- Pass/fail for each test
- Summary (total passed/failed)
- Critical vs non-critical markers
- Timestamp
- Optional JSON report

---

### `check_price_products.ts`

Checks that monthly and annual prices point to same product.

**Usage**:
```bash
npx tsx scripts/stripe/check_price_products.ts
```

**Verification**:
- Retrieves monthly price
- Retrieves annual price
- Confirms they reference the same product
- Exits with error if mismatch

---

### `webhook_local_test.sh`

Tests webhook forwarding for local development.

**Usage**:
```bash
scripts/stripe/webhook_local_test.sh
```

**What it does**:
- Starts Stripe CLI listening
- Forwards webhook events to localhost:3000
- Triggers test events
- Verifies webhook handler receives them

---

### `run_all_webhook_checks.sh`

Runs complete webhook diagnostic suite.

**Usage**:
```bash
# Local tests only
scripts/stripe/run_all_webhook_checks.sh

# Include production tests
RUN_PROD=1 scripts/stripe/run_all_webhook_checks.sh
```

**Tests**:
1. Webhook diagnostics
2. Local webhook test
3. Production webhook test (optional)

---

## Environment Variables

### Required (for all scripts)

```bash
STRIPE_ENV=test
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Auto-populated after setup

```bash
STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST=prod_...
STRIPE_PRICE_PRO_TEST=price_...
STRIPE_PRICE_PRO_ANNUAL_TEST=price_...
STRIPE_PORTAL_CONFIGURATION_ID_TEST=bpc_...
STRIPE_COUPON_100_PERCENT_TEST=coupon_...
```

## Test Mode IDs (Examples)

| Resource | Example ID | Format |
|----------|-----------|--------|
| Product | prod_TeVFTxnBP7eNzM | prod_... |
| Monthly Price | price_1ShCFFLIsSm7aAuazujPzhrO | price_... |
| Annual Price | price_1ShCFeLIsSm7aAuaBlSSHi7e | price_... |
| Coupon | 50_pct_off_XXXXXX | coupon_... or discount code |
| Portal Config | bpc_1SudeVLIsSm7aAuaHZHSIHWo | bpc_... |
| Webhook | we_1SudeVLIsSm7aAuaHZHSIHWo | we_... |

## Test Cards

Use these for testing checkout:

```
Success:              4242 4242 4242 4242 (exp: 12/26, cvc: 123)
Decline:              4000 0000 0000 0002 (exp: 12/26, cvc: 123)
Requires Auth (3DS):  4000 0025 0000 3155 (exp: 12/26, cvc: 123)
```

## Common Workflows

### Run Complete Setup
```bash
./scripts/stripe/setup-jpv-membership.sh
```

### Validate After Changes
```bash
npx tsx scripts/stripe/validate-all-tests.ts
```

### Forward Webhooks Locally
```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
# Get webhook secret from output
# Update STRIPE_WEBHOOK_SECRET in .env
```

### Test Specific Webhook Event
```bash
# Start listening in one terminal
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Trigger event in another
stripe trigger checkout.session.completed
```

### Check Webhook Events
```bash
stripe events list
stripe events retrieve evt_1234567890
```

## Troubleshooting

### "Invalid API Key"
- Check `STRIPE_SECRET_KEY` starts with `sk_test_`
- Verify no extra whitespace in .env
- Ensure `STRIPE_ENV=test`

### "Product not found"
- Run `./scripts/stripe/setup-jpv-membership.sh` again
- Check product exists in Stripe Dashboard

### "Price not found"
- Verify price ID in `.stripe-config.json`
- Check price is active in Stripe Dashboard

### Webhook not receiving events
- Run `stripe listen --forward-to localhost:3000/api/webhook/stripe`
- Verify webhook handler at `src/app/api/webhook/stripe/route.ts`
- Check webhook secret in logs

## Files Generated

```
.stripe-config.json               # Configuration reference (no secrets)
.stripe-setup-config.json         # Setup template and checklist
docs/stripe-membership-setup.md   # Complete setup guide
docs/stripe-membership-quick-ref.md # Quick reference
```

## Security Best Practices

1. **Never commit API keys** - Use `.env.local` or `.gitignore`
2. **Test-mode only** - Never use live-mode keys for testing
3. **Verify webhook signatures** - Always call `stripe.webhooks.constructEvent()`
4. **No logging of secrets** - Filter sensitive data from logs
5. **Separate credentials** - Different keys per environment
6. **Rotate if leaked** - Re-generate compromised keys

## Related Documentation

- [Stripe Membership Setup Guide](../../docs/stripe-membership-setup.md)
- [Stripe Quick Reference](../../docs/stripe-membership-quick-ref.md)
- [Stripe Webhooks](../../docs/stripe-webhooks.md)
- [Stripe Integration](../../instructions/stripe.md)

## Support

For help:
1. Check Stripe Dashboard → Events for webhook activity
2. Review `.stripe-config.json` for configuration
3. Run validation: `npx tsx scripts/stripe/validate-all-tests.ts`
4. Check logs in `src/app/api/webhook/stripe/route.ts`
5. Consult [Stripe API docs](https://stripe.com/docs/api)
