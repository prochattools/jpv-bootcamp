import assert from 'node:assert/strict'

import { buildPreviewReadinessReport } from '../src/lib/previewReadinessConfig'

const secretValues = {
  databaseUrl: 'postgresql://private-user:private-password@db.internal.invalid/app?schema=preview_schema',
  systemDatabaseUrl: 'postgresql://system-user:system-password@db.internal.invalid/system',
  payloadSecret: 'payload-secret-value-that-must-not-appear',
  resendApiKey: 'resend-key-value-that-must-not-appear',
  sender: 'JPV Preview <preview-sender@example.test>',
  replyTo: 'reply-private@example.test',
}

const ready = buildPreviewReadinessReport({
  DATABASE_URL: secretValues.databaseUrl,
  SYSTEM_DATABASE_URL: secretValues.systemDatabaseUrl,
  APP_SLUG: 'jpv_preview',
  NODE_ENV: 'production',
  PAYLOAD_SECRET: secretValues.payloadSecret,
  RESEND_API_KEY: secretValues.resendApiKey,
  RESEND_FROM: secretValues.sender,
  EMAIL_REPLY_TO: secretValues.replyTo,
  APP_PUBLIC_URL: 'https://preview.example.test/path-that-is-not-reported',
  DISABLE_NON_WEBHOOK_EMAILS: 'false',
  STARTUP_MODE: 'application-only',
  DEPLOYMENT_RUNTIME: 'docker',
  DEPLOYMENT_ENV: 'preview',
})

assert.equal(ready.readyForApplicationOnlyPreview, true)
assert.equal(ready.readyForEmailApply, true)
assert.equal(ready.providerMode, 'apply-ready')
assert.equal(ready.startupMode, 'application-only')
assert.equal(ready.deploymentRuntime, 'docker')
assert.equal(ready.checks.databaseUrl.present, true)
assert.equal(ready.checks.databaseUrl.validUrl, true)
assert.equal(ready.checks.databaseUrl.explicitSchema, true)
assert.equal(ready.checks.publicBaseUrl.host, 'preview.example.test')
assert.equal(ready.checks.publicBaseUrl.protocol, 'https:')
assert.equal(ready.checks.publicBaseUrl.source, 'APP_PUBLIC_URL')
assert.equal(ready.checks.senderIdentity.present, true)
assert.equal(ready.checks.replyToIdentity.present, true)
assert.deepEqual(ready.missing, [])

const serialized = JSON.stringify(ready)
for (const value of Object.values(secretValues)) {
  assert.equal(serialized.includes(value), false, value)
}
assert.equal(serialized.includes('private-user'), false)
assert.equal(serialized.includes('private-password'), false)
assert.equal(serialized.includes('db.internal.invalid'), false)
assert.equal(serialized.includes('preview_schema'), false)
assert.equal(serialized.includes('path-that-is-not-reported'), false)
assert.equal(serialized.includes('preview-sender@example.test'), false)
assert.equal(serialized.includes('reply-private@example.test'), false)

const disabled = buildPreviewReadinessReport({
  DATABASE_URL: 'postgresql://redacted.invalid/app?schema=preview',
  SYSTEM_DATABASE_URL: 'configured',
  APP_SLUG: 'preview',
  NODE_ENV: 'production',
  PAYLOAD_SECRET: 'configured',
  NEXT_PUBLIC_SERVER_URL: 'preview.example.test',
  DISABLE_NON_WEBHOOK_EMAILS: 'true',
  STARTUP_MODE: 'application-only',
  DEPLOYMENT_RUNTIME: 'docker',
})
assert.equal(disabled.providerMode, 'disabled')
assert.equal(disabled.readyForEmailApply, false)
assert.equal(disabled.checks.publicBaseUrl.protocol, 'https:')
assert.equal(disabled.warnings.includes('RESEND_API_KEY_MISSING'), true)
assert.equal(disabled.warnings.includes('SENDER_IDENTITY_MISSING'), true)

const incomplete = buildPreviewReadinessReport({
  DATABASE_URL: 'not-a-url',
  NODE_ENV: 'unexpected-mode',
  RESEND_API_KEY: 'configured-but-not-returned',
  STARTUP_MODE: 'unexpected',
  DEPLOYMENT_RUNTIME: 'nixpacks',
  APP_PUBLIC_URL: 'ftp://invalid.example.test',
})
assert.equal(incomplete.readyForApplicationOnlyPreview, false)
assert.equal(incomplete.providerMode, 'dry-run-only')
assert.equal(incomplete.checks.databaseUrl.validUrl, false)
assert.equal(incomplete.checks.databaseUrl.explicitSchema, false)
assert.equal(incomplete.checks.nodeEnv.mode, 'other')
assert.equal(incomplete.startupMode, 'unknown')
assert.equal(incomplete.deploymentRuntime, 'nixpacks')
assert.equal(incomplete.checks.publicBaseUrl.valid, false)
assert.equal(incomplete.missing.includes('DATABASE_URL_VALID_URL'), true)
assert.equal(incomplete.missing.includes('DATABASE_URL_EXPLICIT_SCHEMA'), true)
assert.equal(incomplete.missing.includes('SYSTEM_DATABASE_URL'), true)
assert.equal(incomplete.missing.includes('STARTUP_MODE'), true)
assert.equal(incomplete.warnings.includes('NIXPACKS_PREVIEW_PATH_SELECTED'), true)
assert.equal(JSON.stringify(incomplete).includes('configured-but-not-returned'), false)

console.log('preview_readiness_config.test.ts passed')
