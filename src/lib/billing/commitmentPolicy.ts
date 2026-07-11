export const PAYMENT_GRACE_DAYS = 7

export function paymentGraceEnd(failedAt: Date): Date {
  return new Date(failedAt.getTime() + PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000)
}

export function isWithinPaymentGrace(params: {
  paymentFailedAt: Date | null
  paymentGraceEndsAt: Date | null
  now?: Date
}): boolean {
  const now = params.now ?? new Date()
  if (!params.paymentFailedAt || !params.paymentGraceEndsAt) return false
  return now.getTime() <= params.paymentGraceEndsAt.getTime()
}
