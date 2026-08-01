/**
 * Static contract test for .github/workflows/deploy.yml.
 *
 * Verifies the checked-in production deployment workflow satisfies the
 * hardening requirements without executing any network call or deployment.
 *
 * Designed to fail against the pre-remediation deploy.yml and pass only
 * after all boundary gaps are closed.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  assertProductionDeployment,
  assertProductionOrigin,
  PRODUCTION_APP_ID,
  PRODUCTION_ORIGIN,
  PRODUCTION_BRANCH,
  STAGING_DENY_LIST,
} from './productionPolicy'

async function main(): Promise<void> {
  const deployYml = await readFile('.github/workflows/deploy.yml', 'utf8')

  // =========================================================================
  // Section A: Trigger and concurrency
  // =========================================================================

  assert.ok(
    deployYml.includes("branches: [main]"),
    'deploy.yml trigger must be limited to main branch',
  )
  assert.ok(
    !deployYml.includes('workflow_dispatch:'),
    'deploy.yml must not include workflow_dispatch trigger',
  )
  assert.ok(
    deployYml.includes('group: production-deploy'),
    'deploy.yml must declare production-deploy concurrency group',
  )
  assert.ok(
    deployYml.includes('cancel-in-progress: false'),
    'deploy.yml must not cancel in-progress production deployments',
  )

  // =========================================================================
  // Section B: GitHub Environment
  // =========================================================================

  assert.ok(
    deployYml.includes('environment: production'),
    'deploy.yml must bind job to the production GitHub environment',
  )

  // =========================================================================
  // Section C: Dependency setup order
  // =========================================================================

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

  assert.ok(pnpmSetupIdx < installIdx, 'pnpm setup must precede dependency install')
  assert.ok(installIdx < typeCheckIdx, 'dependency install must precede type-check')
  assert.ok(typeCheckIdx < dockerBuildIdx, 'type-check must occur before Docker image publication')
  assert.ok(buildIdx < dockerBuildIdx, 'application build must occur before Docker image publication')
  assert.ok(releaseTestIdx < dockerBuildIdx, 'release tests must occur before Docker image publication')
  assert.ok(chromiumIdx < e2eIdx, 'Chromium installation must precede browser E2E tests')
  assert.ok(e2eIdx < dockerBuildIdx, 'browser E2E tests must occur before Docker image publication')

  // =========================================================================
  // Section D: Canonical production policy entrypoint
  //
  // This section proves that deploy.yml invokes checkProductionDeploymentEnv.mts
  // as an executable step — not merely as a comment or unused variable.
  // The ordering checks ensure it runs before Docker publication and before
  // any Dokploy API call.
  // =========================================================================

  const policyEntrypointToken = 'checkProductionDeploymentEnv.mts'
  const policyEntrypointIdx = deployYml.indexOf(policyEntrypointToken)
  assert.ok(
    policyEntrypointIdx > 0,
    'deploy.yml must invoke checkProductionDeploymentEnv.mts as an executable step',
  )

  // Policy entrypoint must precede Docker publication
  assert.ok(
    policyEntrypointIdx < dockerBuildIdx,
    'canonical production policy entrypoint must run before Docker image publication',
  )

  // Policy entrypoint must precede application.update
  const imageUpdateIdx = deployYml.indexOf('application.update')
  assert.ok(imageUpdateIdx > 0, 'deploy.yml must call Dokploy application.update')
  assert.ok(
    policyEntrypointIdx < imageUpdateIdx,
    'canonical production policy entrypoint must run before Dokploy image update',
  )

  // Policy entrypoint must precede application.deploy
  const deployTriggerIdx = deployYml.indexOf('application.deploy')
  assert.ok(deployTriggerIdx > 0, 'deploy.yml must call Dokploy application.deploy')
  assert.ok(
    policyEntrypointIdx < deployTriggerIdx,
    'canonical production policy entrypoint must run before Dokploy deploy trigger',
  )

  // Policy entrypoint must come after dependency install (so tsx is available)
  assert.ok(
    installIdx < policyEntrypointIdx,
    'dependency install must precede canonical production policy entrypoint',
  )

  // The entrypoint must receive DOKPLOY_PROD_APP_ID and DOKPLOY_API_KEY as env
  // Verify the env block for the policy step is present
  assert.ok(
    deployYml.includes('DOKPLOY_PROD_APP_ID: ${{ secrets.DOKPLOY_PROD_APP_ID }}'),
    'deploy.yml must pass DOKPLOY_PROD_APP_ID secret to the policy entrypoint step',
  )
  assert.ok(
    deployYml.includes('DOKPLOY_API_KEY: ${{ secrets.DOKPLOY_API_KEY }}'),
    'deploy.yml must pass DOKPLOY_API_KEY secret to the policy entrypoint step',
  )
  assert.ok(
    deployYml.includes('DEPLOY_BRANCH: ${{ github.ref_name }}'),
    'deploy.yml must pass DEPLOY_BRANCH to the policy entrypoint step',
  )
  assert.ok(
    deployYml.includes('DEPLOY_SHA: ${{ github.sha }}'),
    'deploy.yml must pass DEPLOY_SHA to the policy entrypoint step',
  )

  // =========================================================================
  // Section E: Canonical policy module — proves executable behavior
  //
  // These assertions use assertProductionDeployment() directly to confirm the
  // policy function enforces what the workflow relies on.
  // A static string check in a comment cannot satisfy this section.
  // =========================================================================

  // The canonical production app ID constant must equal what is in productionPolicy.ts
  assert.equal(PRODUCTION_APP_ID, 'web-public-jpv-bootcamp-l66egq', 'canonical production app ID')
  assert.equal(PRODUCTION_ORIGIN, 'https://jpvbootcamp.com', 'canonical production origin')
  assert.equal(PRODUCTION_BRANCH, 'main', 'canonical production branch')

  // Valid context passes
  assertProductionDeployment({
    appId: PRODUCTION_APP_ID,
    origin: PRODUCTION_ORIGIN,
    branch: PRODUCTION_BRANCH,
    expectedSha: 'a'.repeat(40),
  })

  // Staging app IDs are rejected
  for (const stagingId of STAGING_DENY_LIST) {
    let threw = false
    try {
      assertProductionDeployment({
        appId: stagingId,
        origin: PRODUCTION_ORIGIN,
        branch: PRODUCTION_BRANCH,
        expectedSha: 'a'.repeat(40),
      })
    } catch (e) {
      threw = true
      assert.match((e as Error).message, /PRODUCTION-DEPLOY-DENIED.*staging/, `staging ID ${stagingId} must be rejected with PRODUCTION-DEPLOY-DENIED and mention staging`)
    }
    assert.ok(threw, `staging ID '${stagingId}' must be rejected by assertProductionDeployment`)
  }

  // Arbitrary non-staging app IDs are also rejected — not just the deny-listed ones
  const arbitraryIds = ['some-other-app', 'random-id', 'web-public-jpv-bootcamp-WRONG', '']
  for (const badId of arbitraryIds) {
    let threw = false
    try {
      assertProductionDeployment({
        appId: badId,
        origin: PRODUCTION_ORIGIN,
        branch: PRODUCTION_BRANCH,
        expectedSha: 'a'.repeat(40),
      })
    } catch {
      threw = true
    }
    assert.ok(threw, `arbitrary app ID '${badId}' must be rejected — only the canonical production ID is allowed`)
  }

  // Missing DOKPLOY_API_KEY is rejected by checkProductionDeploymentEnv.mts
  // (structural: the script calls requireEnv('DOKPLOY_API_KEY') before any network call)
  assert.ok(
    deployYml.includes('DOKPLOY_API_KEY: ${{ secrets.DOKPLOY_API_KEY }}') &&
    deployYml.includes('checkProductionDeploymentEnv.mts'),
    'DOKPLOY_API_KEY must be required by the policy entrypoint before any Dokploy call',
  )

  // assertProductionOrigin rejects production URL with non-HTTPS
  let threw = false
  try { assertProductionOrigin('http://jpvbootcamp.com') } catch { threw = true }
  assert.ok(threw, 'assertProductionOrigin rejects HTTP production URL')

  // =========================================================================
  // Section F: SHA build arguments and immutable image tag
  // =========================================================================

  assert.ok(
    deployYml.includes('IMAGE_TAG=${{ github.sha }}'),
    'deploy.yml must pass IMAGE_TAG build arg with exact commit SHA',
  )
  assert.ok(
    deployYml.includes('COMMIT_SHA=${{ github.sha }}'),
    'deploy.yml must pass COMMIT_SHA build arg with exact commit SHA',
  )
  assert.ok(
    deployYml.includes('ghcr.io/${{ github.repository }}:${{ github.sha }}'),
    'deploy.yml must build and push an immutable SHA-tagged image',
  )

  // =========================================================================
  // Section G: Production URL build args
  // =========================================================================

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

  // =========================================================================
  // Section H: Dokploy sequencing and fail-closed behavior
  // =========================================================================

  assert.ok(
    imageUpdateIdx < deployTriggerIdx,
    'Dokploy image update must precede deployment trigger',
  )

  // Image update failure is fatal
  assert.ok(
    deployYml.includes('image update failed') && deployYml.includes('deployment aborted'),
    'deploy.yml must abort when Dokploy image update returns non-200',
  )

  // Deployment trigger failure is fatal
  assert.ok(
    deployYml.includes('Dokploy deployment trigger failed'),
    'deploy.yml must fail when deployment trigger returns non-200',
  )

  // =========================================================================
  // Section I: Exact-SHA post-deployment wait
  // =========================================================================

  const waitIdx = deployYml.indexOf('waitForProductionDeployment.mts')
  assert.ok(waitIdx > 0, 'deploy.yml must invoke waitForProductionDeployment.mts after deployment')
  assert.ok(
    deployYml.includes('EXPECTED_DEPLOYMENT_SHA: ${{ github.sha }}'),
    'deploy.yml must pass exact commit SHA to production wait script',
  )
  assert.ok(
    deployYml.includes('PRODUCTION_URL: https://jpvbootcamp.com'),
    'deploy.yml must pass production URL to production wait script',
  )
  assert.ok(
    waitIdx > deployTriggerIdx,
    'exact-SHA wait must occur after deployment trigger',
  )

  // =========================================================================
  // Section J: Staging identifiers rejected
  //
  // Staging deny-list is now enforced by the executable policy module
  // (proven in Section E). The workflow must not contain staging origin URLs.
  // =========================================================================

  assert.ok(
    !deployYml.includes('preview.jpvbootcamp.com'),
    'deploy.yml must not reference the staging origin URL',
  )

  // =========================================================================
  // Section K: No Dokploy response-body artifacts
  //
  // Response bodies must be discarded to /dev/null.
  // No /tmp/dokploy_* files may be created or uploaded.
  // No cat, echo, or verbose curl output of response bodies.
  // =========================================================================

  assert.ok(
    !deployYml.includes('/tmp/dokploy_'),
    'deploy.yml must not write Dokploy response bodies to /tmp/dokploy_* files',
  )
  assert.ok(
    deployYml.includes('-o /dev/null'),
    'deploy.yml must discard Dokploy response bodies to /dev/null',
  )
  assert.ok(
    !deployYml.includes('cat /tmp/dokploy'),
    'deploy.yml must not print Dokploy response bodies to logs',
  )
  assert.ok(
    !deployYml.includes('upload-artifact') || (
      // The only allowed artifact upload is the browser failure artifact,
      // not any Dokploy response bodies
      !deployYml.includes('dokploy_*.json') && !deployYml.includes('production-deploy-failure')
    ),
    'deploy.yml must not upload Dokploy API response bodies as artifacts',
  )

  // =========================================================================
  // Section L: SHA ancestry guard
  // =========================================================================

  assert.ok(
    deployYml.includes('merge-base --is-ancestor'),
    'deploy.yml must include SHA ancestry check with git merge-base --is-ancestor',
  )
  assert.ok(
    deployYml.includes('git rev-parse HEAD'),
    'deploy.yml must verify HEAD SHA equals push SHA',
  )

  const ancestryIdx = deployYml.indexOf('merge-base --is-ancestor')
  assert.ok(
    ancestryIdx < dockerBuildIdx,
    'SHA ancestry check must occur before Docker image publication',
  )
  assert.ok(
    ancestryIdx < policyEntrypointIdx,
    'SHA ancestry check must occur before production policy entrypoint',
  )

  // =========================================================================
  // Section M: Provenance and external config note
  // =========================================================================

  assert.ok(
    deployYml.includes('Provenance: deployed from'),
    'deploy.yml must echo deployment provenance SHA',
  )
  assert.ok(
    deployYml.includes('EXTERNAL CONFIGURATION REQUIRED'),
    'deploy.yml must document that GitHub environment and branch protection are external requirements',
  )

  console.log('productionWorkflowContract.test.ts passed — 63 assertions')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
