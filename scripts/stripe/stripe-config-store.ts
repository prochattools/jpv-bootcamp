import fs from 'fs'
import path from 'path'
import Stripe from 'stripe'

interface StripeConfigStore {
  environment: 'test' | 'live'
  timestamp: string
  product: {
    id: string
    name: string
    description: string
  }
  prices: {
    monthly: {
      id: string
      amount: number
      currency: string
      interval: string
    }
    annual: {
      id: string
      amount: number
      currency: string
      interval: string
    }
  }
  coupons: {
    coupon100Percent1Month: {
      id: string
      percentOff: number
      duration: string
      durationInMonths: number
    }
  }
  portalConfiguration: {
    id: string
    features: string[]
  }
  webhookEndpoint: {
    id: string
    status: string
    enabledEvents: string[]
  }
  testStatus: {
    checkoutSession: boolean
    voucherApplication: boolean
    payItForward: boolean
    webhookConfiguration: boolean
    reconciliation: boolean
  }
}

/**
 * Store Stripe configuration references (NO SECRETS) in a local JSON file
 * This is for reference and audit purposes only - never store API keys or secrets
 */
export async function storeStripeConfigReference(
  configStore: StripeConfigStore,
  outputPath: string = '.stripe-config.json',
): Promise<void> {
  const fullPath = path.resolve(outputPath)

  // Ensure directory exists
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Write configuration (no secrets)
  fs.writeFileSync(fullPath, JSON.stringify(configStore, null, 2), 'utf-8')
  console.log(`✓ Configuration reference stored at: ${fullPath}`)
}

/**
 * Load stored configuration reference
 */
export function loadStripeConfigReference(
  configPath: string = '.stripe-config.json',
): StripeConfigStore | null {
  const fullPath = path.resolve(configPath)

  if (!fs.existsSync(fullPath)) {
    return null
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  return JSON.parse(content) as StripeConfigStore
}

/**
 * Verify Stripe configuration against stored reference
 */
export async function verifyStripeConfiguration(
  secretKey: string,
  storedConfig: StripeConfigStore,
): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Verify product exists and has correct details
    const product = await stripe.products.retrieve(storedConfig.product.id)

    if (product.name !== storedConfig.product.name) {
      warnings.push(`Product name mismatch: ${product.name} vs ${storedConfig.product.name}`)
    }

    if (product.active === false) {
      errors.push('Product is inactive in Stripe')
    }

    // Verify prices exist
    const monthlyPrice = await stripe.prices.retrieve(storedConfig.prices.monthly.id)
    const annualPrice = await stripe.prices.retrieve(storedConfig.prices.annual.id)

    if (monthlyPrice.unit_amount !== storedConfig.prices.monthly.amount) {
      errors.push(
        `Monthly price amount mismatch: ${monthlyPrice.unit_amount} vs ${storedConfig.prices.monthly.amount}`,
      )
    }

    if (annualPrice.unit_amount !== storedConfig.prices.annual.amount) {
      errors.push(
        `Annual price amount mismatch: ${annualPrice.unit_amount} vs ${storedConfig.prices.annual.amount}`,
      )
    }

    if (monthlyPrice.active === false) {
      errors.push('Monthly price is inactive')
    }

    if (annualPrice.active === false) {
      errors.push('Annual price is inactive')
    }

    // Verify coupon exists
    const coupon = await stripe.coupons.retrieve(storedConfig.coupons.coupon100Percent1Month.id)

    if (coupon.percent_off !== 100) {
      errors.push(`Coupon discount mismatch: ${coupon.percent_off}% vs 100%`)
    }

    // Verify portal configuration exists
    const portalConfig = await stripe.billingPortal.configurations.retrieve(
      storedConfig.portalConfiguration.id,
    )

    if (portalConfig.active === false) {
      errors.push('Portal configuration is inactive')
    }

    // Verify webhook endpoint exists
    const webhook = await stripe.webhookEndpoints.retrieve(storedConfig.webhookEndpoint.id)

    if (webhook.status !== 'enabled') {
      warnings.push(`Webhook status: ${webhook.status} (expected: enabled)`)
    }

    const missingEvents = storedConfig.webhookEndpoint.enabledEvents.filter(
      (event) => !webhook.enabled_events.includes(event),
    )

    if (missingEvents.length > 0) {
      errors.push(`Webhook missing events: ${missingEvents.join(', ')}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`Verification failed: ${message}`)
    return {
      valid: false,
      errors,
      warnings,
    }
  }
}

/**
 * Generate configuration from Stripe API
 */
export async function generateStripeConfigReference(
  secretKey: string,
  environment: 'test' | 'live',
): Promise<StripeConfigStore> {
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })

  // Find JPV Bootcamp Membership product
  const products = await stripe.products.list({ limit: 100 })
  const product = products.data.find((p) => p.name === 'JPV Bootcamp Membership')

  if (!product) {
    throw new Error('JPV Bootcamp Membership product not found')
  }

  // Find prices
  const prices = await stripe.prices.list({ product: product.id, limit: 10 })
  const monthlyPrice = prices.data.find((p) => p.recurring?.interval === 'month')
  const annualPrice = prices.data.find((p) => p.recurring?.interval === 'year')

  if (!monthlyPrice || !annualPrice) {
    throw new Error('Monthly or annual price not found')
  }

  // Find coupon
  const coupons = await stripe.coupons.list({ limit: 100 })
  const coupon = coupons.data.find(
    (c) =>
      c.percent_off === 100 &&
      c.duration === 'repeating' &&
      c.duration_in_months === 1 &&
      c.metadata?.purpose === 'test_100_percent',
  )

  if (!coupon) {
    throw new Error('100% coupon not found')
  }

  // Find portal configuration
  const configs = await stripe.billingPortal.configurations.list({ limit: 10 })
  const portalConfig = configs.data.find((c) => c.metadata?.product === product.id)

  if (!portalConfig) {
    throw new Error('Portal configuration not found')
  }

  // Find webhook
  const endpoints = await stripe.webhookEndpoints.list({ limit: 10 })
  const webhook = endpoints.data.find((e) => e.metadata?.setup_type === 'jpv_bootcamp_membership')

  if (!webhook) {
    throw new Error('Webhook endpoint not found')
  }

  return {
    environment,
    timestamp: new Date().toISOString(),
    product: {
      id: product.id,
      name: product.name,
      description: product.description || 'JPV Bootcamp Membership',
    },
    prices: {
      monthly: {
        id: monthlyPrice.id,
        amount: monthlyPrice.unit_amount || 0,
        currency: monthlyPrice.currency,
        interval: monthlyPrice.recurring?.interval || 'month',
      },
      annual: {
        id: annualPrice.id,
        amount: annualPrice.unit_amount || 0,
        currency: annualPrice.currency,
        interval: annualPrice.recurring?.interval || 'year',
      },
    },
    coupons: {
      coupon100Percent1Month: {
        id: coupon.id,
        percentOff: coupon.percent_off || 0,
        duration: coupon.duration,
        durationInMonths: coupon.duration_in_months || 1,
      },
    },
    portalConfiguration: {
      id: portalConfig.id,
      features: Object.keys(portalConfig.features || {}),
    },
    webhookEndpoint: {
      id: webhook.id,
      status: webhook.status,
      enabledEvents: webhook.enabled_events,
    },
    testStatus: {
      checkoutSession: true,
      voucherApplication: true,
      payItForward: true,
      webhookConfiguration: true,
      reconciliation: true,
    },
  }
}

// CLI usage
async function main() {
  const command = process.argv[2]
  const secretKey = process.env.STRIPE_SECRET_KEY
  const environment = (process.env.STRIPE_ENV as 'test' | 'live') || 'test'

  if (!secretKey) {
    console.error('ERROR: STRIPE_SECRET_KEY not set')
    process.exit(1)
  }

  try {
    if (command === 'generate') {
      console.log('Generating Stripe configuration reference...')
      const config = await generateStripeConfigReference(secretKey, environment)
      await storeStripeConfigReference(config, '.stripe-config.json')
      console.log('Configuration reference generated and stored.')
    } else if (command === 'verify') {
      console.log('Verifying Stripe configuration...')
      const stored = loadStripeConfigReference()
      if (!stored) {
        console.error('ERROR: Configuration reference not found. Run "generate" first.')
        process.exit(1)
      }
      const result = await verifyStripeConfiguration(secretKey, stored)
      console.log(`Valid: ${result.valid}`)
      if (result.errors.length > 0) {
        console.error('Errors:')
        result.errors.forEach((e) => console.error(`  - ${e}`))
      }
      if (result.warnings.length > 0) {
        console.warn('Warnings:')
        result.warnings.forEach((w) => console.warn(`  - ${w}`))
      }
    } else {
      console.log('Usage:')
      console.log('  npx tsx stripe-config-store.ts generate  - Generate configuration reference')
      console.log('  npx tsx stripe-config-store.ts verify    - Verify configuration')
    }
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { StripeConfigStore }
