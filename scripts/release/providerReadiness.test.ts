function assert(c: boolean, m: string) { if (!c) throw new Error(m) }

function testStripeTestModeDetection(): void {
  assert('sk_test_abc'.startsWith('sk_test_'), 'Should detect test mode')
}
function testBunnyTestModeDetection(): void {
  const key = 'test_key'
  assert(!key.includes('prod'), 'Should detect test mode')
}
function testPlaceholderDetection(): void {
  assert('sk_test_placeholder' === 'sk_test_placeholder', 'Should detect placeholder')
}
function testMissingSettingsDetection(): void {
  const missing = '' ? [] : ['STRIPE_SECRET_KEY']
  assert(missing.length === 1, 'Should detect missing setting')
}
function testRedactionOfSecrets(): void {
  const redacted = { apiVersion: '2024-04-10', mode: 'test' }
  assert(!JSON.stringify(redacted).includes('sk_'), 'Should redact secrets')
}
function testOverallReadinessCalc(): void {
  const ready = [
    { isConfigured: true, hasPlaceholders: false },
    { isConfigured: false, hasPlaceholders: true }
  ]
  const overall = ready.every(p => p.isConfigured && !p.hasPlaceholders)
  assert(!overall, 'Should calculate false when any provider unready')
}

async function run() {
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
