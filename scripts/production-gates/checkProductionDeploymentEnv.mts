/**
 * Pre-flight environment validator for the production deployment workflow.
 *
 * Reads DOKPLOY_PROD_APP_ID, DOKPLOY_API_KEY, DEPLOY_BRANCH, and DEPLOY_SHA
 * from the environment and validates them through assertProductionDeployment()
 * before any Dokploy network call is made.
 *
 * Fails with sanitized PRODUCTION-DEPLOY-DENIED output on any violation.
 * Never prints the app ID, API key, branch, SHA, or any credential value.
 * Performs no network access.
 */

import { assertProductionDeployment, PRODUCTION_ORIGIN } from './productionPolicy'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`PRODUCTION-DEPLOY-DENIED: ${name} is required and must be nonempty`)
  }
  return value
}

function requireSecretEnv(name: string): void {
  const rawValue = process.env[name]
  if (!rawValue || rawValue.trim() === '' || rawValue !== rawValue.trim()) {
    throw new Error(`PRODUCTION-DEPLOY-DENIED: ${name} is missing or malformed`)
  }
}

function main(): void {
  const appId = requireEnv('DOKPLOY_PROD_APP_ID')
  requireSecretEnv('DOKPLOY_API_KEY')

  const branch = requireEnv('DEPLOY_BRANCH')
  const expectedSha = requireEnv('DEPLOY_SHA')

  assertProductionDeployment({
    appId,
    origin: PRODUCTION_ORIGIN,
    branch,
    expectedSha,
  })

  console.log('checkProductionDeploymentEnv: production deployment context validated')
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : ''
  console.error(
    message.startsWith('PRODUCTION-DEPLOY-DENIED:')
      ? message
      : 'PRODUCTION-DEPLOY-DENIED: production deployment environment validation failed',
  )
  process.exit(1)
}
