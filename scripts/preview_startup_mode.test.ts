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
const startup = read('scripts/runtime/start-prod.sh')
const previewWorkflow = read('.github/workflows/deploy-preview.yml')
const environmentExample = read('.env.example')

assert.match(packageJson.engines?.node ?? '', /^>=20\./)
assert.match(packageJson.engines?.pnpm ?? '', /\^9|\^10/)
assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
assert.equal(packageJson.scripts?.start, 'scripts/runtime/start-prod.sh')
assert.equal(packageJson.scripts?.['start:app'], 'next start')

assert.match(dockerfile, /FROM node:20-/)
assert.match(dockerfile, /pnpm@10\.33\.0/)
assert.match(dockerfile, /ENV STARTUP_MODE=application-only/)
assert.match(dockerfile, /ENV DEPLOYMENT_RUNTIME=docker/)
assert.match(dockerfile, /CMD \["bash", "scripts\/runtime\/start-prod\.sh"\]/)

assert.match(nixpacks, /nodejs_20/)
assert.doesNotMatch(nixpacks, /nodejs_18/)
assert.match(nixpacks, /pnpm@10\.33\.0/)
assert.match(nixpacks, /pnpm install --frozen-lockfile/)
assert.match(nixpacks, /bash scripts\/runtime\/start-prod\.sh/)

assert.match(previewWorkflow, /name: Preview Build and Deploy/)
assert.match(previewWorkflow, /docker\/build-push-action@v5/)
assert.match(previewWorkflow, /context: \./)
// Unified pipeline now includes image publication and deployment
assert.match(previewWorkflow, /push: true/)
assert.match(previewWorkflow, /packages: write/)
assert.match(previewWorkflow, /Trigger Dokploy redeploy/)
assert.doesNotMatch(previewWorkflow, /nixpacks/i)

assert.match(startup, /STARTUP_MODE="\$\{STARTUP_MODE:-application-only\}"/)
assert.match(startup, /PAYLOAD_SCHEMA_PREFLIGHT="\$\{PAYLOAD_SCHEMA_PREFLIGHT:-true\}"/)
assert.match(startup, /require_env DEPLOYMENT_ENV/)
assert.match(startup, /preview\|staging\|production/)
assert.match(startup, /invalid DEPLOYMENT_ENV/)
assert.match(startup, /invalid STARTUP_MODE/)
assert.match(startup, /exec node server\.js/)

const applicationOnlyBranch = startup.match(
  /application-only\)\s*([\s\S]*?)\s*;;/,
)?.[1]
assert(applicationOnlyBranch)
assert.doesNotMatch(applicationOnlyBranch, /deploy-prod\.sh/)
assert.doesNotMatch(applicationOnlyBranch, /prepare_database_deploy/)
assert.doesNotMatch(applicationOnlyBranch, /psql|pg_dump|pg_restore/)
assert.match(applicationOnlyBranch, /node scripts\/runtime\/payload-migration-preflight\.cjs/)
assert.doesNotMatch(applicationOnlyBranch, /payload migrate:status/)

const databaseDeployBranch = startup.match(
  /database-deploy\)\s*([\s\S]*?)\s*;;/,
)?.[1]
assert(databaseDeployBranch)
assert.match(databaseDeployBranch, /prepare_database_deploy/)

const databaseDeployFunction = startup.match(
  /prepare_database_deploy\(\) \{([\s\S]*?)\n\}/,
)?.[1]
assert(databaseDeployFunction)
assert.match(databaseDeployFunction, /\.\/scripts\/db\/deploy-prod\.sh/)
assert.equal((startup.match(/\.\/scripts\/db\/deploy-prod\.sh/g) ?? []).length, 1)

for (const requiredName of [
  'STARTUP_MODE=application-only',
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
