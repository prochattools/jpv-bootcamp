import { waitForProductionDeployment } from './productionDeploymentWait'

function requireEnvironment(name: 'PRODUCTION_URL' | 'EXPECTED_DEPLOYMENT_SHA'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`PRODUCTION-DEPLOYMENT-WAIT-DENIED: ${name} is required and must be nonempty`)
  }
  return value
}

const productionUrl = requireEnvironment('PRODUCTION_URL')
const expectedSha = requireEnvironment('EXPECTED_DEPLOYMENT_SHA')

await waitForProductionDeployment({ productionUrl, expectedSha })
