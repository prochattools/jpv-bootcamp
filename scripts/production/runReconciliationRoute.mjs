const allowedModes = new Set(['identity-dry-run', 'identity-apply'])
const mode = process.env.JPV_RECONCILIATION_MODE?.trim() || ''
const expectedRaw = process.env.JPV_RECONCILIATION_EXPECTED_UNMATCHED?.trim() || ''
const workerSecret = process.env.BILLING_RECONCILIATION_WORKER_SECRET?.trim() || ''

if (!allowedModes.has(mode)) {
  console.error('JPV_RECONCILIATION_FAILED invalid_mode')
  process.exit(1)
}

if (!workerSecret) {
  console.error('JPV_RECONCILIATION_FAILED worker_secret_not_configured')
  process.exit(1)
}

if (mode === 'identity-apply' && !/^\d+$/.test(expectedRaw)) {
  console.error('JPV_RECONCILIATION_FAILED expected_unmatched_required')
  process.exit(1)
}

const expectedUnmatched = expectedRaw === '' ? 0 : Number(expectedRaw)
const response = await fetch('http://127.0.0.1:3000/api/admin/reconcile-stripe-billing', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${workerSecret}`,
    'content-type': 'application/json',
    'x-jpv-reconciliation-confirmation': 'identity-backfill-production',
  },
  body: JSON.stringify({ mode, expectedUnmatched }),
})

const responseText = await response.text()
let responseBody = null
try {
  responseBody = JSON.parse(responseText)
} catch {
  // Keep the failure output bounded and never echo environment values.
}

if (!response.ok) {
  const routeError = responseBody && typeof responseBody === 'object' && 'error' in responseBody
    ? responseBody.error
    : 'route_failed'
  console.error(`JPV_RECONCILIATION_FAILED ${JSON.stringify({ httpStatus: response.status, error: routeError })}`)
  process.exit(1)
}

console.log(`JPV_RECONCILIATION_REPORT ${JSON.stringify(responseBody ?? { rawResponse: responseText })}`)
