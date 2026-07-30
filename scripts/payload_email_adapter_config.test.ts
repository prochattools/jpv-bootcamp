import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')

assert.match(
  payloadConfig,
  /const buildPayloadEmailAdapter:\s*EmailAdapter\s*=\s*\(\)\s*=>\s*\{/,
  'Payload email adapter must be declared as an EmailAdapter factory',
)
assert.match(
  payloadConfig,
  /email:\s*buildPayloadEmailAdapter\s*,/,
  'Payload config must pass the email adapter factory without invoking it',
)
assert.doesNotMatch(
  payloadConfig,
  /email:\s*buildPayloadEmailAdapter\s*\(\s*\)/,
  'Payload config must never store an initialized adapter object',
)
for (const requiredProperty of [
  /name:\s*'jpv-resend'/,
  /defaultFromAddress\s*,/,
  /defaultFromName\s*,/,
  /sendEmail:\s*async\s*\(message\)/,
]) {
  assert.match(payloadConfig, requiredProperty, 'Payload adapter must expose the complete required contract')
}
assert.doesNotMatch(
  payloadConfig,
  /as\s+unknown\s+as\s+EmailAdapter|as\s+EmailAdapter/,
  'Payload email adapter must not hide an invalid shape behind an unsafe cast',
)
assert.match(payloadConfig, /new Resend\(apiKey\)/, 'Payload authentication email must use Resend')
assert.match(payloadConfig, /RESEND_API_KEY is required for Payload authentication email/)

console.log('payload_email_adapter_config.test.ts passed')
