# Stripe JPV Membership - Quick Reference

## Test Mode IDs (from setup output)

```
Product ID:                    prod_xxx (JPV Bootcamp Membership)
Monthly Price (GBP 80):        price_xxx
Annual Price (GBP 800):        price_xxx
100% Coupon (1-month):         coupon_xxx
Portal Config ID:              bpc_xxx
Webhook Endpoint ID:           we_xxx
```

## Environment Variables

```bash
# Add to .env after setup
STRIPE_ENV=test
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST=prod_...
STRIPE_PRICE_PRO_TEST=price_...
STRIPE_PRICE_PRO_ANNUAL_TEST=price_...
STRIPE_PORTAL_CONFIGURATION_ID_TEST=bpc_...
STRIPE_COUPON_100_PERCENT_TEST=coupon_...
```

## Test Card Numbers

| Scenario | Card Number | Exp | CVC |
|----------|-------------|-----|-----|
| Success | 4242 4242 4242 4242 | 12/26 | 123 |
| Decline | 4000 0000 0000 0002 | 12/26 | 123 |
| Requires Auth | 4000 0025 0000 3155 | 12/26 | 123 |

## Pricing Structure

| Tier | Interval | Amount | Currency |
|------|----------|--------|----------|
| Monthly | 1 month | 8000 pence | GBP |
| Annual | 1 year | 80000 pence | GBP |

**Note**: Amounts in pence (multiply GBP by 100)

## API Endpoints

```bash
# Create checkout
POST /api/stripe/create-checkout
{ "priceId": "price_xxx", "email": "user@example.com", "userId": "user_123" }

# Create portal session
POST /api/stripe/create-portal-session
{ "customerId": "cus_xxx", "returnUrl": "http://localhost:3000/account" }

# Webhook handler
POST /api/webhook/stripe
```

## Webhook Events Received

- `checkout.session.completed` - Payment successful
- `customer.subscription.created` - Subscription started
- `customer.subscription.updated` - Changes to subscription
- `customer.subscription.deleted` - Cancellation
- `invoice.paid` - Recurring payment charged
- `invoice.payment_failed` - Payment failed (retry scheduled)

## Database Tables

```sql
-- Subscription status
SELECT * FROM subscriptions 
WHERE user_email = 'user@example.com';

-- Webhook events log
SELECT * FROM stripe_webhook_events 
WHERE event_type = 'checkout.session.completed' 
ORDER BY created_at DESC;
```

## Common Commands

```bash
# Run complete setup
./scripts/stripe/setup-jpv-membership.sh

# Generate config reference
npx tsx scripts/stripe/stripe-config-store.ts generate

# Verify configuration
npx tsx scripts/stripe/stripe-config-store.ts verify

# Check prices and products
npx tsx scripts/stripe/check_price_products.ts

# Forward webhooks locally
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Trigger test event
stripe trigger checkout.session.completed

# View recent events
stripe events list

# Get event details
stripe events retrieve evt_1234567890
```

## Status Checks

```bash
# Verify product exists
curl -u sk_test_xxx: https://api.stripe.com/v1/products/prod_xxx

# List prices
curl -u sk_test_xxx: https://api.stripe.com/v1/prices?product=prod_xxx

# Get coupon
curl -u sk_test_xxx: https://api.stripe.com/v1/coupons/coupon_xxx

# Check webhook endpoints
curl -u sk_test_xxx: https://api.stripe.com/v1/webhook_endpoints
```

## File Locations

```
/scripts/stripe/setup-jpv-membership.sh       # Main setup
/scripts/stripe/setup-jpv-membership.ts       # Setup logic
/scripts/stripe/stripe-config-store.ts        # Config storage
/scripts/stripe/check_price_products.ts       # Price validation
/docs/stripe-membership-setup.md              # Full guide
/docs/stripe-membership-quick-ref.md          # This file
/.stripe-config.json                           # Config reference (no secrets)
```

## Troubleshooting Matrix

| Issue | Check | Fix |
|-------|-------|-----|
| "Invalid API Key" | STRIPE_SECRET_KEY format | Should start with sk_test_ |
| "Product not found" | Product ID | Re-run setup-jpv-membership.sh |
| "Price not found" | Price IDs | Verify in .stripe-config.json |
| Webhook not firing | Endpoint status | Run: stripe listen --forward-to ... |
| "Invalid coupon" | Coupon exists | Create with 100% discount |
| Portal error | Configuration ID | Recreate portal config |

## Next Steps

1. Run: `./scripts/stripe/setup-jpv-membership.sh`
2. Verify all tests pass (✓ PASS on each)
3. Save output IDs to `.env`
4. Test checkout: Use 4242 card in frontend
5. Monitor webhooks: `stripe listen --print-secret`
6. Verify database updates in subscriptions table

## Security Checklist

- [ ] Test keys used (sk_test_, pk_test_)
- [ ] No API keys in git history
- [ ] .env is in .gitignore
- [ ] Webhook secrets secured
- [ ] Production keys separate
- [ ] Portal URL is HTTPS
- [ ] Webhook verification enabled
- [ ] Logging excludes sensitive data
