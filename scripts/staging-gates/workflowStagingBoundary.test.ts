/**
 * Static scan: verify all GitHub workflow deploy calls satisfy staging boundary requirements.
 *
 * Rules enforced:
 * 1. deploy-preview.yml must use DOKPLOY_PREVIEW_APP_ID (not generic DOKPLOY_APP_ID)
 * 2. deploy-preview.yml must use a positive allow-list (ALLOWED_SLUG) for the staging app
 * 3. deploy.yml must not exist — production workflow is prohibited
 * 4. deploy-preview.yml must not reference production app ID outside the allow-list guard
 * 5. deploy-preview.yml must contain SHA ancestry check
 * 6. deploy-preview.yml must reject main branch
 * 7. deploy-preview.yml must use staging-specific environment
 * 8. publish-preview-image.yml must not reference DOKPLOY_APP_ID
 * 9. deploy-preview.yml must not print full API response body to logs
 * 10. deploy-preview.yml must include provenance SHA echo
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

async function main(): Promise<void> {
  const previewYml = await readFile('.github/workflows/deploy-preview.yml', 'utf8')

  // Rule 1: deploy-preview.yml must use staging-specific secret name
  assert.ok(
    previewYml.includes('DOKPLOY_PREVIEW_APP_ID'),
    'deploy-preview.yml must use DOKPLOY_PREVIEW_APP_ID (not generic DOKPLOY_APP_ID)',
  )
  assert.ok(
    !previewYml.includes("secrets.DOKPLOY_APP_ID"),
    'deploy-preview.yml must not use generic secrets.DOKPLOY_APP_ID',
  )

  // Rule 2: deploy-preview.yml must use positive allow-list (not deny-list) for Dokploy app
  assert.ok(
    previewYml.includes('ALLOWED_SLUG'),
    'deploy-preview.yml must declare ALLOWED_SLUG for positive allow-list',
  )
  assert.ok(
    previewYml.includes('clients-jpv-bootcamp-app-tp9xrk'),
    'deploy-preview.yml must name the canonical staging Dokploy slug',
  )
  assert.ok(
    previewYml.includes('DEPLOY-DENIED'),
    'deploy-preview.yml must contain DEPLOY-DENIED guard message',
  )

  // Rule 3: deploy.yml must not exist — production deployment workflow is prohibited
  assert.ok(
    !existsSync('.github/workflows/deploy.yml'),
    'deploy.yml must not exist — production deployment workflow is not permitted',
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

  // Rule 9: deploy-preview.yml must not print full API response body to workflow logs
  assert.ok(
    !previewYml.includes('cat /tmp/dokploy_response.json'),
    'deploy-preview.yml must not print full Dokploy response body to workflow logs',
  )

  // Rule 10: deploy-preview.yml must include provenance echo
  assert.ok(
    previewYml.includes('Provenance: deployed from'),
    'deploy-preview.yml must echo deployment provenance SHA',
  )

  // Rule 11: deploy-preview.yml must call ensurePreviewRouting before application.deploy
  // This guard persists labelsSwarm in Dokploy's DB so Traefik routing labels survive every deploy
  assert.ok(
    previewYml.includes('ensurePreviewRouting.mts'),
    'deploy-preview.yml must call ensurePreviewRouting.mts before application.deploy to persist Traefik routing labels',
  )

  console.log('workflowDeploymentBoundary.test.ts passed — 15 assertions')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
