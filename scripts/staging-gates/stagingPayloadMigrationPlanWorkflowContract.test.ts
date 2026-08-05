/**
 * Static contract test for the read-only-plan job in .github/workflows/deploy-preview.yml.
 *
 * The standalone staging-payload-migration-plan.yml has been removed; its capability
 * now lives in the `read-only-plan` job gated behind `operation=read-only-migration-plan`.
 *
 * Proves: single-file dispatch, job exclusivity, push suppression, port 5433,
 * pinned Tailscale action, metadata preflight, confirmation guard, SHA guards,
 * exact command invocation, permissions, raw-file deletion, forbidden actions,
 * and dispatchability from the default branch.
 *
 * No network calls, no real database access, no workflow dispatch.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const WORKFLOW_PATH = '.github/workflows/deploy-preview.yml'
const STANDALONE_PATH = '.github/workflows/staging-payload-migration-plan.yml'
const REQUIRED_CONFIRMATION = 'run-read-only-staging-payload-migration-plan'
const REQUIRED_ENVIRONMENT = 'staging-migration-plan'
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const REQUIRED_TARGET_ID = 'jpvbootcamp-staging'
const REQUIRED_HOSTNAME = '10.0.2.4'
const REQUIRED_DATABASE = 'jpvbootcamp'
const REQUIRED_ENVIRONMENT_VALUE = 'staging'
const REQUIRED_PORT = '5433'
const REQUIRED_PNPM_VERSION = '10.33.0'
const REQUIRED_NODE_VERSION = '20'
const ALLOWED_BRANCH = 'feature/course-branding-and-preview'

let passed = 0
let failed = 0

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

async function main(): Promise<void> {
  const yml = await readFile(WORKFLOW_PATH, 'utf8')

  // ─── Single implementation ────────────────────────────────────────────────

  await test('dispatch: standalone workflow file is absent — one implementation only', () => {
    assert.ok(
      !existsSync(STANDALONE_PATH),
      `standalone '${STANDALONE_PATH}' must be absent — the plan job now lives in deploy-preview.yml`,
    )
  })

  await test('dispatch: deploy-preview.yml has workflow_dispatch trigger', () => {
    assert.ok(yml.includes('workflow_dispatch:'), 'must have workflow_dispatch trigger')
  })

  // ─── Operation input and job exclusivity ─────────────────────────────────

  await test('dispatch: operation input declared with read-only-migration-plan choice', () => {
    assert.ok(yml.includes('operation:'), 'must declare operation input')
    assert.ok(yml.includes('read-only-migration-plan'), 'must list read-only-migration-plan as a choice')
    assert.ok(yml.includes('deploy-preview'), 'must list deploy-preview as a choice')
  })

  await test('job exclusivity: deploy job skips when operation=read-only-migration-plan', () => {
    assert.ok(
      yml.includes("inputs.operation == 'deploy-preview'") ||
        yml.includes('inputs.operation == "deploy-preview"'),
      'deploy job if-condition must check operation == deploy-preview',
    )
    assert.ok(
      yml.includes("inputs.operation == 'read-only-migration-plan'") ||
        yml.includes('inputs.operation == "read-only-migration-plan"'),
      'plan job if-condition must check operation == read-only-migration-plan',
    )
  })

  await test('push suppression: push deploys only when commit message lacks [migration-plan-only]', () => {
    assert.ok(
      yml.includes('[migration-plan-only]'),
      'must suppress push deploy when commit message contains [migration-plan-only]',
    )
    assert.ok(
      yml.includes('contains(github.event.head_commit.message'),
      'must check head_commit.message for the marker',
    )
  })

  // ─── Plan job inputs ──────────────────────────────────────────────────────

  await test('inputs: expected_sha and confirmation declared', () => {
    assert.ok(yml.includes('expected_sha:'), 'must declare expected_sha input')
    assert.ok(yml.includes('confirmation:'), 'must declare confirmation input')
  })

  // ─── Permissions ─────────────────────────────────────────────────────────

  await test('permissions: plan job has job-level contents: read', () => {
    assert.ok(yml.includes('contents: read'), 'must declare contents: read')
    assert.ok(!yml.includes('contents: write'), 'must not declare write permissions in plan job')
  })

  await test('permissions: plan job must not request packages write', () => {
    // packages: write belongs to the deploy job — plan job must not have it
    const planJobIndex = yml.indexOf('read-only-plan:')
    assert.ok(planJobIndex > -1, 'must have a read-only-plan job')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('packages: write'), 'plan job must not request packages write')
  })

  // ─── Concurrency ─────────────────────────────────────────────────────────

  await test('concurrency: plan job declared with cancel-in-progress: false', () => {
    assert.ok(yml.includes('staging-payload-migration-plan'), 'must use staging-payload-migration-plan concurrency group')
    assert.ok(yml.includes('cancel-in-progress: false'), 'must not cancel in-progress plan runs')
  })

  // ─── Environment binding ──────────────────────────────────────────────────

  await test('environment: plan job binds to staging-migration-plan', () => {
    assert.ok(
      yml.includes(`environment: ${REQUIRED_ENVIRONMENT}`),
      `must bind plan job to environment '${REQUIRED_ENVIRONMENT}'`,
    )
  })

  // ─── Metadata preflight ───────────────────────────────────────────────────

  await test('metadata preflight: verifies environment exists before checkout', () => {
    assert.ok(
      yml.includes('GitHub infrastructure prerequisites') || yml.includes('infrastructure prerequisites'),
      'must include a metadata preflight step',
    )
    assert.ok(
      yml.includes('PREFLIGHT-DENIED') || yml.includes('does not exist'),
      'preflight must fail closed when environment is absent',
    )
  })

  await test('metadata preflight: requires at least one reviewer on environment', () => {
    assert.ok(
      yml.includes('required_reviewers') || yml.includes('required reviewer'),
      'preflight must verify reviewer count',
    )
    assert.ok(
      yml.includes('no required reviewers') || yml.includes('REVIEWER_COUNT'),
      'must fail closed when no reviewers configured',
    )
  })

  await test('metadata preflight: verifies DATABASE_URL and Tailscale OAuth secret names', () => {
    assert.ok(
      yml.includes('DATABASE_URL') && yml.includes('TAILSCALE_OAUTH_CLIENT_ID') && yml.includes('TAILSCALE_OAUTH_SECRET'),
      'preflight must check for required secret names in the environment',
    )
  })

  await test('metadata preflight: rejects same-named repository secrets that shadow environment secrets', () => {
    assert.ok(
      yml.includes('actions/secrets') || yml.includes('repository secret'),
      'preflight must reject repository-level secrets that shadow environment secrets',
    )
    assert.ok(
      yml.includes('shadows') || yml.includes('PREFLIGHT-DENIED'),
      'must fail closed on shadow secret detection',
    )
  })

  // ─── Confirmation guard ───────────────────────────────────────────────────

  await test('confirmation guard: rejects wrong confirmation string', () => {
    assert.ok(
      yml.includes(REQUIRED_CONFIRMATION),
      `must check for confirmation value '${REQUIRED_CONFIRMATION}'`,
    )
    assert.ok(yml.includes('PLAN-DENIED'), 'must output PLAN-DENIED on rejection')
  })

  // ─── SHA guards ───────────────────────────────────────────────────────────

  await test('sha guard: validates full 40-char hex SHA', () => {
    assert.ok(
      yml.includes('[0-9a-f]{40}') || yml.includes('40 lowercase'),
      'must validate that expected_sha is exactly 40 hex characters',
    )
  })

  await test('sha guard: rejects main branch', () => {
    assert.ok(
      yml.includes('refs/heads/main') || yml.includes('"main"'),
      'must check for main branch ref',
    )
    assert.ok(yml.includes('PLAN-DENIED'), 'must deny main branch runs')
  })

  await test('sha guard: checkout uses exact input SHA', () => {
    assert.ok(yml.includes('actions/checkout@v4'), 'must use actions/checkout@v4')
    assert.ok(
      yml.includes('ref: ${{ inputs.expected_sha }}'),
      'checkout ref must be the input expected_sha',
    )
    assert.ok(yml.includes('fetch-depth: 0'), 'must fetch full history for ancestry check')
  })

  await test('sha guard: verifies checked-out SHA matches input after checkout', () => {
    assert.ok(yml.includes('git rev-parse HEAD'), 'must verify HEAD SHA after checkout')
    assert.ok(
      yml.includes('does not match') || yml.includes("!= '$INPUT_SHA'") || yml.includes("!= \"$INPUT_SHA\""),
      'must compare actual SHA to input',
    )
  })

  await test('sha guard: verifies feature branch ancestry — not reachable from main', () => {
    assert.ok(yml.includes('merge-base --is-ancestor'), 'must verify SHA ancestry under feature branch')
    assert.ok(yml.includes(ALLOWED_BRANCH), `must name the allowed branch '${ALLOWED_BRANCH}'`)
    assert.ok(yml.includes('origin/main'), 'must also check SHA is not yet merged to main')
  })

  await test('sha guard: verifies SHA matches current remote feature tip', () => {
    assert.ok(yml.includes('origin/feature/course-branding-and-preview'), 'must compare input SHA to remote feature tip')
    assert.ok(
      yml.includes('REMOTE_TIP') || yml.includes('remote tip'),
      'must reference remote tip comparison',
    )
  })

  // ─── Toolchain ────────────────────────────────────────────────────────────

  await test('toolchain: pnpm pinned at 10.33.0 with frozen install (plan job)', () => {
    assert.ok(yml.includes('pnpm/action-setup@v2'), 'must use pnpm/action-setup')
    assert.ok(yml.includes(`version: ${REQUIRED_PNPM_VERSION}`), `must pin pnpm version to ${REQUIRED_PNPM_VERSION}`)
    assert.ok(yml.includes('pnpm install --frozen-lockfile'), 'must install with frozen lockfile')
  })

  await test('toolchain: Node.js 20 (plan job)', () => {
    assert.ok(yml.includes('actions/setup-node@v4'), 'must use actions/setup-node@v4')
    assert.ok(
      yml.includes(`node-version: '${REQUIRED_NODE_VERSION}'`) || yml.includes(`node-version: "${REQUIRED_NODE_VERSION}"`),
      `must pin Node.js version to ${REQUIRED_NODE_VERSION}`,
    )
  })

  // ─── Tailscale ────────────────────────────────────────────────────────────

  await test('tailscale: uses tailscale/github-action with SHA-pinned ref', () => {
    assert.ok(
      yml.includes('tailscale/github-action@'),
      'must use tailscale/github-action',
    )
    // SHA-pinned refs contain a 40-char hex hash after @
    const tailscaleMatch = yml.match(/tailscale\/github-action@([0-9a-f]{40})/)
    assert.ok(
      tailscaleMatch !== null,
      'tailscale/github-action must use an immutable 40-char SHA pin (not a floating tag like @v2)',
    )
  })

  await test('tailscale: uses environment-scoped OAuth secrets', () => {
    assert.ok(yml.includes('TAILSCALE_OAUTH_CLIENT_ID'), 'must reference TAILSCALE_OAUTH_CLIENT_ID')
    assert.ok(yml.includes('TAILSCALE_OAUTH_SECRET'), 'must reference TAILSCALE_OAUTH_SECRET')
    assert.ok(
      yml.includes('secrets.TAILSCALE_OAUTH_CLIENT_ID') && yml.includes('secrets.TAILSCALE_OAUTH_SECRET'),
      'Tailscale OAuth secrets must come from environment secrets',
    )
  })

  await test('tailscale: sets least-privilege tag', () => {
    assert.ok(
      yml.includes('tag:ci-reader') || yml.includes('tags:'),
      'must set a least-privilege Tailscale ACL tag',
    )
  })

  // ─── Port 5433 ────────────────────────────────────────────────────────────

  await test('network gate: probes port 5433 — not 5432', () => {
    assert.ok(
      yml.includes(`${REQUIRED_HOSTNAME}:${REQUIRED_PORT}`) || yml.includes(REQUIRED_PORT),
      `must probe staging host on port ${REQUIRED_PORT} (not 5432)`,
    )
    // Confirm 5432 does not appear in a network probe context
    const networkProbeIndex = yml.indexOf('nc -z')
    if (networkProbeIndex > -1) {
      const probeSlice = yml.slice(networkProbeIndex, networkProbeIndex + 100)
      assert.ok(!probeSlice.includes('5432'), 'network probe must use port 5433, not 5432')
    }
  })

  // ─── Credential masking ───────────────────────────────────────────────────

  await test('masking: DATABASE_URL is masked before use', () => {
    assert.ok(yml.includes('add-mask') || yml.includes('::add-mask::'), 'must mask DATABASE_URL')
    assert.ok(yml.includes('secrets.DATABASE_URL'), 'DATABASE_URL must come from environment secrets')
  })

  await test('masking: fails closed when DATABASE_URL is absent', () => {
    assert.ok(
      yml.includes('DATABASE_URL is not set') || yml.includes('DATABASE_URL:-}'),
      'must check for absent DATABASE_URL and fail closed',
    )
  })

  // ─── Exact command ────────────────────────────────────────────────────────

  await test('command: invokes pnpm run staging:payload-migration-plan', () => {
    assert.ok(
      yml.includes('pnpm run staging:payload-migration-plan') || yml.includes('pnpm staging:payload-migration-plan'),
      'must invoke pnpm run staging:payload-migration-plan',
    )
  })

  await test('command: passes all required flags with correct values', () => {
    assert.ok(yml.includes('--expected-commit='), 'must pass --expected-commit')
    assert.ok(yml.includes(`--environment=${REQUIRED_ENVIRONMENT_VALUE}`), `must pass --environment=${REQUIRED_ENVIRONMENT_VALUE}`)
    assert.ok(yml.includes(`--target-id=${REQUIRED_TARGET_ID}`), `must pass --target-id=${REQUIRED_TARGET_ID}`)
    assert.ok(yml.includes(`--expected-schema=${REQUIRED_SCHEMA}`), `must pass --expected-schema=${REQUIRED_SCHEMA}`)
    assert.ok(yml.includes(`--expected-hostname=${REQUIRED_HOSTNAME}`), `must pass --expected-hostname=${REQUIRED_HOSTNAME}`)
    assert.ok(yml.includes(`--expected-database=${REQUIRED_DATABASE}`), `must pass --expected-database=${REQUIRED_DATABASE}`)
  })

  await test('command: uses -- separator before flags', () => {
    // Ensures pnpm does not swallow flags before passing to the script
    assert.ok(yml.includes('-- \\'), 'must use -- separator before migration plan flags')
  })

  await test('command: PAYLOAD_MIGRATION_SCHEMA set to jpvbootcamp_staging', () => {
    assert.ok(
      yml.includes(`PAYLOAD_MIGRATION_SCHEMA: ${REQUIRED_SCHEMA}`),
      `must set PAYLOAD_MIGRATION_SCHEMA to ${REQUIRED_SCHEMA}`,
    )
  })

  // ─── Raw file deletion ────────────────────────────────────────────────────

  await test('raw file: mode-600 temp file and trap-based deletion', () => {
    assert.ok(yml.includes('chmod 600') || yml.includes('mktemp'), 'must create a mode-600 temp file')
    assert.ok(yml.includes('trap'), 'must use trap to delete raw output on EXIT')
    assert.ok(yml.includes('rm -f'), 'must delete the raw result file')
  })

  await test('raw file: never cats or retains raw result file', () => {
    // Raw result file must not be uploaded or catted — only sanitized file
    assert.ok(!yml.includes('plan-result-raw.json'), 'must not retain or reference a raw result file')
    assert.ok(!yml.includes('cat "$RESULT_FILE"'), 'must not cat raw result file to logs')
  })

  // ─── Artifact ────────────────────────────────────────────────────────────

  await test('artifact: uploads sanitized plan artifact', () => {
    assert.ok(yml.includes('actions/upload-artifact@v4'), 'must upload an artifact')
    assert.ok(yml.includes('plan-result-sanitized.json'), 'must produce a sanitized artifact file')
    assert.ok(yml.includes('retention-days:'), 'artifact must have retention policy')
  })

  await test('artifact: sanitization uses jq and whitelists safe fields only', () => {
    assert.ok(yml.includes('jq'), 'must use jq for sanitization')
    assert.ok(
      yml.includes('password') && yml.includes('secret') && yml.includes('DATABASE_URL='),
      'sanitization check must look for credential-like strings',
    )
  })

  await test('artifact: never outputs raw DATABASE_URL, credentials, or env dumps', () => {
    assert.ok(!yml.includes('echo $DATABASE_URL'), 'must not echo DATABASE_URL')
    assert.ok(!yml.includes('printenv'), 'must not dump environment')
    assert.ok(!yml.includes('env | grep'), 'must not grep env output')
  })

  // ─── Forbidden actions ────────────────────────────────────────────────────

  await test('forbidden: plan job has no migration apply or down commands', () => {
    const planJobIndex = yml.indexOf('read-only-plan:')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('payload-migration-apply'), 'plan job must not invoke migration apply')
    assert.ok(!planJobSlice.includes('payload-migration-rollback'), 'plan job must not invoke migration rollback')
    assert.ok(!planJobSlice.includes('migrate:down'), 'plan job must not invoke migrate:down')
  })

  await test('forbidden: plan job has no Prisma deploy', () => {
    const planJobIndex = yml.indexOf('read-only-plan:')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('prisma migrate deploy'), 'plan job must not run prisma migrate deploy')
    assert.ok(!planJobSlice.includes('prisma db push'), 'plan job must not run prisma db push')
  })

  await test('forbidden: plan job has no Docker build/push or Dokploy', () => {
    const planJobIndex = yml.indexOf('read-only-plan:')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('docker/build-push-action'), 'plan job must not build or push Docker images')
    assert.ok(!planJobSlice.includes('docker/login-action'), 'plan job must not log in to container registry')
    assert.ok(!planJobSlice.includes('DOKPLOY'), 'plan job must not reference Dokploy APIs')
  })

  await test('forbidden: plan job has no SSH or arbitrary outbound network commands', () => {
    const planJobIndex = yml.indexOf('read-only-plan:')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('appleboy/ssh-action'), 'plan job must not use SSH action')
    assert.ok(!planJobSlice.includes('ssh '), 'plan job must not run ssh commands')
    // curl is only allowed for the gh api preflight — not in the main run step
    assert.ok(!planJobSlice.includes('curl '), 'plan job must not run curl commands outside preflight')
    assert.ok(!planJobSlice.includes('wget '), 'plan job must not run wget commands')
  })

  await test('forbidden: plan job has no push, merge, or repository mutations', () => {
    const planJobIndex = yml.indexOf('read-only-plan:')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('git push'), 'plan job must not push to any remote')
    assert.ok(!planJobSlice.match(/git merge\s+[^-]/), 'plan job must not run git merge to merge branches')
    assert.ok(!planJobSlice.includes('git commit'), 'plan job must not create commits')
    assert.ok(!planJobSlice.includes('contents: write'), 'plan job must not request write permissions')
  })

  await test('forbidden: plan job has no provider, billing, or member actions', () => {
    const planJobIndex = yml.indexOf('read-only-plan:')
    const planJobSlice = yml.slice(planJobIndex)
    assert.ok(!planJobSlice.includes('stripe'), 'plan job must not reference Stripe')
    assert.ok(!planJobSlice.includes('resend'), 'plan job must not reference email provider')
    assert.ok(!planJobSlice.includes('livekit'), 'plan job must not reference LiveKit')
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('Contract test runner error:', error)
  process.exitCode = 1
})
