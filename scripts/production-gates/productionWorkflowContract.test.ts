/**
 * Static contract test for .github/workflows/deploy.yml.
 *
 * Verifies the checked-in production deployment workflow satisfies the
 * hardening requirements without executing any network call or deployment.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const deployYml = await readFile('.github/workflows/deploy.yml', 'utf8')

  // --- Trigger ---
  assert.ok(
    deployYml.includes("branches: [main]"),
    'deploy.yml trigger must be limited to main branch',
  )
  assert.ok(
    !deployYml.includes('workflow_dispatch:'),
    'deploy.yml must not include workflow_dispatch trigger',
  )

  // --- Concurrency ---
  assert.ok(
    deployYml.includes('group: production-deploy'),
    'deploy.yml must declare production-deploy concurrency group',
  )
  assert.ok(
    deployYml.includes('cancel-in-progress: false'),
    'deploy.yml must not cancel in-progress production deployments',
  )

  // --- GitHub Environment ---
  assert.ok(
    deployYml.includes('environment: production'),
    'deploy.yml must bind job to the production GitHub environment',
  )

  // --- Dependency setup precedes validation and build ---
  const pnpmSetupIdx = deployYml.indexOf('pnpm/action-setup')
  const nodeSetupIdx = deployYml.indexOf('actions/setup-node')
  const installIdx = deployYml.indexOf('pnpm install --frozen-lockfile')
  const typeCheckIdx = deployYml.indexOf('pnpm type-check:payload')
  const buildIdx = deployYml.indexOf('pnpm run build')
  const releaseTestIdx = deployYml.indexOf('pnpm test:release')
  const chromiumIdx = deployYml.indexOf('playwright install --with-deps chromium')
  const e2eIdx = deployYml.indexOf('pnpm test:e2e')
  const dockerBuildIdx = deployYml.indexOf('docker/build-push-action')

  assert.ok(pnpmSetupIdx > 0, 'deploy.yml must include pnpm setup')
  assert.ok(nodeSetupIdx > 0, 'deploy.yml must include Node.js setup')
  assert.ok(installIdx > 0, 'deploy.yml must install dependencies')
  assert.ok(typeCheckIdx > 0, 'deploy.yml must run type-check')
  assert.ok(buildIdx > 0, 'deploy.yml must run application build')
  assert.ok(releaseTestIdx > 0, 'deploy.yml must run release tests')
  assert.ok(chromiumIdx > 0, 'deploy.yml must install Chromium')
  assert.ok(e2eIdx > 0, 'deploy.yml must run browser E2E tests')
  assert.ok(dockerBuildIdx > 0, 'deploy.yml must include Docker build step')

  assert.ok(
    pnpmSetupIdx < typeCheckIdx,
    'pnpm setup must precede type-check',
  )
  assert.ok(
    installIdx < typeCheckIdx,
    'dependency install must precede type-check',
  )
  assert.ok(
    typeCheckIdx < dockerBuildIdx,
    'type-check must occur before Docker image publication',
  )
  assert.ok(
    buildIdx < dockerBuildIdx,
    'application build must occur before Docker image publication',
  )
  assert.ok(
    releaseTestIdx < dockerBuildIdx,
    'release tests must occur before Docker image publication',
  )
  assert.ok(
    chromiumIdx < e2eIdx,
    'Chromium installation must precede browser E2E tests',
  )
  assert.ok(
    e2eIdx < dockerBuildIdx,
    'browser E2E tests must occur before Docker image publication',
  )

  // --- SHA build arguments ---
  assert.ok(
    deployYml.includes('IMAGE_TAG=${{ github.sha }}'),
    'deploy.yml must pass IMAGE_TAG build arg with exact commit SHA',
  )
  assert.ok(
    deployYml.includes('COMMIT_SHA=${{ github.sha }}'),
    'deploy.yml must pass COMMIT_SHA build arg with exact commit SHA',
  )

  // --- Immutable SHA image tag ---
  assert.ok(
    deployYml.includes('ghcr.io/${{ github.repository }}:${{ github.sha }}'),
    'deploy.yml must build and push an immutable SHA-tagged image',
  )

  // --- Production URL build args ---
  assert.ok(
    deployYml.includes('NEXT_PUBLIC_APP_URL=https://jpvbootcamp.com'),
    'deploy.yml must set NEXT_PUBLIC_APP_URL to production origin',
  )
  assert.ok(
    deployYml.includes('APP_BASE_URL=https://jpvbootcamp.com'),
    'deploy.yml must set APP_BASE_URL to production origin',
  )
  assert.ok(
    deployYml.includes('NEXT_PUBLIC_SERVER_URL=https://jpvbootcamp.com'),
    'deploy.yml must set NEXT_PUBLIC_SERVER_URL to production origin',
  )

  // --- Dokploy image update precedes deployment ---
  const imageUpdateIdx = deployYml.indexOf('application.update')
  const deployTriggerIdx = deployYml.indexOf('application.deploy')
  assert.ok(imageUpdateIdx > 0, 'deploy.yml must call Dokploy application.update before deploy')
  assert.ok(deployTriggerIdx > 0, 'deploy.yml must call Dokploy application.deploy')
  assert.ok(
    imageUpdateIdx < deployTriggerIdx,
    'Dokploy image update must precede deployment trigger',
  )

  // --- Image update failure is fatal ---
  assert.ok(
    deployYml.includes('image update') && deployYml.includes('deployment aborted'),
    'deploy.yml must abort deployment when image update fails',
  )

  // --- Deployment failure is fatal ---
  assert.ok(
    deployYml.includes('Dokploy deployment trigger failed'),
    'deploy.yml must fail when deployment trigger returns non-200',
  )

  // --- Exact-SHA post-deployment wait ---
  assert.ok(
    deployYml.includes('waitForProductionDeployment.mts'),
    'deploy.yml must invoke waitForProductionDeployment.mts after deployment',
  )
  assert.ok(
    deployYml.includes('EXPECTED_DEPLOYMENT_SHA: ${{ github.sha }}'),
    'deploy.yml must pass exact commit SHA to production wait script',
  )
  assert.ok(
    deployYml.includes('PRODUCTION_URL: https://jpvbootcamp.com'),
    'deploy.yml must pass production URL to production wait script',
  )

  const waitIdx = deployYml.indexOf('waitForProductionDeployment.mts')
  assert.ok(
    waitIdx > deployTriggerIdx,
    'exact-SHA wait must occur after deployment trigger',
  )

  // --- Staging identifiers rejected ---
  assert.ok(
    deployYml.includes('clients-jpv-bootcamp-app-tp9xrk'),
    'deploy.yml must reference staging app ID as the cross-contamination guard',
  )
  assert.ok(
    deployYml.includes('must not equal the staging app ID'),
    'deploy.yml must guard against staging app ID in DOKPLOY_PROD_APP_ID',
  )
  assert.ok(
    deployYml.includes('I_2Vukga3cc3ZhaG-mUzU'),
    'deploy.yml must guard against staging internal ID in DOKPLOY_PROD_APP_ID',
  )
  assert.ok(
    !deployYml.includes('preview.jpvbootcamp.com'),
    'deploy.yml must not reference the staging origin URL',
  )

  // --- Response bodies not printed ---
  assert.ok(
    !deployYml.includes('cat /tmp/dokploy_response.json'),
    'deploy.yml must not print Dokploy response body to logs',
  )
  assert.ok(
    !deployYml.includes('cat /tmp/dokploy_update_response.json'),
    'deploy.yml must not print Dokploy image-update response body to logs',
  )

  // --- Provenance echo ---
  assert.ok(
    deployYml.includes('Provenance: deployed from'),
    'deploy.yml must echo deployment provenance SHA',
  )

  // --- Environment declaration note ---
  assert.ok(
    deployYml.includes('EXTERNAL CONFIGURATION REQUIRED'),
    'deploy.yml must document that GitHub environment and branch protection are external requirements',
  )

  console.log('productionWorkflowContract.test.ts passed — 44 assertions')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
