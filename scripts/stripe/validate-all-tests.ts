#!/usr/bin/env node
import Stripe from 'stripe'
import { randomUUID } from 'crypto'

interface TestSuite {
  name: string
  tests: Test[]
}

interface Test {
  name: string
  run: () => Promise<boolean>
  critical: boolean
}

interface ValidationReport {
  passed: number
  failed: number
  timestamp: string
  testSuites: {
    name: string
    status: 'PASS' | 'FAIL'
    tests: {
      name: string
      status: 'PASS' | 'FAIL'
      error?: string
    }[]
  }[]
}

class StripeTestValidator {
  private stripe: Stripe
  private secretKey: string

  constructor(secretKey: string) {
    this.secretKey = secretKey
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    })
  }

  // Test Suite 1: Product & Pricing
  private async testProductExists(): Promise<boolean> {
    const products = await this.stripe.products.list({ limit: 100 })
    const product = products.data.find((p) => p.name === 'JPV Bootcamp Membership')
    return !!product
  }

  private async testMonthlyPriceValid(): Promise<boolean> {
    const prices = await this.stripe.prices.list({ limit: 100 })
    const monthlyPrice = prices.data.find(
      (p) =>
        p.recurring?.interval === 'month' &&
        p.unit_amount === 8000 &&
        p.currency === 'gbp',
    )
    return !!monthlyPrice
  }

  private async testAnnualPriceValid(): Promise<boolean> {
    const prices = await this.stripe.prices.list({ limit: 100 })
    const annualPrice = prices.data.find(
      (p) =>
        p.recurring?.interval === 'year' &&
        p.unit_amount === 80000 &&
        p.currency === 'gbp',
    )
    return !!annualPrice
  }

  private async testPricesPointToSameProduct(): Promise<boolean> {
    const prices = await this.stripe.prices.list({ limit: 100 })
    const monthlyPrice = prices.data.find((p) => p.recurring?.interval === 'month')
    const annualPrice = prices.data.find((p) => p.recurring?.interval === 'year')

    if (!monthlyPrice || !annualPrice) return false

    const monthlyProductId =
      typeof monthlyPrice.product === 'string' ? monthlyPrice.product : monthlyPrice.product?.id
    const annualProductId =
      typeof annualPrice.product === 'string' ? annualPrice.product : annualPrice.product?.id

    return monthlyProductId === annualProductId
  }

  // Test Suite 2: Discounts & Coupons
  private async testCoupon100PercentExists(): Promise<boolean> {
    const coupons = await this.stripe.coupons.list({ limit: 100 })
    const coupon = coupons.data.find(
      (c) =>
        c.percent_off === 100 &&
        c.duration === 'repeating' &&
        c.duration_in_months === 1,
    )
    return !!coupon
  }

  private async testCouponCanBeApplied(): Promise<boolean> {
    const coupons = await this.stripe.coupons.list({ limit: 100 })
    const coupon = coupons.data.find((c) => c.percent_off === 100 && c.duration === 'repeating')

    if (!coupon) return false

    try {
      // Try to create a test checkout with coupon
      const prices = await this.stripe.prices.list({ limit: 1 })
      if (prices.data.length === 0) return false

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `test-${randomUUID()}@test.example`,
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        discounts: [{ coupon: coupon.id }],
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
      })

      return !!session.id
    } catch {
      return false
    }
  }

  // Test Suite 3: Portal & Configuration
  private async testPortalConfigurationExists(): Promise<boolean> {
    const configs = await this.stripe.billingPortal.configurations.list({ limit: 100 })
    return configs.data.length > 0
  }

  private async testPortalHasRequiredFeatures(): Promise<boolean> {
    const configs = await this.stripe.billingPortal.configurations.list({ limit: 100 })
    if (configs.data.length === 0) return false

    const config = configs.data[0]
    const requiredFeatures = [
      'subscription_update',
      'customer_update',
      'payment_method_update',
    ]

    const configFeatures = Object.keys(config.features || {})
    return requiredFeatures.every((f) => configFeatures.includes(f))
  }

  private async testPortalIsActive(): Promise<boolean> {
    const configs = await this.stripe.billingPortal.configurations.list({ limit: 100 })
    if (configs.data.length === 0) return false

    return configs.data[0].active === true
  }

  // Test Suite 4: Webhooks
  private async testWebhookEndpointExists(): Promise<boolean> {
    const endpoints = await this.stripe.webhookEndpoints.list({ limit: 100 })
    return endpoints.data.length > 0
  }

  private async testWebhookIsEnabled(): Promise<boolean> {
    const endpoints = await this.stripe.webhookEndpoints.list({ limit: 100 })
    if (endpoints.data.length === 0) return false

    return endpoints.data[0].status === 'enabled'
  }

  private async testWebhookHasRequiredEvents(): Promise<boolean> {
    const endpoints = await this.stripe.webhookEndpoints.list({ limit: 100 })
    if (endpoints.data.length === 0) return false

    const endpoint = endpoints.data[0]
    const requiredEvents = [
      'checkout.session.completed',
      'customer.subscription.created',
      'invoice.paid',
    ]

    return requiredEvents.every((event) => endpoint.enabled_events.includes(event))
  }

  // Test Suite 5: Checkout Flows
  private async testCanCreateCheckoutSession(): Promise<boolean> {
    try {
      const prices = await this.stripe.prices.list({ limit: 1 })
      if (prices.data.length === 0) return false

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `test-${randomUUID()}@test.example`,
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
      })

      return !!session.url
    } catch {
      return false
    }
  }

  private async testCanCreateCheckoutWithMetadata(): Promise<boolean> {
    try {
      const prices = await this.stripe.prices.list({ limit: 1 })
      if (prices.data.length === 0) return false

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `test-${randomUUID()}@test.example`,
        line_items: [{ price: prices.data[0].id, quantity: 1 }],
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
        metadata: { test_type: 'validation', client_reference_id: 'test-123' },
      })

      return session.metadata?.test_type === 'validation'
    } catch {
      return false
    }
  }

  private async testCanCreatePayItForwardCheckout(): Promise<boolean> {
    try {
      const prices = await this.stripe.prices.list({ limit: 1 })
      if (prices.data.length === 0) return false

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: `test-${randomUUID()}@test.example`,
        line_items: [{ price: prices.data[0].id, quantity: 3 }], // Multiple seats
        success_url: 'http://localhost:3000/thank-you/sponsor',
        cancel_url: 'http://localhost:3000/pricing',
        metadata: { sponsored_seats: '3' },
      })

      return session.line_items?.data[0]?.quantity === 3
    } catch {
      return false
    }
  }

  // Test Suite 6: Data Integrity
  private async testNoOrphanedPrices(): Promise<boolean> {
    const prices = await this.stripe.prices.list({ limit: 100 })

    for (const price of prices.data) {
      const productId = typeof price.product === 'string' ? price.product : price.product?.id

      if (!productId) return false

      try {
        await this.stripe.products.retrieve(productId)
      } catch {
        return false
      }
    }

    return true
  }

  private async testCurrencyConsistency(): Promise<boolean> {
    const prices = await this.stripe.prices.list({ limit: 100 })
    const currencies = [...new Set(prices.data.map((p) => p.currency))]

    return currencies.length === 1 && currencies[0] === 'gbp'
  }

  private async testProductMetadataPresent(): Promise<boolean> {
    const products = await this.stripe.products.list({ limit: 100 })
    const product = products.data.find((p) => p.name === 'JPV Bootcamp Membership')

    if (!product) return false

    return !!product.metadata?.product_type
  }

  // Test Suite 7: API Version & Configuration
  private async testAPIVersionSupported(): Promise<boolean> {
    try {
      // This implicitly tests that the API version is supported
      await this.stripe.products.list({ limit: 1 })
      return true
    } catch {
      return false
    }
  }

  // Build test suites
  private buildTestSuites(): TestSuite[] {
    return [
      {
        name: 'Product & Pricing Configuration',
        tests: [
          {
            name: 'JPV Bootcamp Membership product exists',
            run: () => this.testProductExists(),
            critical: true,
          },
          {
            name: 'Monthly price (GBP 80) is valid',
            run: () => this.testMonthlyPriceValid(),
            critical: true,
          },
          {
            name: 'Annual price (GBP 800) is valid',
            run: () => this.testAnnualPriceValid(),
            critical: true,
          },
          {
            name: 'Monthly and annual prices point to same product',
            run: () => this.testPricesPointToSameProduct(),
            critical: true,
          },
        ],
      },
      {
        name: 'Discounts & Coupons',
        tests: [
          {
            name: '100% discount coupon (1-month) exists',
            run: () => this.testCoupon100PercentExists(),
            critical: true,
          },
          {
            name: 'Coupon can be applied to checkout',
            run: () => this.testCouponCanBeApplied(),
            critical: false,
          },
        ],
      },
      {
        name: 'Customer Portal Configuration',
        tests: [
          {
            name: 'Billing Portal configuration exists',
            run: () => this.testPortalConfigurationExists(),
            critical: true,
          },
          {
            name: 'Portal has required features enabled',
            run: () => this.testPortalHasRequiredFeatures(),
            critical: true,
          },
          {
            name: 'Portal configuration is active',
            run: () => this.testPortalIsActive(),
            critical: true,
          },
        ],
      },
      {
        name: 'Webhook Configuration',
        tests: [
          {
            name: 'Webhook endpoint exists',
            run: () => this.testWebhookEndpointExists(),
            critical: true,
          },
          {
            name: 'Webhook is enabled',
            run: () => this.testWebhookIsEnabled(),
            critical: true,
          },
          {
            name: 'Webhook has required events',
            run: () => this.testWebhookHasRequiredEvents(),
            critical: true,
          },
        ],
      },
      {
        name: 'Checkout & Payment Flows',
        tests: [
          {
            name: 'Can create checkout session',
            run: () => this.testCanCreateCheckoutSession(),
            critical: true,
          },
          {
            name: 'Checkout preserves metadata',
            run: () => this.testCanCreateCheckoutWithMetadata(),
            critical: false,
          },
          {
            name: 'Can create pay-it-forward checkout (multiple seats)',
            run: () => this.testCanCreatePayItForwardCheckout(),
            critical: true,
          },
        ],
      },
      {
        name: 'Data Integrity & Consistency',
        tests: [
          {
            name: 'No orphaned prices (all reference valid products)',
            run: () => this.testNoOrphanedPrices(),
            critical: true,
          },
          {
            name: 'All prices use consistent currency (GBP)',
            run: () => this.testCurrencyConsistency(),
            critical: true,
          },
          {
            name: 'Product metadata is present',
            run: () => this.testProductMetadataPresent(),
            critical: false,
          },
        ],
      },
      {
        name: 'API & Configuration Support',
        tests: [
          {
            name: 'Stripe API version is supported',
            run: () => this.testAPIVersionSupported(),
            critical: true,
          },
        ],
      },
    ]
  }

  // Run all tests
  async runAllTests(): Promise<ValidationReport> {
    const testSuites = this.buildTestSuites()
    const report: ValidationReport = {
      passed: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
      testSuites: [],
    }

    console.log('\n' + '='.repeat(70))
    console.log('STRIPE MEMBERSHIP CONFIGURATION VALIDATION SUITE')
    console.log('='.repeat(70) + '\n')

    for (const suite of testSuites) {
      console.log(`\n📋 ${suite.name}`)
      console.log('-'.repeat(70))

      const suiteResult: (typeof report.testSuites)[0] = {
        name: suite.name,
        status: 'PASS',
        tests: [],
      }

      for (const test of suite.tests) {
        try {
          const passed = await test.run()
          const status = passed ? 'PASS' : 'FAIL'
          const icon = passed ? '✓' : '✗'

          console.log(`  ${icon} ${test.name}`)

          suiteResult.tests.push({ name: test.name, status: status as 'PASS' | 'FAIL' })

          if (passed) {
            report.passed++
          } else {
            report.failed++
            suiteResult.status = 'FAIL'
            if (test.critical) {
              console.log(`    ⚠️  CRITICAL TEST FAILED`)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.log(`  ✗ ${test.name}`)
          console.log(`    Error: ${message}`)

          suiteResult.tests.push({
            name: test.name,
            status: 'FAIL',
            error: message,
          })

          report.failed++
          suiteResult.status = 'FAIL'
        }
      }

      report.testSuites.push(suiteResult)
    }

    // Print summary
    console.log('\n' + '='.repeat(70))
    console.log('VALIDATION SUMMARY')
    console.log('='.repeat(70))
    console.log(`\nTests Passed: ${report.passed}`)
    console.log(`Tests Failed: ${report.failed}`)
    console.log(`Total Tests:  ${report.passed + report.failed}`)
    console.log(
      `Status:       ${report.failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`,
    )
    console.log(`Timestamp:    ${report.timestamp}\n`)

    return report
  }
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    console.error('❌ ERROR: STRIPE_SECRET_KEY not set in environment')
    process.exit(1)
  }

  if (!secretKey.startsWith('sk_test_')) {
    console.error('❌ ERROR: Must use test-mode keys (sk_test_*)')
    process.exit(1)
  }

  const validator = new StripeTestValidator(secretKey)

  try {
    const report = await validator.runAllTests()

    // Output JSON report
    if (process.argv[2] === '--json') {
      console.log('\n' + '='.repeat(70))
      console.log('JSON REPORT')
      console.log('='.repeat(70))
      console.log(JSON.stringify(report, null, 2))
    }

    process.exit(report.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error(
      '\n❌ Validation error:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

main()
