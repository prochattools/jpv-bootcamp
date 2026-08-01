/**
 * Pre-flight environment validator for the production deployment workflow.
 *
 * Reads DOKPLOY_PROD_APP_ID, DOKPLOY_API_KEY, DEPLOY_BRANCH, and DEPLOY_SHA
 * from the environment and validates them through assertProductionDeployment()
 * before any Dokploy network call is made.
 *
 * Fails with PRODUCTION-DEPLOY-DENIED on any violation.
 * Never prints the app ID, API key, or any credential value.
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

const appId = requireEnv('DOKPLOY_PROD_APP_ID')
// Require the API key without printing it — just ensure it is present
requireEnv('DOKPLOY_API_KEY')

const branch = requireEnv('DEPLOY_BRANCH')
const expectedSha = requireEnv('DEPLOY_SHA')

assertProductionDeployment({
  appId,
  origin: PRODUCTION_ORIGIN,
  branch,
  expectedSha,
})

console.log('checkProductionDeploymentEnv: production deployment context validated')
