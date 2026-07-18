# JPV Bootcamp Stripe Membership Setup Guide

## Overview

This guide covers the complete setup, verification, and testing of the JPV Bootcamp Membership product in Stripe test mode. All configurations use test-mode credentials only - **never live-mode IDs**.

## Prerequisites

1. **Stripe Account**: JPV Bootcamp Stripe account with test mode access
2. **Node.js**: v18+
3. **Environment Variables**: Stripe test mode credentials in `.env`

## Environment Variables (Test Mode Only)

```bash
# REQUIRED - Test mode credentials
STRIPE_ENV=test
STRIPE_SECRET_KEY=sk_test_51SfKWoLIsSm7aAuamD1SEUsA5vzL00K7B0c6PjBjTDqQkibmor8wx7uhCymFBWutDlaVspc9vkhxCEh14C7CJbOl00nqJoIHxH
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SfKWoLIsSm7aAuay9uPe391WZrEA1fQgtd9WyZm0i5dVjjNKIxb7G93hNycZ1NgVeNrOC78sE0ipUyLrund4vRp004K63Cd0H
STRIPE_WEBHOOK_SECRET=whsec_WisILcSdRdocnOpGQJq1pKoV5erjoEpN

# OPTIONAL - Auto-populated after setup
STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST=prod_TeVFTxnBP7eNzM
STRIPE_PRICE_PRO_TEST=price_1ShCFFLIsSm7aAuazujPzhrO
STRIPE_PRICE_PRO_ANNUAL_TEST=price_1ShCFeLIsSm7aAuaBlSSHi7e
STRIPE_PORTAL_CONFIGURATION_ID_TEST=bpc_1SudeVLIsSm7aAuaHZHSIHWo
STRIPE_COUPON_100_PERCENT_TEST=50_pct_off_XXXXXX
```

**Security Note**: Never commit these to version control. Use `.env.local` for development.

## Quick Start

### 1. Run Setup Script

```bash
# From project root
./scripts/stripe/setup-jpv-membership.sh
```

This script:
- Verifies test-mode credentials
- Creates or verifies the JPV Bootcamp Membership product
- Sets up monthly (GBP 80) and annual (GBP 800) recurring prices
- Creates a 100% discount coupon (1-month duration)
- Configures the Stripe Customer Portal
- Creates a test webhook endpoint
- Runs comprehensive integration tests

### 2. Save Configuration Reference

```bash
# Generate and store configuration (no secrets)
npx tsx scripts/stripe/stripe-config-store.ts generate

# Verify configuration is correct
npx tsx scripts/stripe/stripe-config-store.ts verify
```

## Resources Created

### Product
- **Name**: JPV Bootcamp Membership
- **Type**: Service
- **Mode**: Test (sk_test_* prefix)

### Pricing
- **Monthly**: GBP 80.00 recurring (billed monthly)
- **Annual**: GBP 800.00 recurring (billed annually)
- **Currency**: GBP (Great British Pounds)

### Discounts
- **100% Coupon (1-month)**: Fully discount membership for 1 billing period
  - Use case: Trial periods, sponsored seats
  - Duration: 1 month repeating

### Features
- **Billing Portal**: Full self-service subscription management
  - Update payment method
  - Change billing cycle (pause/resume)
  - View invoice history
  - Download invoices
  - Cancel subscription
- **Webhooks**: Real-time subscription events
  - `checkout.session.completed` - Payment received
  - `customer.subscription.created` - New subscription
  - `customer.subscription.updated` - Changes to active subscription
  - `customer.subscription.deleted` - Cancellation
  - `invoice.paid` - Recurring payment success
  - `invoice.payment_failed` - Payment retry needed

## Test Coverage

The setup script includes comprehensive tests:

### 1. Checkout Session Test
**What it verifies**:
- Can create checkout sessions
- Payment link generation
- Session metadata preservation
- Error handling for invalid inputs

**Example**:
```typescript
// Test creates a checkout session with monthly price
// Returns a payment link that works in test mode
session.url // https://checkout.stripe.com/pay/cs_test_...
```

### 2. Voucher/Coupon Application Test
**What it verifies**:
- Discount coupon application
- Correct discount calculation (100% off)
- Line item and total adjustment
- Multiple coupon handling

**Example**:
```typescript
// Test applies 100% coupon to checkout
// Verifies discount amount is applied correctly
const discountAmount = session.total_details?.amount_discount // 8000 (GBP 80)
```

### 3. Pay It Forward (Sponsored Seats) Test
**What it verifies**:
- Multiple quantity checkout for sponsorship
- Metadata tracking for sponsored seats
- Proper success/cancel URL routing
- Session persistence for sponsor records

**Example**:
```typescript
// Test creates checkout with quantity: 2
// Represents sponsor purchasing 2 memberships
// Metadata: { sponsored_seats: "2" }
```

### 4. Webhook Configuration Test
**What it verifies**:
- Webhook endpoint exists and is enabled
- All required events subscribed
- Endpoint URL and API version
- Status and connectivity (via test trigger)

**Example**:
```typescript
// Verifies webhook is receiving events:
// - checkout.session.completed
// - customer.subscription.created
// - customer.subscription.updated
// - customer.subscription.deleted
// - invoice.paid
// - invoice.payment_failed
```

### 5. Reconciliation Test
**What it verifies**:
- Product/price/coupon data consistency
- No orphaned or mismatched configurations
- Customer and invoice data alignment
- Test data integrity

**Example**:
```typescript
// Verifies all resources link correctly:
// Price → Product (same product)
// Coupon → Active and usable
// Portal Config → Enabled features
// Webhooks → Valid endpoint
```

## Test Results Output

```
RUNNING COMPREHENSIVE TEST SUITE
============================================================

✅ TEST: Checkout Session Creation
  ✓ Checkout session created: cs_test_xxxxx
  ✓ Payment link: https://checkout.stripe.com/pay/cs_test_xxxxx

✅ TEST: Voucher/Coupon Application
  ✓ Voucher applied successfully
  ✓ Discount amount: GBP 80.00

✅ TEST: Pay It Forward (Sponsored Seats)
  ✓ Pay-it-forward session created: cs_test_xxxxx
  ✓ Sponsored quantity: 2

✅ TEST: Webhook Configuration Validation
  ✓ Found 1 webhook endpoint(s)
  ✓ Events enabled: checkout.session.completed, customer.subscription.created, ...
  ✓ Status: enabled

✅ TEST: Subscription Data Reconciliation
  ✓ Products in account: 1+
  ✓ Prices configured: 2
  ✓ Coupons available: 1
  ✓ Customers in account: 0+
  ✓ Test prices verified: 2
```

## Configuration Storage

Configuration references are stored in `.stripe-config.json` (no secrets):

```json
{
  "environment": "test",
  "timestamp": "2024-07-18T12:00:00Z",
  "product": {
    "id": "prod_TeVFTxnBP7eNzM",
    "name": "JPV Bootcamp Membership",
    "description": "..."
  },
  "prices": {
    "monthly": {
      "id": "price_1ShCFFLIsSm7aAuazujPzhrO",
      "amount": 8000,
      "currency": "gbp",
      "interval": "month"
    },
    "annual": {
      "id": "price_1ShCFeLIsSm7aAuaBlSSHi7e",
      "amount": 80000,
      "currency": "gbp",
      "interval": "year"
    }
  },
  "coupons": {
    "coupon100Percent1Month": {
      "id": "50_pct_off_...",
      "percentOff": 100,
      "duration": "repeating",
      "durationInMonths": 1
    }
  },
  "portalConfiguration": {
    "id": "bpc_1SudeVLIsSm7aAuaHZHSIHWo",
    "features": ["subscription_pause", "subscription_update", "customer_update", ...]
  },
  "webhookEndpoint": {
    "id": "we_1SudeVLIsSm7aAuaHZHSIHWo",
    "status": "enabled",
    "enabledEvents": [...]
  },
  "testStatus": {
    "checkoutSession": true,
    "voucherApplication": true,
    "payItForward": true,
    "webhookConfiguration": true,
    "reconciliation": true
  }
}
```

**Why store configuration separately**:
- Configuration references are safe to commit (no credentials)
- Useful for audits and cross-checking
- Enables automated reconciliation checks
- No need to call Stripe API for verification in CI/CD

## Manual Testing in Stripe Dashboard

### 1. Test Payment with Test Card

Go to the Stripe Dashboard → Test Data:

1. Create a test customer
2. Create a checkout session with your product/price
3. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/26)
   - CVC: Any 3 digits
4. Complete payment and verify webhook events

### 2. Test Webhook Events

```bash
# Forward webhook events locally during development
stripe listen --forward-to localhost:3000/api/webhook/stripe

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.paid
```

### 3. Test Customer Portal

```bash
# Create a portal session
POST /api/stripe/create-portal-session
{
  "customerId": "cus_test_...",
  "returnUrl": "http://localhost:3000/account"
}
```

## Troubleshooting

### Test credentials not working
- Verify keys start with `sk_test_` and `pk_test_`
- Check for extra whitespace in .env
- Ensure `STRIPE_ENV=test`

### Webhook endpoint failing
- Verify endpoint URL is correct
- Check webhook secret matches STRIPE_WEBHOOK_SECRET
- Ensure local server is running on port 3000
- Use `stripe listen --print-secret` to get new secret if needed

### Prices not appearing in checkout
- Verify price IDs are correct
- Check prices are active in Stripe Dashboard
- Ensure prices belong to the correct product

### Coupon not applying
- Verify coupon ID is correct
- Check coupon is not expired
- Ensure coupon applies to product type

## Production Deployment

When ready for production:

1. **Do NOT copy test credentials to production**
2. Create separate live-mode API keys
3. Create production-only prices and coupons
4. Update environment variables:
   ```bash
   STRIPE_ENV=live
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_live_...
   ```
5. Re-run setup script in production environment
6. Update webhook endpoint URL to production domain
7. Enable production monitoring and alerts
8. Test with real payments (use 0.50 amount for minimal charge)

## Important Security Rules

1. **Never log API keys** - Not in console, not in error messages
2. **Never commit secrets** - Use .env.local or .env with .gitignore
3. **Always use HTTPS** - Required for production webhooks
4. **Verify webhook signatures** - Always call `stripe.webhooks.constructEvent()`
5. **Separate test/live keys** - Use different keys per environment
6. **Rotate secrets regularly** - If leaked or suspected compromised
7. **Use restricted API keys** - Only expose necessary permissions
8. **Monitor webhooks** - Track delivery failures and retries

## Related Documentation

- [Stripe Checkout Documentation](/docs/stripe-webhooks.md)
- [Stripe Webhook Testing](/docs/stripe-webhook-testing.md)
- [Stripe Integration Guide](/instructions/stripe.md)
- [Stripe API Reference](https://stripe.com/docs/api)

## Support

For issues or questions:
1. Check Stripe Dashboard → Events for webhook details
2. Review logs at `/logs/stripe/`
3. Consult [Stripe API Errors](https://stripe.com/docs/error-codes)
4. Contact Stripe support for account issues
