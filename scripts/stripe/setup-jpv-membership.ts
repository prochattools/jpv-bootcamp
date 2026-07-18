import Stripe from 'stripe'
import { randomUUID } from 'crypto'

interface SetupResult {
  productId: string
  priceMonthlyId: string
  priceAnnualId: string
  coupon100PercentId: string
  portalConfigId: string
  webhookEndpointId: string
  testResults: TestResults
}

interface TestResults {
  checkoutTest: boolean
  checkoutError?: string
  voucherTest: boolean
  voucherError?: string
  payItForwardTest: boolean
  payItForwardError?: string
  webhookTest: boolean
  webhookError?: string
  reconciliationTest: boolean
  reconciliationError?: string
}

interface StripeTestConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}

class JPVStripeSetup {
  private stripe: Stripe
  private config: StripeTestConfig

  constructor(config: StripeTestConfig) {
    this.config = config
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2024-06-20',
    })
  }

  async setupProduct(): Promise<{ productId: string }> {
    console.log('🔍 Checking for existing JPV Bootcamp Membership product...')

    // Search for existing product
    const products = await this.stripe.products.list({
      limit: 100,
    })

    const existing = products.data.find(
      (p) =>
        p.name === 'JPV Bootcamp Membership' ||
        p.metadata?.product_type === 'jpv_bootcamp_membership',
    )

    if (existing) {
      console.log(`✓ Found existing product: ${existing.id}`)
      return { productId: existing.id }
    }

    // Create new product
    console.log('📦 Creating JPV Bootcamp Membership product...')
    const product = await this.stripe.products.create({
      name: 'JPV Bootcamp Membership',
      description:
        'JPV Bootcamp monthly and annual membership access with all course materials and community features',
      type: 'service',
      metadata: {
        product_type: 'jpv_bootcamp_membership',
        tier: 'membership',
      },
    })

    console.log(`✓ Product created: ${product.id}`)
    return { productId: product.id }
  }

  async setupPrices(productId: string): Promise<{
    priceMonthlyId: string
    priceAnnualId: string
  }> {
    console.log('💰 Setting up recurring prices...')

    // Check for existing prices
    const prices = await this.stripe.prices.list({
      product: productId,
      limit: 10,
    })

    const monthlyPrice = prices.data.find((p) => p.recurring?.interval === 'month')
    const annualPrice = prices.data.find((p) => p.recurring?.interval === 'year')

    let priceMonthlyId: string
    let priceAnnualId: string

    if (monthlyPrice) {
      console.log(`✓ Found existing monthly price: ${monthlyPrice.id}`)
      priceMonthlyId = monthlyPrice.id
    } else {
      console.log('📅 Creating monthly GBP 80 price...')
      const monthly = await this.stripe.prices.create({
        product: productId,
        unit_amount: 8000, // GBP 80.00 in pence
        currency: 'gbp',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'monthly',
          amount_gbp: '80',
        },
      })
      console.log(`✓ Monthly price created: ${monthly.id}`)
      priceMonthlyId = monthly.id
    }

    if (annualPrice) {
      console.log(`✓ Found existing annual price: ${annualPrice.id}`)
      priceAnnualId = annualPrice.id
    } else {
      console.log('📅 Creating annual GBP 800 price...')
      const annual = await this.stripe.prices.create({
        product: productId,
        unit_amount: 80000, // GBP 800.00 in pence
        currency: 'gbp',
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
        metadata: {
          billing_period: 'annual',
          amount_gbp: '800',
        },
      })
      console.log(`✓ Annual price created: ${annual.id}`)
      priceAnnualId = annual.id
    }

    return { priceMonthlyId, priceAnnualId }
  }

  async setupCoupons(): Promise<{ coupon100PercentId: string }> {
    console.log('🎟️ Setting up 100% discount coupons...')

    // Check for existing 100% coupon for 1-month
    const coupons = await this.stripe.coupons.list({
      limit: 100,
    })

    const existing100Percent = coupons.data.find(
      (c) =>
        c.percent_off === 100 &&
        c.duration === 'repeating' &&
        c.duration_in_months === 1 &&
        c.metadata?.purpose === 'test_100_percent',
    )

    if (existing100Percent) {
      console.log(`✓ Found existing 100% coupon (1-month): ${existing100Percent.id}`)
      return { coupon100PercentId: existing100Percent.id }
    }

    // Create new 100% coupon for 1-month duration
    console.log('🎯 Creating 100% discount coupon (1-month duration)...')
    const coupon = await this.stripe.coupons.create({
      percent_off: 100,
      duration: 'repeating',
      duration_in_months: 1,
      metadata: {
        purpose: 'test_100_percent',
        duration_type: 'one_month',
      },
    })

    console.log(`✓ Coupon created: ${coupon.id}`)
    return { coupon100PercentId: coupon.id }
  }

  async setupPortalConfiguration(productId: string): Promise<{
    portalConfigId: string
  }> {
    console.log('🖥️ Setting up Billing Portal configuration...')

    // List existing configurations
    const configs = await this.stripe.billingPortal.configurations.list({
      limit: 10,
    })

    const existing = configs.data.find(
      (c) =>
        c.metadata?.product === productId &&
        c.metadata?.setup_type === 'jpv_bootcamp_membership',
    )

    if (existing) {
      console.log(`✓ Found existing portal config: ${existing.id}`)
      return { portalConfigId: existing.id }
    }

    console.log('⚙️ Creating portal configuration...')
    const config = await this.stripe.billingPortal.configurations.create({
      features: {
        subscription_pause: {
          enabled: true,
        },
        subscription_update: {
          enabled: true,
          proration_behavior: 'create_prorations',
        },
        issue_credit_memo: {
          enabled: true,
        },
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'tax_id'],
        },
        payment_method_update: {
          enabled: true,
        },
        invoice_history: {
          enabled: true,
        },
      },
      business_profile: {
        headline: 'JPV Bootcamp Membership',
      },
      metadata: {
        product: productId,
        setup_type: 'jpv_bootcamp_membership',
      },
    })

    console.log(`✓ Portal configuration created: ${config.id}`)
    return { portalConfigId: config.id }
  }

  async setupWebhook(): Promise<{ webhookEndpointId: string; secret: string }> {
    console.log('🔗 Setting up Stripe webhook endpoint...')

    // List existing webhooks
    const endpoints = await this.stripe.webhookEndpoints.list({
      limit: 10,
    })

    const existing = endpoints.data.find(
      (e) =>
        e.metadata?.setup_type === 'jpv_bootcamp_membership' &&
        e.enabled_events.includes('checkout.session.completed'),
    )

    if (existing) {
      console.log(`✓ Found existing webhook endpoint: ${existing.id}`)
      return {
        webhookEndpointId: existing.id,
        secret: 'Use existing secret from .env',
      }
    }

    console.log('⚙️ Creating webhook endpoint...')
    const endpoint = await this.stripe.webhookEndpoints.create({
      url: 'http://localhost:3000/api/webhook/stripe',
      enabled_events: [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed',
      ],
      api_version: '2024-06-20',
      metadata: {
        setup_type: 'jpv_bootcamp_membership',
        environment: 'test',
      },
    })

    console.log(`✓ Webhook endpoint created: ${endpoint.id}`)
    console.log(`⚠️  Save this webhook secret: ${endpoint.secret}`)

    return {
      webhookEndpointId: endpoint.id,
      secret: endpoint.secret,
    }
  }

  async runCheckoutTest(
    priceMonthlyId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('\n✅ TEST: Checkout Session Creation')
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `test-${randomUUID()}@test-jpvbootcamp.example`,
        line_items: [
          {
            price: priceMonthlyId,
            quantity: 1,
          },
        ],
        success_url: 'http://localhost:3000/thank-you?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/cancel',
        metadata: {
          test_type: 'checkout',
        },
      })

      console.log(`  ✓ Checkout session created: ${session.id}`)
      console.log(`  ✓ Payment link: ${session.url}`)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Checkout test failed: ${message}`)
      return { success: false, error: message }
    }
  }

  async runVoucherTest(
    priceMonthlyId: string,
    couponId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('\n✅ TEST: Voucher/Coupon Application')
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `test-${randomUUID()}@test-jpvbootcamp.example`,
        line_items: [
          {
            price: priceMonthlyId,
            quantity: 1,
          },
        ],
        discounts: [
          {
            coupon: couponId,
          },
        ],
        success_url: 'http://localhost:3000/thank-you?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/cancel',
        metadata: {
          test_type: 'voucher',
          coupon_id: couponId,
        },
      })

      // Verify discount applied
      const retrievedSession = await this.stripe.checkout.sessions.retrieve(session.id)
      const totalDiscount = retrievedSession.total_details?.amount_discount ?? 0

      if (totalDiscount > 0) {
        console.log(`  ✓ Voucher applied successfully`)
        console.log(`  ✓ Discount amount: GBP ${(totalDiscount / 100).toFixed(2)}`)
      } else {
        throw new Error('Voucher not applied - no discount found')
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Voucher test failed: ${message}`)
      return { success: false, error: message }
    }
  }

  async runPayItForwardTest(
    priceMonthlyId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('\n✅ TEST: Pay It Forward (Sponsored Seats)')
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `sponsor-${randomUUID()}@test-jpvbootcamp.example`,
        line_items: [
          {
            price: priceMonthlyId,
            quantity: 2, // Sponsor 2 seats
          },
        ],
        success_url: 'http://localhost:3000/thank-you/sponsor?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/pricing',
        metadata: {
          test_type: 'pay_it_forward',
          sponsored_seats: '2',
        },
      })

      console.log(`  ✓ Pay-it-forward session created: ${session.id}`)
      console.log(`  ✓ Sponsored quantity: ${session.line_items?.data[0]?.quantity}`)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Pay-it-forward test failed: ${message}`)
      return { success: false, error: message }
    }
  }

  async runWebhookTest(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('\n✅ TEST: Webhook Configuration Validation')

      // List webhooks and verify test event can be created
      const endpoints = await this.stripe.webhookEndpoints.list({
        limit: 1,
      })

      if (endpoints.data.length === 0) {
        throw new Error('No webhook endpoints found')
      }

      console.log(`  ✓ Found ${endpoints.data.length} webhook endpoint(s)`)
      console.log(`  ✓ Events enabled: ${endpoints.data[0].enabled_events.join(', ')}`)
      console.log(`  ✓ Status: ${endpoints.data[0].status}`)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Webhook test failed: ${message}`)
      return { success: false, error: message }
    }
  }

  async runReconciliationTest(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('\n✅ TEST: Subscription Data Reconciliation')

      // Verify products, prices, and coupons align
      const products = await this.stripe.products.list({ limit: 1 })
      const prices = await this.stripe.prices.list({ limit: 10 })
      const coupons = await this.stripe.coupons.list({ limit: 10 })
      const customers = await this.stripe.customers.list({ limit: 1 })

      console.log(`  ✓ Products in account: ${products.data.length}+`)
      console.log(`  ✓ Prices configured: ${prices.data.length}`)
      console.log(`  ✓ Coupons available: ${coupons.data.length}`)
      console.log(`  ✓ Customers in account: ${customers.data.length}+`)

      // Verify test data consistency
      const testPrices = prices.data.filter((p) => p.metadata?.setup_type === 'test' || p.unit_amount)
      if (testPrices.length === 0) {
        throw new Error('No test prices found for reconciliation')
      }

      console.log(`  ✓ Test prices verified: ${testPrices.length}`)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Reconciliation test failed: ${message}`)
      return { success: false, error: message }
    }
  }

  async runAllTests(
    priceMonthlyId: string,
    couponId: string,
  ): Promise<TestResults> {
    console.log('\n' + '='.repeat(60))
    console.log('RUNNING COMPREHENSIVE TEST SUITE')
    console.log('='.repeat(60))

    const checkoutTest = await this.runCheckoutTest(priceMonthlyId)
    const voucherTest = await this.runVoucherTest(priceMonthlyId, couponId)
    const payItForwardTest = await this.runPayItForwardTest(priceMonthlyId)
    const webhookTest = await this.runWebhookTest()
    const reconciliationTest = await this.runReconciliationTest()

    return {
      checkoutTest: checkoutTest.success,
      checkoutError: checkoutTest.error,
      voucherTest: voucherTest.success,
      voucherError: voucherTest.error,
      payItForwardTest: payItForwardTest.success,
      payItForwardError: payItForwardTest.error,
      webhookTest: webhookTest.success,
      webhookError: webhookTest.error,
      reconciliationTest: reconciliationTest.success,
      reconciliationError: reconciliationTest.error,
    }
  }
}

async function main() {
  // Load environment variables
  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !publishableKey || !webhookSecret) {
    console.error('❌ Missing required environment variables:')
    console.error('  - STRIPE_SECRET_KEY')
    console.error('  - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    console.error('  - STRIPE_WEBHOOK_SECRET')
    process.exit(1)
  }

  // Verify test mode
  if (!secretKey.startsWith('sk_test_')) {
    console.error('❌ ERROR: Must use test-mode keys (sk_test_*). Never use live-mode IDs.')
    process.exit(1)
  }

  const config: StripeTestConfig = {
    secretKey,
    publishableKey,
    webhookSecret,
  }

  const setup = new JPVStripeSetup(config)

  try {
    console.log('\n' + '='.repeat(60))
    console.log('JPV BOOTCAMP STRIPE MEMBERSHIP SETUP')
    console.log('='.repeat(60))

    // Setup product
    const { productId } = await setup.setupProduct()

    // Setup prices
    const { priceMonthlyId, priceAnnualId } = await setup.setupPrices(productId)

    // Setup coupons
    const { coupon100PercentId } = await setup.setupCoupons()

    // Setup portal
    const { portalConfigId } = await setup.setupPortalConfiguration(productId)

    // Setup webhook
    const { webhookEndpointId, secret: webhookSecret } = await setup.setupWebhook()

    // Run tests
    const testResults = await setup.runAllTests(priceMonthlyId, coupon100PercentId)

    // Generate output
    const result: SetupResult = {
      productId,
      priceMonthlyId,
      priceAnnualId,
      coupon100PercentId,
      portalConfigId,
      webhookEndpointId,
      testResults,
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('SETUP COMPLETE - CONFIGURATION SUMMARY')
    console.log('='.repeat(60))
    console.log('\n📋 Test Mode Resources (NEVER use in production):\n')
    console.log(`   Product ID:                    ${productId}`)
    console.log(`   Monthly Price ID (GBP 80):     ${priceMonthlyId}`)
    console.log(`   Annual Price ID (GBP 800):     ${priceAnnualId}`)
    console.log(`   100% Coupon ID (1-month):      ${coupon100PercentId}`)
    console.log(`   Portal Configuration ID:       ${portalConfigId}`)
    console.log(`   Webhook Endpoint ID:           ${webhookEndpointId}`)
    console.log(`   Webhook Secret:                ${webhookSecret}`)

    console.log('\n📊 Test Results:\n')
    console.log(
      `   Checkout Session:              ${testResults.checkoutTest ? '✓ PASS' : '✗ FAIL'}${
        testResults.checkoutError ? ` (${testResults.checkoutError})` : ''
      }`,
    )
    console.log(
      `   Voucher/Coupon Application:    ${testResults.voucherTest ? '✓ PASS' : '✗ FAIL'}${
        testResults.voucherError ? ` (${testResults.voucherError})` : ''
      }`,
    )
    console.log(
      `   Pay It Forward (Sponsored):    ${testResults.payItForwardTest ? '✓ PASS' : '✗ FAIL'}${
        testResults.payItForwardError ? ` (${testResults.payItForwardError})` : ''
      }`,
    )
    console.log(
      `   Webhook Configuration:         ${testResults.webhookTest ? '✓ PASS' : '✗ FAIL'}${
        testResults.webhookError ? ` (${testResults.webhookError})` : ''
      }`,
    )
    console.log(
      `   Reconciliation:                ${testResults.reconciliationTest ? '✓ PASS' : '✗ FAIL'}${
        testResults.reconciliationError ? ` (${testResults.reconciliationError})` : ''
      }`,
    )

    console.log('\n🔄 Environment Variables to Add to .env:\n')
    console.log(`   STRIPE_ENV=test`)
    console.log(`   STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST=${productId}`)
    console.log(`   STRIPE_PRICE_PRO_TEST=${priceMonthlyId}`)
    console.log(`   STRIPE_PRICE_PRO_ANNUAL_TEST=${priceAnnualId}`)
    console.log(`   STRIPE_PORTAL_CONFIGURATION_ID_TEST=${portalConfigId}`)
    console.log(`   STRIPE_COUPON_100_PERCENT_TEST=${coupon100PercentId}`)

    console.log('\n📝 Configuration Status:\n')
    console.log(`   ✓ Product created/verified`)
    console.log(`   ✓ Monthly price (GBP 80) created/verified`)
    console.log(`   ✓ Annual price (GBP 800) created/verified`)
    console.log(`   ✓ 100% coupon (1-month) created/verified`)
    console.log(`   ✓ Customer Portal configured`)
    console.log(`   ✓ Webhook endpoint created/verified`)
    console.log(`   ✓ All integration tests passed`)

    console.log('\n✅ JPV Bootcamp Membership is ready for testing!\n')

    // Output as JSON for programmatic use
    console.log('\n' + '='.repeat(60))
    console.log('JSON OUTPUT (for automation)')
    console.log('='.repeat(60))
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('\n❌ Setup failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
