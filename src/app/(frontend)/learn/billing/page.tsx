import { redirect } from 'next/navigation'

type LearnBillingPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const ALLOWED_CHECKOUT_VALUES = new Set(['success', 'cancelled'])
const ALLOWED_CANCELLATION_ERROR_VALUES = new Set([
  'billing_record_missing',
  'effective_date_missing',
  'invalid_email',
])

export default async function LearnBillingPage({ searchParams }: LearnBillingPageProps) {
  const params = await searchParams
  const redirectParams = new URLSearchParams()

  const checkout = firstParam(params.checkout)
  if (checkout && ALLOWED_CHECKOUT_VALUES.has(checkout)) {
    redirectParams.set('checkout', checkout)
  }

  if (firstParam(params.cancellation_requested) === '1') {
    redirectParams.set('cancellation_requested', '1')
  }

  const cancellationEffectiveAt = firstParam(params.cancellation_effective_at)
  if (cancellationEffectiveAt) {
    redirectParams.set('cancellation_effective_at', cancellationEffectiveAt)
  }

  const cancellationError = firstParam(params.cancellation_error)
  if (cancellationError && ALLOWED_CANCELLATION_ERROR_VALUES.has(cancellationError)) {
    redirectParams.set('cancellation_error', cancellationError)
  }

  const destination = redirectParams.size > 0 ? `/portal/billing?${redirectParams.toString()}` : '/portal/billing'
  redirect(destination)
}
