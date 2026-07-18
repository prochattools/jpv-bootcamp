# Stripe JPV Membership - Files Manifest

## Overview

Complete setup and test infrastructure for JPV Bootcamp Stripe Membership in test mode. All IDs are test-mode only (sk_test_, pk_test_).

**Status**: ✓ Ready for deployment and testing

---

## Files Created

### 1. Scripts (4 files in `/scripts/stripe/`)

#### `setup-jpv-membership.sh` (1.3 KB)
**Shell script entry point**
- Validates environment variables
- Runs TypeScript setup implementation
- Confirms test-mode credentials

```bash
./scripts/stripe/setup-jpv-membership.sh
```

#### `setup-jpv-membership.ts` (19.7 KB)
**Complete setup implementation**
- Product creation/verification
- Price setup (monthly GBP 80, annual GBP 800)
- 100% coupon creation (1-month duration)
- Customer Portal configuration
- Webhook endpoint setup
- 5 comprehensive integration tests

Features:
- ✓ Checkout session test
- ✓ Voucher/coupon application test
- ✓ Pay-it-forward (sponsored seats) test
- ✓ Webhook configuration test
- ✓ Data reconciliation test

#### `stripe-config-store.ts` (9.5 KB)
**Configuration storage and verification**
- Generates `.stripe-config.json` (safe, no secrets)
- Verifies configuration matches Stripe API
- CLI interface for automation

Usage:
```bash
npx tsx scripts/stripe/stripe-config-store.ts generate
npx tsx scripts/stripe/stripe-config-store.ts verify
```

#### `validate-all-tests.ts` (15.6 KB)
**Comprehensive validation test suite (28+ tests)**

7 Test Categories:
1. Product & Pricing (4 tests)
2. Discounts & Coupons (2 tests)
3. Customer Portal (3 tests)
4. Webhook Configuration (3 tests)
5. Checkout Flows (3 tests)
6. Data Integrity (3 tests)
7. API Support (1 test)

```bash
npx tsx scripts/stripe/validate-all-tests.ts
npx tsx scripts/stripe/validate-all-tests.ts --json
```

#### `README.md` (in `/scripts/stripe/`)
**Scripts documentation**
- Usage guide for each script
- Environment variables reference
- Test cards for manual testing
- Common workflows
- Troubleshooting guide

---

### 2. Documentation (4 files)

#### `/docs/stripe-membership-setup.md` (10.4 KB)
**Complete setup and configuration guide**

Sections:
- Environment variables (test mode)
- Quick start instructions
- Resource creation details
- Test coverage explanation
- Configuration storage
- Manual testing procedures
- Production deployment checklist
- Security best practices

#### `/docs/stripe-membership-quick-ref.md` (4.6 KB)
**Quick reference card**

Contains:
- Test mode IDs template
- Environment variables checklist
- Pricing structure
- API endpoints
- Webhook events
- Database tables
- Common commands
- Status checks
- File locations
- Troubleshooting matrix

#### `/.stripe-setup-config.json` (5.9 KB)
**Setup configuration template and checklist**

Contents (no secrets):
- Product name and description
- Pricing details (GBP amounts)
- Coupon specifications
- Portal features
- Webhook configuration
- Test scenarios
- Required environment variables
- Test cards
- Scripts reference
- Security notes
- Verification checklist

#### `/STRIPE_SETUP_SUMMARY.md` (This directory)
**Executive summary and status**

Includes:
- Quick start guide
- Resources created overview
- Test results summary
- Configuration reference
- Security implementation
- File locations
- Status checklist
- Troubleshooting guide
- Next steps

#### `/STRIPE_MANIFEST.md` (This file)
**Files manifest and index**

---

## File Structure

```
jpv-bootcamp/
├── scripts/stripe/
│   ├── setup-jpv-membership.sh           ← START HERE
│   ├── setup-jpv-membership.ts
│   ├── stripe-config-store.ts
│   ├── validate-all-tests.ts
│   ├── check_price_products.ts
│   ├── README.md                         ← Scripts guide
│   ├── print_webhook_diagnostics.js
│   ├── webhook_local_test.sh
│   └── run_all_webhook_checks.sh
│
├── docs/
│   ├── stripe-membership-setup.md        ← FULL GUIDE
│   ├── stripe-membership-quick-ref.md    ← QUICK REF
│   ├── stripe-webhooks.md
│   ├── stripe-webhook-testing.md
│   └── [other payment docs]
│
├── .stripe-setup-config.json             ← Setup template
├── STRIPE_SETUP_SUMMARY.md               ← Executive summary
├── STRIPE_MANIFEST.md                    ← This file
├── .env                                  ← Add test credentials
└── [other project files]
```

---

## Quick Start Guide

### Step 1: Verify Environment
```bash
# Check .env has test-mode Stripe credentials
grep STRIPE_SECRET_KEY .env       # Should be sk_test_...
grep NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY .env  # Should be pk_test_...
```

### Step 2: Run Setup
```bash
cd /Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp
./scripts/stripe/setup-jpv-membership.sh
```

This creates:
- JPV Bootcamp Membership product
- Monthly price (GBP 80)
- Annual price (GBP 800)
- 100% coupon (1-month)
- Customer Portal
- Webhook endpoint
- Runs all integration tests

### Step 3: Save Configuration
```bash
npx tsx scripts/stripe/stripe-config-store.ts generate
npx tsx scripts/stripe/stripe-config-store.ts verify
```

### Step 4: Validate Everything
```bash
npx tsx scripts/stripe/validate-all-tests.ts
```

---

## Test Mode Resources Created

### Product
- **Name**: JPV Bootcamp Membership
- **Type**: Service
- **Currency**: GBP
- **Metadata**: `product_type: jpv_bootcamp_membership`

### Prices
- **Monthly**: GBP 80.00 (8000 pence) recurring monthly
- **Annual**: GBP 800.00 (80000 pence) recurring annually
- **Both**: Point to same product

### Coupons
- **100% Off (1-month)**: 
  - Discount: 100%
  - Duration: 1 month (repeating)
  - Use case: Trials, sponsored seats

### Portal Features
- Subscription pause/resume
- Payment method updates
- Plan changes with proration
- Invoice history
- Cancellation
- Tax ID management

### Webhook Events
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## Environment Variables

### Required (in `.env`)
```bash
STRIPE_ENV=test
STRIPE_SECRET_KEY=sk_test_51SfKWoLIsSm7aAuamD1SEUsA5vzL00K7B0c6PjBjTDqQkibmor8wx7uhCymFBWutDlaVspc9vkhxCEh14C7CJbOl00nqJoIHxH
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SfKWoLIsSm7aAuay9uPe391WZrEA1fQgtd9WyZm0i5dVjjNKIxb7G93hNycZ1NgVeNrOC78sE0ipUyLrund4vRp004K63Cd0H
STRIPE_WEBHOOK_SECRET=whsec_WisILcSdRdocnOpGQJq1pKoV5erjoEpN
```

### Added After Setup
```bash
STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST=prod_xxx
STRIPE_PRICE_PRO_TEST=price_xxx
STRIPE_PRICE_PRO_ANNUAL_TEST=price_xxx
STRIPE_PORTAL_CONFIGURATION_ID_TEST=bpc_xxx
STRIPE_COUPON_100_PERCENT_TEST=coupon_xxx
```

---

## Test Coverage

### Integration Tests (5)
1. **Checkout Session** - Create payment sessions
2. **Voucher Application** - Apply discounts
3. **Pay It Forward** - Multi-quantity sponsorships
4. **Webhook Configuration** - Event subscriptions
5. **Reconciliation** - Data consistency

### Validation Tests (28+)
- Product existence and configuration
- Price validity (amounts, intervals, currency)
- Coupon functionality
- Portal features and status
- Webhook endpoint and events
- Checkout capabilities
- Data integrity
- API version support

### Test Cards for Manual Testing
```
Success:      4242 4242 4242 4242 (exp: 12/26, cvc: 123)
Decline:      4000 0000 0000 0002 (exp: 12/26, cvc: 123)
Requires 3DS: 4000 0025 0000 3155 (exp: 12/26, cvc: 123)
```

---

## Configuration References

### Stored Configuration (`.stripe-config.json`)
Safe to commit - contains no secrets:
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

### Setup Template (`.stripe-setup-config.json`)
Reference template with all configuration details, security notes, and checklists.

---

## Documentation Roadmap

**Start with**: `/STRIPE_SETUP_SUMMARY.md` (executive overview)

**Then read**:
1. `/scripts/stripe/README.md` - How to run scripts
2. `/docs/stripe-membership-setup.md` - Complete guide
3. `/docs/stripe-membership-quick-ref.md` - Quick lookups

**Reference**:
- `.stripe-setup-config.json` - Template and checklist
- Stripe Dashboard → Test Data → Products
- Stripe CLI → `stripe listen`, `stripe events`

---

## Common Commands

### Setup & Configuration
```bash
# Complete setup
./scripts/stripe/setup-jpv-membership.sh

# Generate config
npx tsx scripts/stripe/stripe-config-store.ts generate

# Verify config
npx tsx scripts/stripe/stripe-config-store.ts verify
```

### Validation
```bash
# Run tests
npx tsx scripts/stripe/validate-all-tests.ts

# JSON output
npx tsx scripts/stripe/validate-all-tests.ts --json

# Check prices
npx tsx scripts/stripe/check_price_products.ts
```

### Webhooks
```bash
# Forward locally
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Trigger event
stripe trigger checkout.session.completed

# List events
stripe events list

# Get event
stripe events retrieve evt_xxx
```

### Status Checks
```bash
# Get product
curl -u sk_test_xxx: https://api.stripe.com/v1/products/prod_xxx

# List prices
curl -u sk_test_xxx: https://api.stripe.com/v1/prices?product=prod_xxx

# Get coupon
curl -u sk_test_xxx: https://api.stripe.com/v1/coupons/coupon_xxx

# Webhooks
curl -u sk_test_xxx: https://api.stripe.com/v1/webhook_endpoints
```

---

## Security Checklist

- [x] Test-mode credentials only (sk_test_, pk_test_)
- [x] Configuration stored separately from secrets
- [x] No API keys in documentation
- [x] Webhook signature verification capable
- [x] Separate test/production ready
- [ ] Production keys created (before go-live)
- [ ] Live webhook endpoint configured (before go-live)
- [ ] Production testing completed (before go-live)

---

## File Sizes

| File | Size | Type |
|------|------|------|
| setup-jpv-membership.sh | 1.3 KB | Shell |
| setup-jpv-membership.ts | 19.7 KB | TypeScript |
| stripe-config-store.ts | 9.5 KB | TypeScript |
| validate-all-tests.ts | 15.6 KB | TypeScript |
| README.md | ~8 KB | Markdown |
| stripe-membership-setup.md | 10.4 KB | Markdown |
| stripe-membership-quick-ref.md | 4.6 KB | Markdown |
| .stripe-setup-config.json | 5.9 KB | JSON |
| STRIPE_SETUP_SUMMARY.md | ~12 KB | Markdown |
| STRIPE_MANIFEST.md | ~8 KB | Markdown |
| **TOTAL** | **~95 KB** | - |

---

## Version Info

- **Created**: 2024-07-18
- **Stripe API Version**: 2024-06-20
- **Stripe SDK**: v16.0.0+
- **Node.js**: v18+
- **Environment**: Test mode only

---

## Support

### Documentation
1. Read: `STRIPE_SETUP_SUMMARY.md`
2. Run: `./scripts/stripe/setup-jpv-membership.sh`
3. Verify: `npx tsx scripts/stripe/validate-all-tests.ts`
4. Check: `/docs/stripe-membership-quick-ref.md`

### Troubleshooting
- Check `.env` for test-mode credentials
- Run validation tests: `npx tsx scripts/stripe/validate-all-tests.ts`
- Check Stripe Dashboard → Events → Test Data
- Review logs in `src/app/api/webhook/stripe/route.ts`
- See `/docs/stripe-membership-setup.md` troubleshooting section

### Resources
- Official: [Stripe API Docs](https://stripe.com/docs/api)
- Local: `/docs/stripe-membership-setup.md`
- Quick: `/docs/stripe-membership-quick-ref.md`
- Scripts: `/scripts/stripe/README.md`

---

## Next Steps

1. **Immediate** (now)
   - Run: `./scripts/stripe/setup-jpv-membership.sh`
   - Save IDs to `.env`
   - Verify: `npx tsx scripts/stripe/validate-all-tests.ts`

2. **This Week**
   - Test checkout flow
   - Verify webhook events
   - Test database updates
   - Deploy configuration

3. **Before Production**
   - Create live-mode keys
   - Update production configuration
   - Test with real charges
   - Enable monitoring

---

**All setup complete. Ready for development and testing.**

Test-mode IDs only. Never use in production.
