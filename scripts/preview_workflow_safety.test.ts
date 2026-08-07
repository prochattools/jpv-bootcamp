import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const unified = read('.github/workflows/deploy-preview.yml')
const manualPublish = read('.github/workflows/publish-preview-image.yml')
const docs = read('docs/PREVIEW_RELEASE_READINESS.md')

// Unified preview pipeline: validate → build → publish → deploy
assert.match(unified, /name: Preview Build and Deploy/)
assert.match(unified, /push:/)
assert.doesNotMatch(unified, /pull_request:/)  // Only pushes trigger the unified pipeline
assert.match(unified, /permissions:\s*\n\s*contents: read/)
assert.match(unified, /packages: write/)  // Needs write for GHCR
assert.match(unified, /docker\/login-action/)  // Logs in to GHCR
assert.match(unified, /push: true/)  // Publishes image
assert.match(unified, /Trigger Dokploy redeploy/)  // Deploy step included
assert.match(unified, /pnpm type-check:payload/)
assert.match(unified, /pnpm run build/)
assert.match(unified, /timeout-minutes: 40/)  // Longer for build+deploy
// Operation-aware concurrency: deploy runs use cancel-in-progress: true (or expression that evaluates true for deploys)
assert.match(unified, /cancel-in-progress:/)
assert.doesNotMatch(unified, /payload:staging:migrate|payload:email:send|--apply/)  // No mutations

// Manual publish workflow: workflow_dispatch only, no push triggers
assert.match(manualPublish, /name: Publish Preview Image/)
assert.match(manualPublish, /workflow_dispatch:/)
assert.doesNotMatch(manualPublish, /push:\s*\n\s*branches/)  // No push triggers
assert.match(manualPublish, /commit_sha:/)
assert.match(manualPublish, /confirmation:/)
assert.match(manualPublish, /source_date:/)
assert.match(manualPublish, /environment: preview-image-publish/)
assert.match(manualPublish, /contents: read/)
assert.match(manualPublish, /packages: write/)
assert.match(manualPublish, /REQUESTED_SHA/)
assert.match(manualPublish, /CONFIRMATION: \$\{\{ inputs\.confirmation \}\}/)
assert.match(manualPublish, /SOURCE_DATE: \$\{\{ inputs\.source_date \}\}/)
assert.match(manualPublish, /\$\{#REQUESTED_SHA\}" -ne 40/)
assert.match(manualPublish, /\[ "\$CONFIRMATION" != "publish-preview-image" \]/)
assert.match(manualPublish, /source_date is required/)
assert.match(manualPublish, /git rev-parse HEAD/)
// All docker actions SHA-pinned — no mutable @v3/@v5 tags
assert.match(manualPublish, /docker\/login-action@[a-f0-9]{40}/)
assert.match(manualPublish, /docker\/build-push-action@[a-f0-9]{40}/)
assert.match(manualPublish, /push: true/)
assert.match(manualPublish, /Determine publish tags/)
// Hardened: branch tag is fixed to staging branch slug, not dynamically derived from github.ref_name
assert.match(manualPublish, /feature-course-branding-and-preview/)
assert.doesNotMatch(manualPublish, /branch_ref="\$\{\{ github\.ref_name \}\}"/)
assert.match(manualPublish, /ghcr\.io\/\$\{\{ github\.repository \}\}:\$\{\{ steps\.checkout-sha\.outputs\.sha \}\}/)
assert.doesNotMatch(manualPublish, /:latest/)
assert.doesNotMatch(manualPublish, /payload:staging:migrate|payload:email:send|--apply/)
assert.match(manualPublish, /Image publication does not deploy/)

assert.match(docs, /Preview|Build|Deploy/i)

console.log('preview_workflow_safety.test.ts passed')
