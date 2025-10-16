# Stripe Integration Guide - MicroSaaS Fast Boilerplate

## Stripe Version and Setup

### Version Information

- **Stripe Node.js SDK**: 16.0.0
- **API Version**: 2024-06-20
- **Stripe.js**: 4.7.0 (client-side)

### Installation

```bash
npm install stripe@16.0.0 @stripe/stripe-js@4.7.0
```

### Environment Variables

```bash
# Required for server-side operations
STRIPE_SECRET_KEY="sk_test_..." # or sk_live_... for production

# Required for client-side operations
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..." # or pk_live_... for production

# Required for webhook verification
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Stripe CLI Setup and Usage

### Installation

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

### Authentication

```bash
stripe login
```

### Webhook Forwarding (Development)

```bash
# Forward webhooks to local development server
stripe listen --forward-to localhost:3000/api/webhook/stripe

# This will output a webhook signing secret like:
# Ready! Your webhook signing secret is whsec_1234567890abcdef...
# Copy this to your .env.local as STRIPE_WEBHOOK_SECRET
```

### Testing Webhooks

```bash
# Trigger test webhook events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

### Viewing Events

```bash
# List recent events
stripe events list

# Get specific event details
stripe events retrieve evt_1234567890
```

## Webhook Implementation

### Webhook Handler Location

`src/app/api/webhook/stripe/route.ts`

### Webhook Events Handled

#### 1. checkout.session.completed

**Triggered when**: Customer completes payment
**Handler**: `processCheckoutSuccessWebhook()`
**Actions**:

- Retrieves checkout session details
- Finds customer and product information
- Creates/updates subscription in database
- Sends welcome email via Resend
- Updates user subscription status to 'active'

#### 2. customer.subscription.deleted

**Triggered when**: Subscription is cancelled or expires
**Handler**: `processSubscriptonDelete()`
**Actions**:

- Updates subscription status to 'inactive' in database
- Revokes access to premium features

#### 3. invoice.paid

**Triggered when**: Recurring payment succeeds
**Handler**: `processInvoicePaid()`
**Actions**:

- Verifies subscription validity
- Updates subscription status to 'active'
- Ensures continued access to features

#### 4. checkout.session.expired

**Triggered when**: Checkout session expires without payment
**Actions**: No specific handler (can be used for abandoned cart emails)

#### 5. customer.subscription.updated

**Triggered when**: Subscription details change
**Actions**: No specific handler (can be used for plan change notifications)

#### 6. invoice.payment_failed

**Triggered when**: Payment fails
**Actions**: No specific handler (Stripe handles retries automatically)

### Webhook Verification

```typescript
// Webhook signature verification
const event = stripe.webhooks.constructEvent(
	textParsedBody,
	signature,
	webhookSecret
)
```

### Database Schema for Subscriptions

```prisma
model Subscription {
  id                 String             @id @default(uuid())
  user_email         String             @unique
  sub_status         SubscriptionStatus @default(inactive)
  sub_type           String
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  last_stripe_cs_id  String             @unique
  stripe_customer_id String             @unique
  sub_stripe_id      String?
  user_clerk_id      String             @unique
}
```

## Checkout Implementation

### Checkout API Endpoint

`src/app/api/stripe/create-checkout/route.ts`

### Checkout Process Flow

1. **Client Request**: Sends `priceId`, `email`, `userId`
2. **Server Validation**: Validates product exists in config
3. **Session Creation**: Creates Stripe checkout session
4. **Redirect**: Returns session ID for client redirect

### Checkout Helper Function

`src/helpers/checkout.ts` - `handleCheckoutProcess()`

**Usage**:

```typescript
import { handleCheckoutProcess } from '@/helpers/checkout'

await handleCheckoutProcess(priceId, userId, email, setLoading, setError)
```

## Pricing Component Integration

### Current Implementation Issue

The `Pricing.tsx` component currently uses hardcoded Stripe checkout links:

```typescript
btn_link: 'https://buy.stripe.com/5kA5nF3pxdgh2bK5kn'
```

### Recommended Solution: Dynamic Checkout

#### Option 1: Replace with Dynamic Checkout (Recommended)

Update `Pricing.tsx` to use the checkout helper:

```typescript
// Replace the hardcoded btn_link with a function
const handlePurchase = async (priceId: string) => {
	if (!user || !user.primaryEmailAddress?.emailAddress) {
		// Redirect to sign-in
		return
	}

	await handleCheckoutProcess(
		priceId,
		user.id,
		user.primaryEmailAddress.emailAddress,
		setLoading,
		setError
	)
}

// Update the button to call the function
;<button onClick={() => handlePurchase('price_1234567890')} disabled={loading}>
	Get MicroSaaSFast
</button>
```

#### Option 2: Create Checkout Links via API

Create an API endpoint to generate checkout links:

```typescript
// src/app/api/stripe/create-checkout-link/route.ts
export async function POST(req: Request) {
	const { priceId } = await req.json()

	const session = await stripe.checkout.sessions.create({
		payment_method_types: ['card'],
		line_items: [{ price: priceId, quantity: 1 }],
		mode: 'payment',
		success_url: `${req.headers.get(
			'origin'
		)}/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${req.headers.get('origin')}/cancel`,
	})

	return NextResponse.json({ url: session.url })
}
```

### Product Configuration

Update `src/config.ts` to include Stripe price IDs:

```typescript
stripe: {
  products: [
    {
      type: 'one-time',
      title: 'Starter',
      productId: 'prod_starter',
      priceId: 'price_starter_207', // Replace with actual Stripe price ID
      price: 207,
      features: [...]
    },
    {
      type: 'one-time',
      title: 'Full package',
      productId: 'prod_full',
      priceId: 'price_full_247', // Replace with actual Stripe price ID
      price: 247,
      features: [...]
    }
  ]
}
```

## Stripe Dashboard Setup

### 1. Create Products and Prices

1. Go to Stripe Dashboard → Products
2. Create products matching your config
3. Add prices for each product
4. Copy price IDs to your config

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhook/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `checkout.session.expired`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Test Mode vs Live Mode

- **Test Mode**: Use `sk_test_` and `pk_test_` keys
- **Live Mode**: Use `sk_live_` and `pk_live_` keys
- **Test Cards**: Use Stripe's test card numbers (e.g., 4242 4242 4242 4242)

## Error Handling

### Common Issues and Solutions

#### 1. Webhook Signature Verification Failed

- Check `STRIPE_WEBHOOK_SECRET` is correct
- Ensure webhook endpoint URL matches Stripe dashboard
- Verify request body isn't modified

#### 2. Price ID Not Found

- Verify price ID exists in Stripe dashboard
- Check price ID in config matches Stripe
- Ensure price is active in Stripe

#### 3. Customer Email Not Found

- Verify customer exists in Clerk
- Check email address format
- Ensure user is signed up before checkout

#### 4. Subscription Status Not Updated

- Check webhook events are being received
- Verify database connection
- Check Prisma schema matches implementation

## Testing Checklist

### Development Testing

- [ ] Stripe CLI webhook forwarding works
- [ ] Checkout session creation succeeds
- [ ] Webhook events are processed correctly
- [ ] Database updates occur as expected
- [ ] Email notifications are sent
- [ ] Subscription status changes properly

### Production Testing

- [ ] Live mode keys are configured
- [ ] Webhook endpoint is publicly accessible
- [ ] SSL certificate is valid
- [ ] Database can handle concurrent requests
- [ ] Error logging is configured
- [ ] Monitoring is set up

## Security Best Practices

1. **Never expose secret keys** in client-side code
2. **Always verify webhook signatures** before processing
3. **Use environment variables** for all sensitive data
4. **Implement proper error handling** without exposing internals
5. **Validate all input data** before processing
6. **Use HTTPS** in production
7. **Monitor webhook failures** and implement retry logic
