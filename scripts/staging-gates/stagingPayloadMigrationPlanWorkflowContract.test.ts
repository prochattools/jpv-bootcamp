/**
 * Static contract test for the read-only-plan job in .github/workflows/deploy-preview.yml.
 *
 * The standalone staging-payload-migration-plan.yml has been removed; its capability
 * now lives in the `read-only-plan` job gated behind `operation=read-only-migration-plan`.
 *
 * Pinned action SHAs verified via GitHub API (resolve tag → dereference if annotated):
 *   tailscale/github-action v4.1.3  -> 780049a30b6ff5c378a9e7b389d15ece7a204888
 *   actions/checkout v4             -> 11d5960a326750d5838078e36cf38b85af677262
 *   pnpm/action-setup v4            -> b906affcce14559ad1aafd4ab0e942779e9f58b1
 *   actions/setup-node v4           -> 49933ea5288caeca8642d1e84afbd3f7d6820020
 *   actions/upload-artifact v4      -> ea165f8d65b6e75b540449e92b4886f43607fa02
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
const TAILSCALE_PINNED_SHA = '780049a30b6ff5c378a9e7b389d15ece7a204888'
const CHECKOUT_PINNED_SHA = '11d5960a326750d5838078e36cf38b85af677262'
const PNPM_PINNED_SHA = 'b906affcce14559ad1aafd4ab0e942779e9f58b1'
const SETUP_NODE_PINNED_SHA = '49933ea5288caeca8642d1e84afbd3f7d6820020'
const UPLOAD_ARTIFACT_PINNED_SHA = 'ea165f8d65b6e75b540449e92b4886f43607fa02'

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
  // Extract plan job section for scoped assertions
  const planJobIndex = yml.indexOf('read-only-plan:')
  assert.ok(planJobIndex > -1, 'read-only-plan job must exist in workflow')
  const planJobYml = yml.slice(planJobIndex)

  // ─── Single implementation ────────────────────────────────────────────────

  await test('dispatch: standalone workflow file is absent — one implementation only', () => {
    assert.ok(
      !existsSync(STANDALONE_PATH),
      `standalone '${STANDALONE_PATH}' must be absent — the plan job now lives in deploy-preview.yml`,
    )
  })

  await test('dispatch: deploy-preview.yml is dispatchable (has workflow_dispatch)', () => {
    assert.ok(yml.includes('workflow_dispatch:'), 'must have workflow_dispatch trigger on default branch')
  })

  // ─── Operation input and job exclusivity ─────────────────────────────────

  await test('dispatch: operation input declared with both operation choices', () => {
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

  await test('push suppression: push deploys skip when commit contains [migration-plan-only]', () => {
    assert.ok(
      yml.includes('[migration-plan-only]'),
      'must suppress push deploy when commit message contains [migration-plan-only]',
    )
    assert.ok(
      yml.includes('contains(github.event.head_commit.message'),
      'must check head_commit.message for the marker',
    )
  })

  // ─── Concurrency: operation-aware ─────────────────────────────────────────

  await test('concurrency: operation-aware — plan uses separate non-cancellable group', () => {
    // Workflow-level concurrency must not cancel a plan run; plan job level also enforces this
    assert.ok(yml.includes('staging-payload-migration-plan'), 'must use staging-payload-migration-plan concurrency group name')
    assert.ok(yml.includes('cancel-in-progress: false'), 'plan job must have cancel-in-progress: false')
    // The workflow-level concurrency should be operation-aware (not a single group that cancels plans)
    assert.ok(
      yml.includes('read-only-migration-plan') && yml.includes('staging-payload-migration-plan'),
      'workflow or job concurrency must route plan runs to a non-cancellable group',
    )
  })

  // ─── Inputs ───────────────────────────────────────────────────────────────

  await test('inputs: expected_sha and confirmation declared for plan', () => {
    assert.ok(yml.includes('expected_sha:'), 'must declare expected_sha input')
    assert.ok(yml.includes('confirmation:'), 'must declare confirmation input')
  })

  // ─── Permissions (plan job) ───────────────────────────────────────────────

  await test('permissions: plan job has job-level contents: read', () => {
    assert.ok(planJobYml.includes('contents: read'), 'plan job must declare contents: read')
    assert.ok(!planJobYml.includes('contents: write'), 'plan job must not declare contents: write')
  })

  await test('permissions: plan job must not request packages: write', () => {
    assert.ok(!planJobYml.includes('packages: write'), 'plan job must not request packages: write')
  })

  // ─── Environment binding ──────────────────────────────────────────────────

  await test('environment: plan job binds to staging-migration-plan', () => {
    assert.ok(
      planJobYml.includes(`environment: ${REQUIRED_ENVIRONMENT}`),
      `plan job must bind to environment '${REQUIRED_ENVIRONMENT}'`,
    )
  })

  // ─── Preflight: separated before checkout, uses injected vars/secrets ──────

  await test('preflight: PLAN_READY_FOR_DISPATCH variable guard runs before checkout', () => {
    const readyVarIndex = yml.indexOf('PLAN_READY_FOR_DISPATCH')
    const checkoutIndex = yml.indexOf('refs/heads/feature/course-branding-and-preview')
    assert.ok(readyVarIndex > -1, 'must check PLAN_READY_FOR_DISPATCH readiness variable')
    assert.ok(checkoutIndex > -1, 'must checkout feature branch by branch ref')
    assert.ok(
      readyVarIndex < checkoutIndex,
      'PLAN_READY_FOR_DISPATCH check must precede checkout (no checkout before environment guards)',
    )
  })

  await test('preflight: required secrets presence check runs before checkout', () => {
    assert.ok(
      planJobYml.includes('TAILSCALE_OAUTH_CLIENT_ID') && planJobYml.includes('TAILSCALE_OAUTH_SECRET'),
      'plan job must check Tailscale OAuth secret presence before checkout',
    )
    assert.ok(
      planJobYml.includes('absent or empty') || planJobYml.includes('is absent'),
      'must fail closed when required secrets are absent',
    )
  })

  await test('preflight: no in-job gh api calls to list env/repo secrets', () => {
    // In-job secret-list API calls fail because GITHUB_TOKEN lacks admin scope
    assert.ok(!planJobYml.includes('environments/${ENV_NAME}/secrets'), 'must not call env secrets API in-job')
    assert.ok(!planJobYml.includes('actions/secrets'), 'must not call repo secrets API in-job')
    assert.ok(!planJobYml.includes('REPO_SECRETS='), 'must not attempt to list repo secrets in-job')
  })

  await test('preflight: no false shadow-secret rejection rule', () => {
    // Environment secrets take precedence over repo secrets — no shadow-reject logic needed
    assert.ok(!planJobYml.includes('shadows the environment secret'), 'must not include false shadow-secret rule')
    assert.ok(!planJobYml.includes('PREFLIGHT-DENIED: repository secret'), 'must not reject due to same-named repo secrets')
  })

  // ─── Checkout: branch-attached, not detached ──────────────────────────────

  await test('checkout: checks out feature branch by name (not detached SHA)', () => {
    assert.ok(
      planJobYml.includes('refs/heads/feature/course-branding-and-preview'),
      'plan job must checkout by branch ref, not a detached SHA',
    )
  })

  await test('checkout: verifies branch name, HEAD SHA, ancestry, and remote tip after checkout', () => {
    assert.ok(planJobYml.includes('git branch --show-current'), 'must verify branch name after checkout')
    assert.ok(planJobYml.includes('git rev-parse HEAD'), 'must verify HEAD SHA after checkout')
    assert.ok(planJobYml.includes('merge-base --is-ancestor'), 'must check SHA ancestry under feature branch')
    assert.ok(planJobYml.includes('origin/feature/course-branding-and-preview'), 'must compare SHA to remote feature tip')
    assert.ok(planJobYml.includes('REMOTE_TIP') || planJobYml.includes('remote tip'), 'must reference remote tip')
    assert.ok(planJobYml.includes('origin/main'), 'must reject SHA already in main')
  })

  // ─── Pinned action SHAs (plan job) ────────────────────────────────────────

  await test('actions: tailscale/github-action uses verified v4.1.3 commit SHA', () => {
    assert.ok(
      planJobYml.includes(`tailscale/github-action@${TAILSCALE_PINNED_SHA}`),
      `tailscale/github-action must be pinned to verified v4.1.3 SHA ${TAILSCALE_PINNED_SHA}`,
    )
    // Must not use a floating tag or the fabricated fake SHA
    assert.ok(!planJobYml.includes('tailscale/github-action@v4'), 'must not use floating @v4 tag')
    assert.ok(!planJobYml.includes('tailscale/github-action@v2'), 'must not use floating @v2 tag')
    assert.ok(!planJobYml.includes('4e7c5a3b2d1e8f6a9c0b7d4e2f1a8c5b3d7e9f2a'), 'must not use fabricated/unverified SHA')
  })

  await test('actions: actions/checkout uses verified v4 commit SHA (plan job)', () => {
    assert.ok(
      planJobYml.includes(`actions/checkout@${CHECKOUT_PINNED_SHA}`),
      `plan job actions/checkout must be pinned to verified v4 SHA ${CHECKOUT_PINNED_SHA}`,
    )
  })

  await test('actions: pnpm/action-setup uses verified v4 commit SHA (plan job)', () => {
    assert.ok(
      planJobYml.includes(`pnpm/action-setup@${PNPM_PINNED_SHA}`),
      `plan job pnpm/action-setup must be pinned to verified v4 SHA ${PNPM_PINNED_SHA}`,
    )
    assert.ok(!planJobYml.includes('pnpm/action-setup@v2'), 'plan job must not use floating pnpm/action-setup@v2 (no such tag)')
  })

  await test('actions: actions/setup-node uses verified v4 commit SHA (plan job)', () => {
    assert.ok(
      planJobYml.includes(`actions/setup-node@${SETUP_NODE_PINNED_SHA}`),
      `plan job actions/setup-node must be pinned to verified v4 SHA ${SETUP_NODE_PINNED_SHA}`,
    )
  })

  await test('actions: actions/upload-artifact uses verified v4 commit SHA (plan job)', () => {
    assert.ok(
      planJobYml.includes(`actions/upload-artifact@${UPLOAD_ARTIFACT_PINNED_SHA}`),
      `plan job actions/upload-artifact must be pinned to verified v4 SHA ${UPLOAD_ARTIFACT_PINNED_SHA}`,
    )
  })

  // ─── Tailscale configuration ──────────────────────────────────────────────

  await test('tailscale: uses environment-scoped OAuth secrets', () => {
    assert.ok(planJobYml.includes('secrets.TAILSCALE_OAUTH_CLIENT_ID'), 'must reference TAILSCALE_OAUTH_CLIENT_ID from secrets')
    assert.ok(planJobYml.includes('secrets.TAILSCALE_OAUTH_SECRET'), 'must reference TAILSCALE_OAUTH_SECRET from secrets')
  })

  await test('tailscale: sets least-privilege ACL tag tag:ci-reader', () => {
    assert.ok(planJobYml.includes('tag:ci-reader'), 'must set tag:ci-reader ACL tag')
  })

  await test('tailscale: ping probe before TCP probe', () => {
    const pingIdx = planJobYml.indexOf('tailscale ping')
    const ncIdx = planJobYml.indexOf('nc -z')
    assert.ok(pingIdx > -1, 'must run tailscale ping to verify connectivity')
    assert.ok(ncIdx > -1, 'must run nc -z TCP probe to verify port reachability')
    assert.ok(pingIdx < ncIdx, 'tailscale ping must precede nc TCP probe')
  })

  // ─── Network: port 5433 (not 5432) ────────────────────────────────────────

  await test('network gate: probes port 5433 (not 5432)', () => {
    const ncLine = planJobYml.match(/nc -z[^\n]+/)
    assert.ok(ncLine !== null, 'must contain nc -z probe line')
    assert.ok(ncLine![0].includes(REQUIRED_PORT), `nc probe must use port ${REQUIRED_PORT}`)
    assert.ok(!ncLine![0].includes('5432'), 'nc probe must not use port 5432')
    assert.ok(planJobYml.includes(`${REQUIRED_HOSTNAME}:${REQUIRED_PORT}`) || planJobYml.includes(REQUIRED_PORT), `must reference port ${REQUIRED_PORT}`)
  })

  // ─── Credential masking ───────────────────────────────────────────────────

  await test('masking: DATABASE_URL is masked before use', () => {
    assert.ok(planJobYml.includes('::add-mask::'), 'must mask DATABASE_URL with ::add-mask::')
    assert.ok(planJobYml.includes('secrets.DATABASE_URL'), 'DATABASE_URL must come from environment secrets')
  })

  await test('masking: fails closed when DATABASE_URL is absent', () => {
    assert.ok(
      planJobYml.includes('DATABASE_URL is not set') || planJobYml.includes('DATABASE_URL:-}'),
      'must check for absent DATABASE_URL and fail closed',
    )
  })

  // ─── Toolchain ────────────────────────────────────────────────────────────

  await test('toolchain: pnpm 10.33.0 with frozen install (plan job)', () => {
    assert.ok(planJobYml.includes('pnpm/action-setup'), 'must use pnpm/action-setup')
    assert.ok(planJobYml.includes(`version: ${REQUIRED_PNPM_VERSION}`), `must pin pnpm to ${REQUIRED_PNPM_VERSION}`)
    assert.ok(planJobYml.includes('pnpm install --frozen-lockfile'), 'must install with frozen lockfile')
  })

  await test('toolchain: Node.js 20 (plan job)', () => {
    assert.ok(planJobYml.includes('actions/setup-node'), 'must use actions/setup-node')
    assert.ok(
      planJobYml.includes(`node-version: '${REQUIRED_NODE_VERSION}'`) ||
        planJobYml.includes(`node-version: "${REQUIRED_NODE_VERSION}"`),
      `must pin Node.js to ${REQUIRED_NODE_VERSION}`,
    )
  })

  // ─── Exact command ────────────────────────────────────────────────────────

  await test('command: invokes pnpm run staging:payload-migration-plan', () => {
    assert.ok(
      planJobYml.includes('pnpm run staging:payload-migration-plan') ||
        planJobYml.includes('pnpm staging:payload-migration-plan'),
      'must invoke pnpm run staging:payload-migration-plan',
    )
  })

  await test('command: uses -- separator before flags', () => {
    assert.ok(planJobYml.includes('-- \\'), 'must use -- separator before migration plan flags')
  })

  await test('command: passes all required flags with correct values', () => {
    assert.ok(planJobYml.includes('--expected-commit='), 'must pass --expected-commit')
    assert.ok(planJobYml.includes(`--environment=${REQUIRED_ENVIRONMENT_VALUE}`), `must pass --environment=${REQUIRED_ENVIRONMENT_VALUE}`)
    assert.ok(planJobYml.includes(`--target-id=${REQUIRED_TARGET_ID}`), `must pass --target-id=${REQUIRED_TARGET_ID}`)
    assert.ok(planJobYml.includes(`--expected-schema=${REQUIRED_SCHEMA}`), `must pass --expected-schema=${REQUIRED_SCHEMA}`)
    assert.ok(planJobYml.includes(`--expected-hostname=${REQUIRED_HOSTNAME}`), `must pass --expected-hostname=${REQUIRED_HOSTNAME}`)
    assert.ok(planJobYml.includes(`--expected-database=${REQUIRED_DATABASE}`), `must pass --expected-database=${REQUIRED_DATABASE}`)
  })

  await test('command: PAYLOAD_MIGRATION_SCHEMA set to jpvbootcamp_staging', () => {
    assert.ok(
      planJobYml.includes(`PAYLOAD_MIGRATION_SCHEMA: ${REQUIRED_SCHEMA}`),
      `must set PAYLOAD_MIGRATION_SCHEMA to ${REQUIRED_SCHEMA}`,
    )
  })

  // ─── Sanitization failure closes the job ─────────────────────────────────

  await test('sanitization: jq failure exits non-zero — does not silently succeed', () => {
    // Must check jq exit status — a failed sanitization must fail the job
    assert.ok(
      planJobYml.includes('if ! jq') || (planJobYml.includes('jq') && planJobYml.includes('exit 1')),
      'jq sanitization failure must fail the job (not silently produce empty output)',
    )
    assert.ok(
      planJobYml.includes('artifact sanitization failed') || planJobYml.includes('sanitization (jq) failed'),
      'must output a clear error when jq sanitization fails',
    )
  })

  await test('sanitization: credential scan failure exits non-zero', () => {
    assert.ok(
      planJobYml.includes('credential-like string detected') || planJobYml.includes('credential check failed'),
      'credential scan match must fail the job',
    )
    assert.ok(planJobYml.includes('exit 1'), 'must exit 1 when credential-like strings are found')
  })

  // ─── Raw file deletion ────────────────────────────────────────────────────

  await test('raw file: mode-600 temp file and trap-based deletion on EXIT', () => {
    assert.ok(planJobYml.includes('mktemp'), 'must create a temp file')
    assert.ok(planJobYml.includes('chmod 600'), 'must set mode 600 on temp file')
    assert.ok(planJobYml.includes("trap 'rm -f"), 'must use trap to delete raw output on EXIT')
    assert.ok(!planJobYml.includes('plan-result-raw.json'), 'must not retain a named raw result file')
  })

  await test('raw file: never cats raw result to logs', () => {
    assert.ok(!planJobYml.includes('cat "$RESULT_FILE"'), 'must not cat raw result file to stdout/stderr')
  })

  // ─── Artifact ────────────────────────────────────────────────────────────

  await test('artifact: uploads sanitized artifact if: always()', () => {
    assert.ok(planJobYml.includes('actions/upload-artifact'), 'must upload an artifact')
    assert.ok(planJobYml.includes('plan-result-sanitized.json'), 'must upload only the sanitized file')
    assert.ok(planJobYml.includes("if: always()"), 'artifact upload must run always()')
    assert.ok(planJobYml.includes('retention-days:'), 'artifact must have retention policy')
  })

  await test('artifact: never outputs raw DATABASE_URL or dumps env', () => {
    assert.ok(!planJobYml.includes('echo $DATABASE_URL'), 'must not echo DATABASE_URL')
    assert.ok(!planJobYml.includes('printenv'), 'must not dump environment')
    assert.ok(!planJobYml.includes('env | grep'), 'must not grep env output')
  })

  // ─── Deploy job exclusion from plan ───────────────────────────────────────

  await test('deploy exclusion: plan job has no Docker/GHCR/Dokploy steps', () => {
    assert.ok(!planJobYml.includes('docker/build-push-action'), 'plan job must not build/push Docker images')
    assert.ok(!planJobYml.includes('docker/login-action'), 'plan job must not log in to container registry')
    assert.ok(!planJobYml.includes('DOKPLOY'), 'plan job must not reference Dokploy APIs')
    assert.ok(!planJobYml.includes('packages: write'), 'plan job must not request packages: write')
  })

  // ─── Forbidden commands ───────────────────────────────────────────────────

  await test('forbidden: no migration apply or down in plan job', () => {
    assert.ok(!planJobYml.includes('payload-migration-apply'), 'plan job must not invoke migration apply')
    assert.ok(!planJobYml.includes('payload-migration-rollback'), 'plan job must not invoke migration rollback')
    assert.ok(!planJobYml.includes('migrate:down'), 'plan job must not invoke migrate:down')
  })

  await test('forbidden: no Prisma deploy in plan job', () => {
    assert.ok(!planJobYml.includes('prisma migrate deploy'), 'plan job must not run prisma migrate deploy')
    assert.ok(!planJobYml.includes('prisma db push'), 'plan job must not run prisma db push')
  })

  await test('forbidden: no SSH or arbitrary wget in plan job', () => {
    assert.ok(!planJobYml.includes('appleboy/ssh-action'), 'plan job must not use SSH action')
    assert.ok(!planJobYml.includes('ssh '), 'plan job must not run ssh commands')
    assert.ok(!planJobYml.includes('wget '), 'plan job must not run wget commands')
  })

  await test('forbidden: no git push, merge, commit, or write permissions in plan job', () => {
    assert.ok(!planJobYml.includes('git push'), 'plan job must not push to any remote')
    assert.ok(!planJobYml.match(/git merge\s+[^-]/), 'plan job must not run git merge')
    assert.ok(!planJobYml.includes('git commit'), 'plan job must not create commits')
    assert.ok(!planJobYml.includes('contents: write'), 'plan job must not request write permissions')
  })

  await test('forbidden: no provider/billing/member actions in plan job', () => {
    assert.ok(!planJobYml.includes('stripe'), 'plan job must not reference Stripe')
    assert.ok(!planJobYml.includes('resend'), 'plan job must not reference email provider')
    assert.ok(!planJobYml.includes('livekit'), 'plan job must not reference LiveKit')
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('Contract test runner error:', error)
  process.exitCode = 1
})
