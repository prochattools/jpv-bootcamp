/**
 * Static contract test for .github/workflows/staging-payload-migration-plan.yml.
 *
 * Proves: trigger discipline, permissions, confirmation guard, SHA guards,
 * exact command invocation, network gate, credential masking,
 * artifact sanitization, and forbidden-command absence.
 *
 * No network calls, no real database access, no workflow dispatch.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const WORKFLOW_PATH = '.github/workflows/staging-payload-migration-plan.yml'
const REQUIRED_CONFIRMATION = 'run-read-only-staging-payload-migration-plan'
const REQUIRED_ENVIRONMENT = 'staging-migration-plan'
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const REQUIRED_TARGET_ID = 'jpvbootcamp-staging'
const REQUIRED_HOSTNAME = '10.0.2.4'
const REQUIRED_DATABASE = 'jpvbootcamp'
const REQUIRED_ENVIRONMENT_VALUE = 'staging'
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

  // ─── Trigger discipline ──────────────────────────────────────────────────

  await test('trigger: workflow_dispatch only — no push, no schedule', () => {
    assert.ok(yml.includes('workflow_dispatch:'), 'must have workflow_dispatch trigger')
    assert.ok(!yml.includes('push:'), 'must not have push trigger')
    assert.ok(!yml.includes('schedule:'), 'must not have schedule trigger')
    assert.ok(!yml.includes('pull_request:'), 'must not have pull_request trigger')
  })

  await test('trigger: required inputs — expected-commit and confirmation', () => {
    assert.ok(yml.includes('expected-commit:'), 'must declare expected-commit input')
    assert.ok(yml.includes('confirmation:'), 'must declare confirmation input')
    // Both must be required
    const commitInputBlock = yml.slice(yml.indexOf('expected-commit:'))
    const confirmInputBlock = yml.slice(yml.indexOf('confirmation:'))
    assert.ok(commitInputBlock.slice(0, 200).includes('required: true'), 'expected-commit must be required')
    assert.ok(confirmInputBlock.slice(0, 200).includes('required: true'), 'confirmation must be required')
  })

  // ─── Permissions ────────────────────────────────────────────────────────

  await test('permissions: contents read only — no write permissions', () => {
    assert.ok(yml.includes('contents: read'), 'must declare contents: read permission')
    assert.ok(!yml.includes('contents: write'), 'must not declare write permissions')
    assert.ok(!yml.includes('packages: write'), 'must not request packages write')
    assert.ok(!yml.includes('id-token: write'), 'must not request OIDC token write')
  })

  // ─── Concurrency ────────────────────────────────────────────────────────

  await test('concurrency: declared with cancel-in-progress: false', () => {
    assert.ok(yml.includes('concurrency:'), 'must declare concurrency block')
    assert.ok(yml.includes('staging-payload-migration-plan'), 'must use a specific concurrency group name')
    assert.ok(yml.includes('cancel-in-progress: false'), 'must not cancel in-progress runs')
  })

  // ─── Environment binding ─────────────────────────────────────────────────

  await test('environment: binds to staging-migration-plan environment', () => {
    assert.ok(
      yml.includes(`environment: ${REQUIRED_ENVIRONMENT}`),
      `must bind job to environment '${REQUIRED_ENVIRONMENT}'`,
    )
  })

  // ─── Confirmation guard ──────────────────────────────────────────────────

  await test('confirmation guard: rejects wrong confirmation string', () => {
    assert.ok(
      yml.includes(REQUIRED_CONFIRMATION),
      `must check for confirmation value '${REQUIRED_CONFIRMATION}'`,
    )
    assert.ok(yml.includes('PLAN-DENIED'), 'must output PLAN-DENIED on rejection')
  })

  // ─── SHA guards ──────────────────────────────────────────────────────────

  await test('sha guard: validates full 40-char hex SHA', () => {
    assert.ok(
      yml.includes('[0-9a-f]{40}') || yml.includes('40 lowercase'),
      'must validate that expected-commit is exactly 40 hex characters',
    )
    assert.ok(yml.includes('PLAN-DENIED'), 'must deny on invalid SHA')
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
      yml.includes('ref: ${{ inputs.expected-commit }}'),
      'checkout ref must be the input expected-commit',
    )
    assert.ok(yml.includes('fetch-depth: 0'), 'must fetch full history for ancestry check')
  })

  await test('sha guard: verifies checked-out SHA matches input after checkout', () => {
    assert.ok(
      yml.includes('git rev-parse HEAD'),
      'must verify HEAD SHA after checkout',
    )
    assert.ok(
      yml.includes('does not match') || yml.includes("!= '$INPUT_SHA'") || yml.includes('!= "$INPUT_SHA"'),
      'must compare actual SHA to input',
    )
  })

  await test('sha guard: verifies feature branch ancestry — not reachable from main', () => {
    assert.ok(
      yml.includes('merge-base --is-ancestor'),
      'must verify SHA ancestry under feature branch',
    )
    assert.ok(
      yml.includes(ALLOWED_BRANCH),
      `must name the allowed branch '${ALLOWED_BRANCH}'`,
    )
    assert.ok(
      yml.includes('origin/main'),
      'must also check SHA is not yet merged to main',
    )
  })

  await test('sha guard: verifies SHA matches current remote feature tip', () => {
    assert.ok(
      yml.includes('origin/feature/course-branding-and-preview'),
      'must compare input SHA to remote feature tip',
    )
    assert.ok(
      yml.includes('REMOTE_TIP') || yml.includes('remote tip'),
      'must reference remote tip comparison',
    )
  })

  // ─── Toolchain ───────────────────────────────────────────────────────────

  await test('toolchain: pnpm pinned at 10.33.0 with frozen install', () => {
    assert.ok(yml.includes('pnpm/action-setup@v2'), 'must use pnpm/action-setup')
    assert.ok(
      yml.includes(`version: ${REQUIRED_PNPM_VERSION}`),
      `must pin pnpm version to ${REQUIRED_PNPM_VERSION}`,
    )
    assert.ok(yml.includes('pnpm install --frozen-lockfile'), 'must install with frozen lockfile')
  })

  await test('toolchain: Node.js 20', () => {
    assert.ok(yml.includes('actions/setup-node@v4'), 'must use actions/setup-node@v4')
    assert.ok(
      yml.includes(`node-version: '${REQUIRED_NODE_VERSION}'`) || yml.includes(`node-version: "${REQUIRED_NODE_VERSION}"`),
      `must pin Node.js version to ${REQUIRED_NODE_VERSION}`,
    )
  })

  // ─── Credential masking ───────────────────────────────────────────────────

  await test('masking: DATABASE_URL is masked before use', () => {
    assert.ok(
      yml.includes('add-mask') || yml.includes('::add-mask::'),
      'must mask DATABASE_URL with ::add-mask::',
    )
    assert.ok(
      yml.includes('DATABASE_URL'),
      'must reference DATABASE_URL',
    )
    assert.ok(
      yml.includes('secrets.DATABASE_URL'),
      'DATABASE_URL must come from environment secrets',
    )
  })

  await test('masking: fails closed when DATABASE_URL is absent', () => {
    assert.ok(
      yml.includes('DATABASE_URL is not set') || yml.includes('DATABASE_URL:-}'),
      'must check for absent DATABASE_URL and fail closed',
    )
  })

  // ─── Network gate ─────────────────────────────────────────────────────────

  await test('network gate: probes staging host before running plan', () => {
    assert.ok(
      yml.includes(REQUIRED_HOSTNAME),
      `must reference staging hostname ${REQUIRED_HOSTNAME}`,
    )
    assert.ok(
      yml.includes('nc -z') || yml.includes('nc -w') || yml.includes('Tailscale') || yml.includes('tailscale'),
      'must probe network reachability to staging host',
    )
    assert.ok(
      yml.includes('PLAN-DENIED') || yml.includes('cannot reach'),
      'must fail closed when network path is absent',
    )
  })

  await test('network gate: references approved network path', () => {
    assert.ok(
      yml.includes('Tailscale') || yml.includes('tailscale') || yml.includes('private-network') || yml.includes('private NIC'),
      'must reference the approved Tailscale/private-network path',
    )
  })

  // ─── Exact command ────────────────────────────────────────────────────────

  await test('command: invokes pnpm staging:payload-migration-plan', () => {
    assert.ok(
      yml.includes('pnpm staging:payload-migration-plan'),
      'must invoke pnpm staging:payload-migration-plan',
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

  await test('command: PAYLOAD_MIGRATION_SCHEMA set to jpvbootcamp_staging', () => {
    assert.ok(
      yml.includes(`PAYLOAD_MIGRATION_SCHEMA: ${REQUIRED_SCHEMA}`),
      `must set PAYLOAD_MIGRATION_SCHEMA to ${REQUIRED_SCHEMA}`,
    )
  })

  // ─── Artifact sanitization ────────────────────────────────────────────────

  await test('artifact: uploads sanitized plan artifact', () => {
    assert.ok(yml.includes('actions/upload-artifact@v4'), 'must upload an artifact')
    assert.ok(
      yml.includes('staging-migration-plan-') || yml.includes('plan-result-sanitized'),
      'artifact must be named for this workflow',
    )
    assert.ok(yml.includes('retention-days:'), 'artifact must have retention policy')
  })

  await test('artifact: sanitization step extracts only safe fields', () => {
    // The sanitization step must use jq to extract specific safe fields only
    assert.ok(yml.includes('jq'), 'must use jq for sanitization')
    assert.ok(
      yml.includes('plan-result-sanitized.json'),
      'must produce a sanitized artifact file',
    )
    // Must explicitly check for credential-like strings
    assert.ok(
      yml.includes('password') && yml.includes('secret') && yml.includes('DATABASE_URL='),
      'sanitization check must look for credential-like strings',
    )
  })

  await test('artifact: never outputs raw DATABASE_URL, credentials, or env dumps', () => {
    // The plan step must NOT echo DATABASE_URL or print env
    assert.ok(!yml.includes('echo $DATABASE_URL'), 'must not echo DATABASE_URL')
    assert.ok(!yml.includes('printenv'), 'must not dump environment')
    assert.ok(!yml.includes('env | grep'), 'must not grep env output')
  })

  // ─── Forbidden commands ───────────────────────────────────────────────────

  await test('forbidden: no migration apply or down commands', () => {
    assert.ok(!yml.includes('payload-migration-apply'), 'must not invoke migration apply')
    assert.ok(!yml.includes('payload-migration-rollback'), 'must not invoke migration rollback')
    assert.ok(!yml.includes('migrate:down'), 'must not invoke migrate:down')
  })

  await test('forbidden: no Prisma deploy', () => {
    assert.ok(!yml.includes('prisma migrate deploy'), 'must not run prisma migrate deploy')
    assert.ok(!yml.includes('prisma db push'), 'must not run prisma db push')
  })

  await test('forbidden: no Dokploy redeploy or image publication', () => {
    assert.ok(!yml.includes('docker/build-push-action'), 'must not build or push Docker images')
    assert.ok(!yml.includes('docker/login-action'), 'must not log in to container registry')
    assert.ok(!yml.includes('DOKPLOY'), 'must not reference Dokploy APIs')
  })

  await test('forbidden: no SSH or arbitrary network commands', () => {
    assert.ok(!yml.includes('appleboy/ssh-action'), 'must not use SSH action')
    assert.ok(!yml.includes('ssh '), 'must not run ssh commands')
    assert.ok(!yml.includes('curl '), 'must not run curl commands')
    assert.ok(!yml.includes('wget '), 'must not run wget commands')
  })

  await test('forbidden: no push, merge, or repository mutations', () => {
    assert.ok(!yml.includes('git push'), 'must not push to any remote')
    // git merge-base is used for ancestry check (allowed); only bare 'git merge ' is forbidden
    assert.ok(!yml.match(/git merge\s+[^-]/), 'must not run git merge to merge branches')
    assert.ok(!yml.includes('git commit'), 'must not create commits')
    assert.ok(!yml.includes('contents: write'), 'must not request write permissions')
  })

  await test('forbidden: no provider, billing, or member actions', () => {
    assert.ok(!yml.includes('stripe'), 'must not reference Stripe')
    assert.ok(!yml.includes('resend'), 'must not reference email provider')
    assert.ok(!yml.includes('livekit'), 'must not reference LiveKit')
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('Contract test runner error:', error)
  process.exitCode = 1
})
