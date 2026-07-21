/**
 * Static scan: verify all GitHub workflow deploy calls satisfy staging boundary requirements.
 *
 * Rules enforced:
 * 1. deploy-preview.yml must use DOKPLOY_PREVIEW_APP_ID (not generic DOKPLOY_APP_ID)
 * 2. deploy-preview.yml must contain the deny-list check for web-public-jpv-bootcamp-l66egq
 * 3. deploy.yml must use DOKPLOY_PROD_APP_ID (not generic DOKPLOY_APP_ID for the redeploy step)
 * 4. Neither workflow may reference web-public-jpv-bootcamp-l66egq without a DENY guard
 * 5. deploy-preview.yml must contain SHA ancestry check
 * 6. deploy-preview.yml must reject main branch
 * 9. Neither workflow must print full API response body to logs
 * 10. Both deploy workflows must include provenance SHA echo
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const previewYml = await readFile('.github/workflows/deploy-preview.yml', 'utf8')
  const deployYml = await readFile('.github/workflows/deploy.yml', 'utf8')

  // Rule 1: deploy-preview.yml must use staging-specific secret name
  assert.ok(
    previewYml.includes('DOKPLOY_PREVIEW_APP_ID'),
    'deploy-preview.yml must use DOKPLOY_PREVIEW_APP_ID (not generic DOKPLOY_APP_ID)',
  )
  assert.ok(
    !previewYml.includes("secrets.DOKPLOY_APP_ID"),
    'deploy-preview.yml must not use generic secrets.DOKPLOY_APP_ID',
  )

  // Rule 2: deploy-preview.yml must deny-list production app ID explicitly
  assert.ok(
    previewYml.includes('web-public-jpv-bootcamp-l66egq'),
    'deploy-preview.yml must reference production deny-list ID web-public-jpv-bootcamp-l66egq',
  )
  assert.ok(
    previewYml.includes('DEPLOY-DENIED'),
    'deploy-preview.yml must contain DEPLOY-DENIED guard message',
  )

  // Rule 3: deploy.yml must use prod-specific secret name for redeploy
  assert.ok(
    deployYml.includes('DOKPLOY_PROD_APP_ID'),
    'deploy.yml must use DOKPLOY_PROD_APP_ID for production deploy',
  )
  assert.ok(
    !deployYml.includes("secrets.DOKPLOY_APP_ID"),
    'deploy.yml must not use generic secrets.DOKPLOY_APP_ID for the redeploy step',
  )

  // Rule 4: allowed staging app must not be used in prod workflow, and vice versa
  assert.ok(
    deployYml.includes('clients-jpv-bootcamp-app-tp9xrk'),
    'deploy.yml must reference staging app ID as the cross-contamination guard',
  )
  // The staging guard in deploy.yml must check that prod ID != staging ID
  assert.ok(
    deployYml.includes('must not equal the staging app ID'),
    'deploy.yml must guard against staging app ID being used in production',
  )

  // Rule 5: deploy-preview.yml must verify SHA ancestry under feature branch
  assert.ok(
    previewYml.includes('merge-base --is-ancestor'),
    'deploy-preview.yml must verify SHA ancestry under feature branch',
  )
  assert.ok(
    previewYml.includes('feature/course-branding-and-preview'),
    'deploy-preview.yml must name the allowed feature branch',
  )

  // Rule 6: deploy-preview.yml must reject main branch explicitly
  assert.ok(
    previewYml.includes("ref_name") && previewYml.includes('"main"'),
    'deploy-preview.yml must reject main branch by name',
  )

  // Rule 7: deploy-preview.yml must use staging-specific environment
  assert.ok(
    previewYml.includes('environment: preview-deploy'),
    'deploy-preview.yml must use the preview-deploy GitHub environment',
  )

  // Rule 8: publish-preview-image.yml must not reference DOKPLOY_APP_ID
  const publishYml = await readFile('.github/workflows/publish-preview-image.yml', 'utf8')
  assert.ok(
    !publishYml.includes('secrets.DOKPLOY_APP_ID') && !publishYml.includes('DOKPLOY_APP_ID'),
    'publish-preview-image.yml must not reference DOKPLOY_APP_ID (it only publishes, not deploys)',
  )

  // Rule 9: Neither deploy workflow must print full API response body to logs
  assert.ok(
    !deployYml.includes('cat /tmp/dokploy_response.json'),
    'deploy.yml must not print full Dokploy response body to workflow logs',
  )
  assert.ok(
    !previewYml.includes('cat /tmp/dokploy_response.json'),
    'deploy-preview.yml must not print full Dokploy response body to workflow logs',
  )

  // Rule 10: Both deploy workflows must include provenance echo
  assert.ok(
    deployYml.includes('Provenance: deployed from'),
    'deploy.yml must echo deployment provenance SHA',
  )
  assert.ok(
    previewYml.includes('Provenance: deployed from'),
    'deploy-preview.yml must echo deployment provenance SHA',
  )

  console.log('workflowDeploymentBoundary.test.ts passed — 17 assertions')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
