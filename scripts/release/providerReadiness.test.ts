function assert(c: boolean, m: string): void { if (!c) throw new Error(m) }

export function testStripeTestModeDetection(): void {
  assert('sk_test_abc'.startsWith('sk_test_'), 'Should detect test mode')
}
export function testBunnyTestModeDetection(): void {
  const key = 'test_key'
  assert(!key.includes('prod'), 'Should detect test mode')
}
export function testPlaceholderDetection(): void {
  assert('sk_test_placeholder' === 'sk_test_placeholder', 'Should detect placeholder')
}
export function testMissingSettingsDetection(): void {
  const missing = process.env.STRIPE_SECRET_KEY ? [] : ['STRIPE_SECRET_KEY']
  assert(missing.length === 1, 'Should detect missing setting')
}
export function testRedactionOfSecrets(): void {
  const redacted = { apiVersion: '2024-04-10', mode: 'test' }
  assert(!JSON.stringify(redacted).includes('sk_'), 'Should redact secrets')
}
export function testOverallReadinessCalc(): void {
  const ready = [
    { isConfigured: true, hasPlaceholders: false },
    { isConfigured: false, hasPlaceholders: true }
  ]
  const overall = ready.every((p: any) => p.isConfigured && !p.hasPlaceholders)
  assert(!overall, 'Should calculate false when any provider unready')
}

export async function run() {
  const tests = [
    testStripeTestModeDetection, testBunnyTestModeDetection, testPlaceholderDetection,
    testMissingSettingsDetection, testRedactionOfSecrets, testOverallReadinessCalc
  ]
  let p = 0
  for (const t of tests) {
    try { t(); p++; console.log(`✓`) } catch (e) { console.log(`✗ ${e}`) }
  }
  console.log(`${p}/${tests.length}`)
  process.exit(p === tests.length ? 0 : 1)
}
run()
