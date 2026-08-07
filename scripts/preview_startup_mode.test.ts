import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const packageJson = JSON.parse(read('package.json')) as {
  packageManager?: string
  engines?: { node?: string; pnpm?: string }
  scripts?: Record<string, string>
}
const dockerfile = read('Dockerfile')
const nixpacks = read('nixpacks.toml')
const startup = read('scripts/runtime/start-staging.sh')
const previewWorkflow = read('.github/workflows/deploy-preview.yml')
const environmentExample = read('.env.example')

assert.match(packageJson.engines?.node ?? '', /^>=20\./)
assert.match(packageJson.engines?.pnpm ?? '', /\^9|\^10/)
assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
assert.equal(packageJson.scripts?.start, 'scripts/runtime/start-staging.sh')
assert.equal(packageJson.scripts?.['start:app'], 'next start')

assert.match(dockerfile, /FROM node:20-/)
assert.match(dockerfile, /pnpm@10\.33\.0/)
assert.doesNotMatch(dockerfile, /ENV STARTUP_MODE/)
assert.match(dockerfile, /ENV DEPLOYMENT_RUNTIME=docker/)
assert.match(dockerfile, /CMD \["bash", "scripts\/runtime\/start-staging\.sh"\]/)
assert.doesNotMatch(dockerfile, /start-prod\.sh/)

assert.match(nixpacks, /nodejs_20/)
assert.doesNotMatch(nixpacks, /nodejs_18/)
assert.match(nixpacks, /pnpm@10\.33\.0/)
assert.match(nixpacks, /pnpm install --frozen-lockfile/)
assert.match(nixpacks, /bash scripts\/runtime\/start-staging\.sh/)
assert.doesNotMatch(nixpacks, /start-prod\.sh/)

assert.match(previewWorkflow, /name: Preview Build and Deploy/)
// Push path is validation-only; deployment is workflow_dispatch with deploy-preview operation
assert.match(previewWorkflow, /validate-only/)
assert.match(previewWorkflow, /deploy-preview/)
// Docker push and Dokploy are in deploy-preview job, not validate-only
assert.match(previewWorkflow, /docker\/build-push-action@[a-f0-9]{40}/)
assert.match(previewWorkflow, /context: \./)
assert.match(previewWorkflow, /push: true/)
assert.match(previewWorkflow, /packages: write/)
assert.match(previewWorkflow, /Trigger Dokploy redeploy/)
assert.doesNotMatch(previewWorkflow, /nixpacks/i)
// branch_or_ref input removed — deploy uses fixed feature branch + expected_sha
assert.doesNotMatch(previewWorkflow, /branch_or_ref:/)

// start-staging.sh: staging-only contract — no STARTUP_MODE, no DEPLOYMENT_ENV, no database-deploy
assert.match(startup, /REQUIRED_HOST="10\.0\.2\.4"/)
assert.match(startup, /REQUIRED_PORT="5433"/)
assert.match(startup, /REQUIRED_DB="jpvbootcamp"/)
assert.match(startup, /REQUIRED_SCHEMA="jpvbootcamp_staging"/)
assert.match(startup, /PAYLOAD_SCHEMA_PREFLIGHT/)
assert.match(startup, /node scripts\/runtime\/payload-migration-preflight\.cjs/)
assert.match(startup, /exec node server\.js/)
assert.doesNotMatch(startup, /database-deploy/)
assert.doesNotMatch(startup, /DEPLOYMENT_ENV/)
assert.doesNotMatch(startup, /SYSTEM_DATABASE_URL/)
assert.doesNotMatch(startup, /deploy-prod\.sh/)

for (const requiredName of [
  'DEPLOYMENT_RUNTIME=docker',
  'DEPLOYMENT_ENV=preview',
  'APP_SLUG=',
  'NODE_ENV=production',
  'DATABASE_URL=',
  'schema=APP_SCHEMA',
  'SYSTEM_DATABASE_URL=',
  'PAYLOAD_SECRET=',
  'APP_PUBLIC_URL=',
  'RESEND_API_KEY=',
  'RESEND_FROM=',
  'EMAIL_REPLY_TO=',
  'DISABLE_NON_WEBHOOK_EMAILS=',
]) {
  assert.match(environmentExample, new RegExp(requiredName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

console.log('preview_startup_mode.test.ts passed')
