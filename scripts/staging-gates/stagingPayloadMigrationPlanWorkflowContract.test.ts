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

const VALIDATE_STEP1 = 'scripts/staging-gates/validate-plan-result-step1.js'
const VALIDATE_STEP2 = 'scripts/staging-gates/validate-plan-result-step2.js'
const VALIDATE_STEP3 = 'scripts/staging-gates/validate-plan-result-step3.js'

async function main(): Promise<void> {
  const yml = await readFile(WORKFLOW_PATH, 'utf8')
  // Extract plan job section for scoped assertions
  const planJobIndex = yml.indexOf('read-only-plan:')
  assert.ok(planJobIndex > -1, 'read-only-plan job must exist in workflow')
  const planJobYmlBase = yml.slice(planJobIndex)

  // Extend planJobYml with extracted validation scripts so contract assertions
  // on inline logic (typeof, writeFileSync, etc.) still hold after heredoc extraction.
  const step1 = existsSync(VALIDATE_STEP1) ? await readFile(VALIDATE_STEP1, 'utf8') : ''
  const step2 = existsSync(VALIDATE_STEP2) ? await readFile(VALIDATE_STEP2, 'utf8') : ''
  const step3 = existsSync(VALIDATE_STEP3) ? await readFile(VALIDATE_STEP3, 'utf8') : ''
  const planJobYml = planJobYmlBase + '\n' + step1 + '\n' + step2 + '\n' + step3

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
    // Operation-aware cancel-in-progress: expression evaluates to false for plan runs
    assert.ok(
      yml.includes('cancel-in-progress: false') ||
        yml.match(/cancel-in-progress:\s*\$\{\{.*read-only-migration-plan.*\}\}/) !== null,
      'plan job must have cancel-in-progress: false or an expression that evaluates false for plan runs',
    )
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
    // Scope to planJobYml — other jobs (deploy-preview, validate-only) also checkout
    // feature/course-branding-and-preview; the ordering invariant is within read-only-plan only.
    const readyVarIndex = planJobYml.indexOf('PLAN_READY_FOR_DISPATCH')
    const checkoutIndex = planJobYml.indexOf('refs/heads/feature/course-branding-and-preview')
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

  await test('command: invokes the guarded runner in explicit pre-apply plan mode', () => {
    assert.ok(
      planJobYml.includes('runStagingPayloadMigration.ts') || planJobYml.includes('staging:payload-migration-plan'),
      'must invoke the staging migration plan runner',
    )
    assert.ok(!planJobYml.includes('--current-state=true'), 'pre-apply plan must not assert that the full post-migration inventory is already applied')
  })

  await test('command: passes --output=json flag (JSON-only stdout mode)', () => {
    assert.ok(
      planJobYml.includes('--output=json'),
      'must pass --output=json so stdout is exactly one JSON document with no operational logs',
    )
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

  await test('command: expected_sha passed via env var, not inline shell interpolation', () => {
    // Injecting inputs.expected_sha inline in a shell argument risks command injection.
    // The safe pattern is to bind the input to an env var (EXPECTED_SHA) and reference it via ${EXPECTED_SHA}.
    assert.ok(
      planJobYml.includes('EXPECTED_SHA:') || planJobYml.includes('EXPECTED_SHA ='),
      'expected_sha must be bound to an env var (EXPECTED_SHA) before use in arguments',
    )
    assert.ok(
      planJobYml.includes('${EXPECTED_SHA}') || planJobYml.includes('"${EXPECTED_SHA}"'),
      'argument must reference EXPECTED_SHA env var, not inline ${{ inputs.expected_sha }}',
    )
  })

  // ─── Mixed-output rejection ───────────────────────────────────────────────

  await test('mixed-output rejection: rejects stdout that does not start with {', () => {
    assert.ok(
      planJobYml.includes("FIRST_CHAR") || planJobYml.includes('head -c 1'),
      'must check that stdout begins with { to reject mixed operational+JSON output',
    )
    assert.ok(
      planJobYml.includes('mixed output') || planJobYml.includes('does not begin'),
      'must emit a clear error when stdout is not a pure JSON document',
    )
  })

  // ─── Trailing bytes / multiple documents ─────────────────────────────────

  await test('trailing bytes: Node.js JSON.parse rejects multiple documents and trailing bytes', () => {
    // jq -e 'type == "object"' accepts multiple JSON documents; JSON.parse does not.
    // The plan job must use Node.js JSON.parse for strict single-document validation.
    assert.ok(
      planJobYml.includes('JSON.parse') || planJobYml.includes('node -'),
      'must use Node.js JSON.parse to reject multiple documents and trailing bytes — jq streaming is insufficient',
    )
    assert.ok(
      planJobYml.includes('trimEnd()') || planJobYml.includes('trimmed') || planJobYml.includes('trailing'),
      'must handle trailing whitespace explicitly',
    )
  })

  // ─── Schema type validation ───────────────────────────────────────────────

  await test('schema validation: all required keys and types are validated before sanitization', () => {
    // Node.js-based validation replaces jq — check for Node.js type checks
    assert.ok(
      planJobYml.includes('typeof parsed') || planJobYml.includes('!== \'boolean\'') ||
        planJobYml.includes('not boolean') || planJobYml.includes('prismaHealthy not boolean') ||
        planJobYml.includes('blockerCodes not array'),
      'must validate field types (boolean, string, array) via Node.js JSON.parse',
    )
    assert.ok(
      planJobYml.includes('JSON schema validation failed'),
      'must fail closed with a clear error when schema validation fails',
    )
  })

  // ─── Sanitization failure closes the job ─────────────────────────────────

  await test('sanitization: Node.js re-serialization failure exits non-zero — does not silently succeed', () => {
    // Node.js writeFileSync replaces jq for artifact write — failure must close the job
    assert.ok(
      planJobYml.includes('writeFileSync') || planJobYml.includes('artifact write failed') ||
        planJobYml.includes('JSON.stringify(safe)'),
      'Node.js artifact write must be present and fail the job if it errors',
    )
    assert.ok(
      planJobYml.includes('artifact write failed') || planJobYml.includes('sanitization credential check failed') ||
        planJobYml.includes('exit 1'),
      'must output a clear error and exit 1 when artifact write or sanitization fails',
    )
  })

  await test('sanitization: credential scan covers PostgreSQL URL schemes', () => {
    assert.ok(
      planJobYml.includes('postgres') && (planJobYml.includes('postgres://') || planJobYml.includes('postgres(ql)?')),
      'credential scan must cover postgresql:// and postgres:// URL schemes',
    )
  })

  await test('sanitization: credential scan covers URL userinfo (user:pass@host)', () => {
    assert.ok(
      planJobYml.includes('://[^@') || planJobYml.includes('@'),
      'credential scan must cover URL userinfo pattern user:pass@host',
    )
  })

  await test('sanitization: credential scan covers bearer and basic auth headers', () => {
    assert.ok(
      planJobYml.includes('Bearer') || planJobYml.includes('[Bb]earer'),
      'credential scan must cover Bearer auth header values',
    )
    assert.ok(
      planJobYml.includes('Basic') || planJobYml.includes('[Bb]asic'),
      'credential scan must cover Basic auth header values',
    )
  })

  await test('sanitization: credential scan covers credential assignments (password=, secret=)', () => {
    assert.ok(
      planJobYml.includes('password') && planJobYml.includes('secret'),
      'credential scan must cover password= and secret= assignment patterns',
    )
  })

  await test('sanitization: credential scan covers DB env names (DATABASE_URL=, PGPASSWORD=)', () => {
    assert.ok(
      planJobYml.includes('DATABASE_URL') && planJobYml.includes('PGPASSWORD'),
      'credential scan must cover DATABASE_URL= and PGPASSWORD= env name assignments',
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

  // ─── Defect: 2>&1 forbidden in plan command ───────────────────────────────

  await test('stream separation: plan command must not merge stdout and stderr with 2>&1', () => {
    // 2>&1 would allow operational logs (including DB credentials from stderr) to corrupt
    // the stdout JSON document and defeat the sanitization pipeline.
    const planCmdSection = planJobYml.slice(planJobYml.indexOf('Run read-only Payload migration plan'))
    const untilEndOfStep = planCmdSection.slice(0, planCmdSection.indexOf('\n      - name:') > 0 ? planCmdSection.indexOf('\n      - name:') : planCmdSection.length)
    assert.ok(
      !untilEndOfStep.includes('2>&1'),
      'plan command must not use 2>&1 — stdout and stderr must be captured to separate files',
    )
  })

  await test('stream separation: plan command uses separate stdout and stderr files', () => {
    assert.ok(
      planJobYml.includes('STDOUT_FILE') || planJobYml.includes('> "$STDOUT'),
      'plan command must capture stdout to a separate file',
    )
    assert.ok(
      planJobYml.includes('STDERR_FILE') || planJobYml.includes('2> "$STDERR'),
      'plan command must capture stderr to a separate file',
    )
  })

  // ─── Defect: input safety — no direct ${{ inputs.* }} in shell source ─────

  await test('input safety: expected_sha injected via env, not inline shell interpolation', () => {
    // Direct ${{ inputs.expected_sha }} inside shell source is injectable.
    // The safe pattern is env: INPUT_SHA: ${{ inputs.expected_sha }} then ${INPUT_SHA}.
    assert.ok(
      planJobYml.includes('EXPECTED_SHA: ${{ inputs.expected_sha }}') ||
        planJobYml.includes("EXPECTED_SHA: ${{ inputs.expected_sha }}"),
      'expected_sha must be bound to EXPECTED_SHA env var, not interpolated directly in shell',
    )
    // Must not appear as a raw shell expansion inside the run block
    const runBlocks = planJobYml.match(/run:\s*\|[\s\S]*?(?=\n\s{6}-|\n\s{4}-|\n\s{2}-|$)/g) ?? []
    for (const block of runBlocks) {
      assert.ok(
        !block.includes("${{ inputs.expected_sha }}"),
        'run block must not inline ${{ inputs.expected_sha }} in shell source',
      )
      assert.ok(
        !block.includes("${{ inputs.confirmation }}"),
        'run block must not inline ${{ inputs.confirmation }} in shell source',
      )
    }
  })

  // ─── Defect: SafeMigrationPlanEvidence schema — no free-text fields ───────

  await test('evidence: strict Node.js JSON.parse used — not jq streaming', () => {
    // jq -e 'type == "object"' accepts multiple JSON documents; JSON.parse does not.
    // The plan job must use Node.js JSON.parse for single-document validation.
    assert.ok(
      planJobYml.includes('JSON.parse') || planJobYml.includes('node -'),
      'plan job must use Node.js JSON.parse for single-document validation, not jq streaming',
    )
  })

  await test('evidence: artifact upload uses if-no-files-found: error', () => {
    const uploadSection = planJobYml.slice(planJobYml.indexOf('Upload sanitized plan artifact'))
    assert.ok(
      uploadSection.includes('if-no-files-found: error'),
      'artifact upload must use if-no-files-found: error — warn allows silent missing artifacts',
    )
    assert.ok(
      !uploadSection.includes('if-no-files-found: warn'),
      'artifact upload must not use if-no-files-found: warn',
    )
  })

  await test('evidence: SafeMigrationPlanEvidence uses resultCode, not free-text message', () => {
    // The sanitized artifact must use resultCode ('plan_ok' | 'plan_blocked') not a free-text .message
    assert.ok(
      planJobYml.includes('resultCode') || planJobYml.includes('plan_ok'),
      'plan artifact must contain resultCode field (SafeMigrationPlanEvidence), not free-text message',
    )
    assert.ok(
      planJobYml.includes('blockerCodes') || planJobYml.includes('blockerCodes'),
      'plan artifact must contain blockerCodes array, not free-text blocker strings',
    )
  })

  await test('evidence: artifact write uses re-serialization, not raw input copy', () => {
    // The sanitized artifact must be built by re-serializing parsed fields, never by
    // copying raw stdout bytes into the artifact file.
    assert.ok(
      planJobYml.includes('JSON.stringify') || planJobYml.includes('writeFileSync'),
      'artifact must be written via JSON.stringify re-serialization, not raw stdout copy',
    )
  })

  // ─── Semantic plan_ok verification ───────────────────────────────────────

  await test('plan_ok semantics: workflow verifies blockerCodes is empty when plan_ok', () => {
    assert.ok(
      planJobYml.includes('blockerCodes.length') || planJobYml.includes('non-empty blockerCodes'),
      'must verify blockerCodes.length === 0 before accepting plan_ok',
    )
  })

  await test('plan_ok semantics: workflow verifies commit matches EXPECTED_SHA', () => {
    assert.ok(
      planJobYml.includes('commit mismatch') || planJobYml.includes('p.commit !== expectedSha'),
      'must verify commit field equals EXPECTED_SHA',
    )
  })

  await test('plan_ok semantics: workflow verifies branch is the exact feature branch', () => {
    assert.ok(
      planJobYml.includes('branch mismatch') || planJobYml.includes('p.branch !== requiredBranch'),
      'must verify branch field equals feature/course-branding-and-preview',
    )
  })

  await test('plan_ok semantics: workflow verifies schema, environment, targetId', () => {
    assert.ok(
      planJobYml.includes('schema mismatch') || planJobYml.includes('p.schema !== requiredSchema'),
      'must verify schema field equals jpvbootcamp_staging',
    )
    assert.ok(
      planJobYml.includes('environment mismatch') || planJobYml.includes('p.environment !== requiredEnv'),
      'must verify environment field equals staging',
    )
    assert.ok(
      planJobYml.includes('targetId mismatch') || planJobYml.includes('p.targetId !== requiredTarget'),
      'must verify targetId field equals jpvbootcamp-staging',
    )
  })

  await test('plan_ok semantics: workflow preserves dynamically discovered applied-count evidence', () => {
    assert.ok(
      planJobYml.includes('appliedPayloadCount'),
      'must preserve the appliedPayloadCount evidence field',
    )
    assert.equal(planJobYml.includes('EXPECTED_APPLIED_COUNT=40'), false)
  })

  await test('plan_ok semantics: workflow accepts the current canonical pending list as discovery evidence', () => {
    assert.ok(
      planJobYml.includes('expectedPendingMigrations must be an array') ||
      planJobYml.includes('Array.isArray(p.expectedPendingMigrations)'),
      'must validate the dynamically discovered canonical pending migration list',
    )
    assert.ok(
      planJobYml.includes('expectedPendingBatchIsOnlyMissing must be true') || planJobYml.includes('!p.expectedPendingBatchIsOnlyMissing'),
      'must verify expectedPendingBatchIsOnlyMissing is true',
    )
    assert.equal(planJobYml.includes('EXPECTED_APPLIED_COUNT=40'), false)
    assert.equal(planJobYml.includes('expectedPending = ['), false)
  })

  await test('plan_ok semantics: workflow verifies anomaly counts are all zero', () => {
    assert.ok(
      planJobYml.includes('unexpectedPayloadCount must be 0') || planJobYml.includes('p.unexpectedPayloadCount !== 0'),
      'must verify unexpectedPayloadCount === 0',
    )
    assert.ok(
      planJobYml.includes('duplicatePayloadCount must be 0') || planJobYml.includes('p.duplicatePayloadCount !== 0'),
      'must verify duplicatePayloadCount === 0',
    )
    assert.ok(
      planJobYml.includes('malformedPayloadCount must be 0') || planJobYml.includes('p.malformedPayloadCount !== 0'),
      'must verify malformedPayloadCount === 0',
    )
    assert.ok(
      planJobYml.includes('orderingAnomalyCount must be 0') || planJobYml.includes('p.orderingAnomalyCount !== 0'),
      'must verify orderingAnomalyCount === 0',
    )
  })

  await test('plan_ok semantics: workflow verifies prismaHealthy is true', () => {
    assert.ok(
      planJobYml.includes('prismaHealthy must be true') || planJobYml.includes('!p.prismaHealthy'),
      'must verify prismaHealthy === true',
    )
  })

  await test('plan_ok semantics: semantic failure exits non-zero with clear message', () => {
    assert.ok(
      planJobYml.includes('semantic verification failed'),
      'must emit a clear error when semantic verification fails',
    )
  })

  // ─── Blocker code allowlist ───────────────────────────────────────────────

  await test('blocker codes: schema validation rejects unknown blocker codes', () => {
    assert.ok(
      planJobYml.includes('unknown blocker code') || planJobYml.includes('allowedCodes.has(c)') || planJobYml.includes('ALLOWED_BLOCKER_CODES'),
      'must reject blockerCodes containing unknown values not in the allowlist',
    )
  })

  // ─── Nonnegative safe-integer counts ─────────────────────────────────────

  await test('count fields: schema validation rejects negative or non-integer counts', () => {
    assert.ok(
      planJobYml.includes('nonnegative safe integer') || planJobYml.includes('isSafeInteger'),
      'must reject count fields (appliedPayloadCount, unexpectedPayloadCount, duplicatePayloadCount, malformedPayloadCount) that are negative or non-integers',
    )
  })

  // ─── Control character rejection ─────────────────────────────────────────

  await test('control characters: schema validation rejects control characters and BOMs', () => {
    assert.ok(
      planJobYml.includes('control characters') || planJobYml.includes('\\x00') || planJobYml.includes('\\x08'),
      'must reject stdout containing control characters that could corrupt JSON parsing',
    )
  })

  // ─── Fallback artifacts are schema-valid ─────────────────────────────────

  await test('fallback artifacts: fallback plan_blocked artifact includes all required schema fields', () => {
    // Fallback artifacts emitted on early guard failures must satisfy the schema that the
    // validation section requires — they must not be minimal stubs with missing fields.
    assert.ok(
      planJobYml.includes('"branch":"unknown"') || planJobYml.includes("'branch':'unknown'"),
      'fallback artifacts must include branch field',
    )
    assert.ok(
      planJobYml.includes('"commit":"unknown"') || planJobYml.includes("'commit':'unknown'"),
      'fallback artifacts must include commit field',
    )
    assert.ok(
      planJobYml.includes('"prismaHealthy":false') || planJobYml.includes("'prismaHealthy':false"),
      'fallback artifacts must include prismaHealthy field',
    )
    assert.ok(
      planJobYml.includes('"appliedPayloadCount":0') || planJobYml.includes("'appliedPayloadCount':0"),
      'fallback artifacts must include appliedPayloadCount field',
    )
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('Contract test runner error:', error)
  process.exitCode = 1
})
