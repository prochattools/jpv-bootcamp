export type CheckoutPlan = 'membership'
export type CheckoutBilling = 'monthly' | 'annual'

export type CheckoutPriceConfig = {
  pricePro: string
  priceProAnnual: string
}

export const DEFAULT_STRIPE_SUCCESS_PATH = '/thank-you?session_id={CHECKOUT_SESSION_ID}'

export function parseCheckoutPlan(value: string | null | undefined): CheckoutPlan | null {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'membership' || normalized === 'jpv_bootcamp_membership'
    ? 'membership'
    : null
}

export function resolveCheckoutBilling(value: string | null | undefined): CheckoutBilling {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'annual' ? 'annual' : 'monthly'
}

export function getCheckoutPriceId(
  _plan: CheckoutPlan,
  billing: CheckoutBilling,
  stripeConfig: CheckoutPriceConfig,
) {
  return billing === 'annual' ? stripeConfig.priceProAnnual : stripeConfig.pricePro
}

export function buildSameOriginReturnUrl(pathOrUrl: string, appUrl: string, label: string) {
  const appOrigin = new URL(appUrl).origin
  const resolved = new URL(pathOrUrl, appUrl)

  if (resolved.origin !== appOrigin) {
    throw new Error(`${label} must be same-origin with APP_PUBLIC_URL.`)
  }

  return resolved.toString()
}
