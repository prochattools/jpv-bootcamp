/**
 * Dry-run-default GitHub environment configurator for staging-migration-plan.
 *
 * Configures (or verifies) the GitHub environment required by the read-only-plan
 * dispatch lane: reviewer guard, branch policy, PLAN_READY_FOR_DISPATCH variable,
 * and environment secrets (DATABASE_URL, TAILSCALE_OAUTH_CLIENT_ID, TAILSCALE_OAUTH_SECRET).
 *
 * DEFAULTS TO DRY-RUN. Apply only when called with:
 *   --confirm=configure_staging_migration_plan_environment
 *   --reviewer-id=<GitHub user ID — must not be the caller>
 *
 * Secret values are read from the process environment only, never from argv.
 * They are never printed to stdout or stderr.
 *
 * Exit 0 = dry-run complete (no mutations) OR apply verified.
 * Exit 1 = input error, self-reviewer, missing secret value, or verified state differs.
 *
 * Invoked via: pnpm staging:configure-environment
 */

import { spawnSync } from 'node:child_process'

const ENV_NAME = 'staging-migration-plan'
const REQUIRED_FEATURE_BRANCH = 'feature/course-branding-and-preview'
const REQUIRED_PLAN_READY_VALUE = 'true'
const REQUIRED_ENV_SECRETS = ['DATABASE_URL', 'TAILSCALE_OAUTH_CLIENT_ID', 'TAILSCALE_OAUTH_SECRET']
const APPLY_CONFIRMATION = 'configure_staging_migration_plan_environment'
const GH_API_TIMEOUT_MS = 20_000

// ─── Injectable executor types ────────────────────────────────────────────────

export type GhApiReadExecutor = (args: string[]) => unknown
export type GhApiMutateExecutor = (args: string[]) => { ok: boolean; status: number | null }
export type RepoNameExecutor = () => string | null
export type CallerLoginExecutor = () => string | null

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type ConfigureInput = {
  confirmation: string | undefined
  reviewerId: string | undefined
  dryRun: boolean
}

export type ConfigureEnvDependencies = {
  ghApiRead?: GhApiReadExecutor
  ghApiMutate?: GhApiMutateExecutor
  repoName?: RepoNameExecutor
  callerLogin?: CallerLoginExecutor
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultGhApiRead(args: string[]): unknown {
  const result = spawnSync('gh', args, {
    shell: false,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: GH_API_TIMEOUT_MS,
  })
  if (result.status !== 0 || result.error) return null
  try {
    return JSON.parse(result.stdout)
  } catch {
    return null
  }
}

function defaultGhApiMutate(args: string[]): { ok: boolean; status: number | null } {
  const result = spawnSync('gh', args, {
    shell: false,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: GH_API_TIMEOUT_MS,
  })
  return { ok: result.status === 0 && !result.error, status: result.status }
}

function defaultRepoName(): string | null {
  const result = spawnSync(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    { shell: false, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: GH_API_TIMEOUT_MS },
  )
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim() || null
}

function defaultCallerLogin(): string | null {
  const result = spawnSync(
    'gh',
    ['api', 'user', '--jq', '.login'],
    { shell: false, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: GH_API_TIMEOUT_MS },
  )
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim() || null
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type ConfigureResult = {
  ok: boolean
  dryRun: boolean
  actions: string[]
  blockers: string[]
  verifiedState: string[]
}

// ─── Main configurator ────────────────────────────────────────────────────────

export async function configureStagingMigrationPlanEnvironment(
  input: ConfigureInput,
  deps: ConfigureEnvDependencies = {},
): Promise<ConfigureResult> {
  const apiRead = deps.ghApiRead ?? defaultGhApiRead
  const apiMutate = deps.ghApiMutate ?? defaultGhApiMutate
  const repoNameExec = deps.repoName ?? defaultRepoName
  const callerLoginExec = deps.callerLogin ?? defaultCallerLogin

  const result: ConfigureResult = {
    ok: false,
    dryRun: input.dryRun,
    actions: [],
    blockers: [],
    verifiedState: [],
  }

  // ── Confirmation guard ────────────────────────────────────────────────────
  if (!input.dryRun && input.confirmation !== APPLY_CONFIRMATION) {
    result.blockers.push(
      `Apply requires --confirm=${APPLY_CONFIRMATION} (got '${input.confirmation ?? ''}')`,
    )
    return result
  }

  // ── Reviewer ID guard ─────────────────────────────────────────────────────
  if (!input.reviewerId?.trim()) {
    result.blockers.push('--reviewer-id is required and must be a GitHub user ID (not a username)')
    return result
  }
  const reviewerId = input.reviewerId.trim()

  // ── Detect repo ───────────────────────────────────────────────────────────
  const repo = repoNameExec()
  if (!repo) {
    result.blockers.push('Cannot detect repository — is gh CLI authenticated? Run: gh auth status')
    return result
  }

  // ── Self-review guard ─────────────────────────────────────────────────────
  const callerLogin = callerLoginExec()
  if (callerLogin) {
    const callerIdData = apiRead(['api', `users/${callerLogin}`, '--jq', '.id']) as string | null
    const callerId = callerIdData ? String(callerIdData).trim() : null
    if (callerId && callerId === reviewerId) {
      result.blockers.push(
        `Self-review rejected: reviewer ID ${reviewerId} matches the caller (${callerLogin}). ` +
          'A different operator must be the reviewer.',
      )
      return result
    }
  }

  // ── Secret value presence checks (values from env only, never logged) ─────
  const missingSecrets: string[] = []
  for (const name of REQUIRED_ENV_SECRETS) {
    const val = process.env[name]
    if (!val?.trim()) {
      missingSecrets.push(name)
    }
  }
  if (missingSecrets.length > 0) {
    result.blockers.push(
      `Operator-provided secret values are absent from process environment: ${missingSecrets.join(', ')}. ` +
        'Set them before running the configurator.',
    )
    return result
  }

  // ── Resolve reviewer node ID ───────────────────────────────────────────────
  const reviewerData = apiRead([
    'api',
    `users?since=${parseInt(reviewerId, 10) - 1}`,
  ]) as unknown
  // Direct node ID for reviewers endpoint requires node_id, not numeric ID.
  // Use graphql to resolve numeric → node_id.
  const reviewerNodeData = apiRead([
    'api', 'graphql',
    '-f', `query={ node(id: "${reviewerId}") { id } }`,
  ]) as { data?: { node?: { id?: string } } } | null
  const reviewerNodeId: string | null =
    reviewerNodeData?.data?.node?.id ?? null

  if (!reviewerNodeId && !input.dryRun) {
    result.blockers.push(
      `Cannot resolve reviewer node ID for reviewer-id=${reviewerId}. ` +
        'Verify the reviewer ID is a valid GitHub user/team numeric ID.',
    )
    return result
  }

  // ── Dry-run plan ──────────────────────────────────────────────────────────
  if (input.dryRun) {
    result.actions.push(`[DRY-RUN] Would create/update environment '${ENV_NAME}'`)
    result.actions.push(`[DRY-RUN] Would set required_reviewers: reviewer-id=${reviewerId}`)
    result.actions.push(`[DRY-RUN] Would enable prevent_self_review`)
    result.actions.push(`[DRY-RUN] Would set branch policy: custom, exactly '${REQUIRED_FEATURE_BRANCH}'`)
    result.actions.push(`[DRY-RUN] Would set variable PLAN_READY_FOR_DISPATCH=${REQUIRED_PLAN_READY_VALUE}`)
    for (const name of REQUIRED_ENV_SECRETS) {
      result.actions.push(`[DRY-RUN] Would set environment secret ${name} (value from process.env, never logged)`)
    }
    result.actions.push(
      `[DRY-RUN] To apply: re-run with --confirm=${APPLY_CONFIRMATION} and --reviewer-id=${reviewerId}`,
    )
    result.ok = true
    return result
  }

  // ── Apply: create/update environment with reviewer + branch policy ────────
  const createEnvResult = apiMutate([
    'api', '--method', 'PUT',
    `repos/${repo}/environments/${ENV_NAME}`,
    '--header', 'Accept: application/vnd.github+json',
    '--input', '-',
    '--raw-field', JSON.stringify({
      wait_timer: 0,
      prevent_self_review: true,
      reviewers: [
        { type: 'User', id: parseInt(reviewerId, 10) },
      ],
      deployment_branch_policy: {
        protected_branches: false,
        custom_branch_policies: true,
      },
    }),
  ])

  if (!createEnvResult.ok) {
    result.blockers.push(
      `Failed to create/update environment '${ENV_NAME}' (HTTP ${createEnvResult.status}). ` +
        'Check gh CLI scopes and repository permissions.',
    )
    return result
  }
  result.actions.push(`Created/updated environment '${ENV_NAME}' with reviewer and branch policy`)

  // ── Apply: set custom branch policy ───────────────────────────────────────
  // First clear any existing branch policies, then set exactly the feature branch.
  const existingPolicies = apiRead(
    ['api', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`],
  ) as { branch_policies?: Array<{ id: number; name: string }> } | null

  for (const policy of existingPolicies?.branch_policies ?? []) {
    if (policy.name !== REQUIRED_FEATURE_BRANCH) {
      apiMutate([
        'api', '--method', 'DELETE',
        `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies/${policy.id}`,
      ])
    }
  }

  const hasExact = (existingPolicies?.branch_policies ?? []).some((p) => p.name === REQUIRED_FEATURE_BRANCH)
  if (!hasExact) {
    const branchPolicyResult = apiMutate([
      'api', '--method', 'POST',
      `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`,
      '--field', `name=${REQUIRED_FEATURE_BRANCH}`,
    ])
    if (!branchPolicyResult.ok) {
      result.blockers.push(
        `Failed to set branch policy '${REQUIRED_FEATURE_BRANCH}' (HTTP ${branchPolicyResult.status})`,
      )
      return result
    }
  }
  result.actions.push(`Branch policy set: custom, exactly '${REQUIRED_FEATURE_BRANCH}'`)

  // ── Apply: set PLAN_READY_FOR_DISPATCH variable ───────────────────────────
  const varResult = apiMutate([
    'api', '--method', 'POST',
    `repos/${repo}/environments/${ENV_NAME}/variables`,
    '--field', `name=PLAN_READY_FOR_DISPATCH`,
    '--field', `value=${REQUIRED_PLAN_READY_VALUE}`,
  ])
  // POST creates; if it already exists, use PATCH
  if (!varResult.ok) {
    const patchVarResult = apiMutate([
      'api', '--method', 'PATCH',
      `repos/${repo}/environments/${ENV_NAME}/variables/PLAN_READY_FOR_DISPATCH`,
      '--field', `name=PLAN_READY_FOR_DISPATCH`,
      '--field', `value=${REQUIRED_PLAN_READY_VALUE}`,
    ])
    if (!patchVarResult.ok) {
      result.blockers.push(
        `Failed to set PLAN_READY_FOR_DISPATCH variable (HTTP ${patchVarResult.status})`,
      )
      return result
    }
  }
  result.actions.push(`Variable PLAN_READY_FOR_DISPATCH set to '${REQUIRED_PLAN_READY_VALUE}'`)

  // ── Apply: set environment secrets (values from process.env only) ─────────
  for (const name of REQUIRED_ENV_SECRETS) {
    const value = process.env[name]
    if (!value?.trim()) {
      result.blockers.push(`Secret ${name} unexpectedly absent at write time — aborting`)
      return result
    }
    // GitHub secrets API requires libsodium-encrypted values; use gh secret set instead.
    const secretResult = apiMutate([
      'secret', 'set', name,
      '--env', ENV_NAME,
      '--repo', repo,
      '--body', value,
    ])
    if (!secretResult.ok) {
      result.blockers.push(
        `Failed to set environment secret ${name} (status ${secretResult.status})`,
      )
      return result
    }
    result.actions.push(`Environment secret ${name} set (value not logged)`)
  }

  // ── Verify applied state ───────────────────────────────────────────────────
  const verifyEnv = apiRead([
    'api', `repos/${repo}/environments/${ENV_NAME}`,
  ]) as {
    name?: string
    protection_rules?: Array<{
      type: string
      reviewers?: unknown[]
      prevent_self_review?: boolean
    }>
    deployment_branch_policy?: { protected_branches: boolean; custom_branch_policies: boolean } | null
  } | null

  if (!verifyEnv?.name) {
    result.blockers.push(`Verification failed: environment '${ENV_NAME}' not found after apply`)
    return result
  }
  result.verifiedState.push(`Environment '${ENV_NAME}': exists`)

  const reviewerRules = (verifyEnv.protection_rules ?? []).filter((r) => r.type === 'required_reviewers')
  if (reviewerRules.length === 0 || (reviewerRules[0].reviewers ?? []).length === 0) {
    result.blockers.push(`Verification failed: no required reviewers on '${ENV_NAME}'`)
    return result
  }
  result.verifiedState.push(`Required reviewers: ${(reviewerRules[0].reviewers ?? []).length}`)

  if (reviewerRules[0].prevent_self_review !== true) {
    result.blockers.push(`Verification failed: prevent_self_review not enabled on '${ENV_NAME}'`)
    return result
  }
  result.verifiedState.push(`prevent_self_review: enabled`)

  if (!verifyEnv.deployment_branch_policy?.custom_branch_policies) {
    result.blockers.push(`Verification failed: branch policy is not custom on '${ENV_NAME}'`)
    return result
  }

  const verifyPolicies = apiRead([
    'api', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`,
  ]) as { branch_policies?: Array<{ name: string }> } | null
  const policyNames = (verifyPolicies?.branch_policies ?? []).map((p) => p.name)
  if (!policyNames.includes(REQUIRED_FEATURE_BRANCH) || policyNames.length !== 1) {
    result.blockers.push(
      `Verification failed: branch policy is not exactly ['${REQUIRED_FEATURE_BRANCH}'], got [${policyNames.join(', ')}]`,
    )
    return result
  }
  result.verifiedState.push(`Branch policy: ['${REQUIRED_FEATURE_BRANCH}']`)

  const verifyVars = apiRead([
    'api', `repos/${repo}/environments/${ENV_NAME}/variables`,
  ]) as { variables?: Array<{ name: string; value: string }> } | null
  const readyVar = (verifyVars?.variables ?? []).find((v) => v.name === 'PLAN_READY_FOR_DISPATCH')
  if (readyVar?.value !== REQUIRED_PLAN_READY_VALUE) {
    result.blockers.push(
      `Verification failed: PLAN_READY_FOR_DISPATCH is '${readyVar?.value ?? 'absent'}', expected '${REQUIRED_PLAN_READY_VALUE}'`,
    )
    return result
  }
  result.verifiedState.push(`PLAN_READY_FOR_DISPATCH: ${REQUIRED_PLAN_READY_VALUE}`)

  const verifySecrets = apiRead([
    'api', `repos/${repo}/environments/${ENV_NAME}/secrets`,
  ]) as { secrets?: Array<{ name: string }> } | null
  const secretNames = (verifySecrets?.secrets ?? []).map((s) => s.name)
  for (const name of REQUIRED_ENV_SECRETS) {
    if (!secretNames.includes(name)) {
      result.blockers.push(`Verification failed: environment secret '${name}' absent after apply`)
      return result
    }
    result.verifiedState.push(`Secret '${name}': present`)
  }

  result.ok = true
  return result
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): ConfigureInput {
  let confirmation: string | undefined
  let reviewerId: string | undefined
  let dryRun = true // default: dry-run

  for (const arg of argv) {
    if (arg.startsWith('--confirm=')) {
      confirmation = arg.slice('--confirm='.length)
      if (confirmation === APPLY_CONFIRMATION) dryRun = false
    } else if (arg.startsWith('--reviewer-id=')) {
      reviewerId = arg.slice('--reviewer-id='.length)
    }
  }
  return { confirmation, reviewerId, dryRun }
}

const input = parseArgs(process.argv.slice(2))
const result = await configureStagingMigrationPlanEnvironment(input)

console.log('\n=== Staging Migration Plan Environment Configurator ===\n')
console.log(`Mode: ${result.dryRun ? 'DRY-RUN (no mutations)' : 'APPLY'}`)
console.log()

for (const line of result.actions) {
  console.log(`  ACTION   ${line}`)
}
if (result.verifiedState.length > 0) {
  console.log()
  for (const line of result.verifiedState) {
    console.log(`  VERIFIED ${line}`)
  }
}
if (result.blockers.length > 0) {
  console.log()
  for (const line of result.blockers) {
    console.log(`  BLOCKED  ${line}`)
  }
}

console.log()
if (result.ok) {
  if (result.dryRun) {
    console.log(
      `RESULT: DRY-RUN COMPLETE — ${result.actions.length} planned action(s).\n` +
        `To apply, re-run with: --confirm=${APPLY_CONFIRMATION} --reviewer-id=<id>`,
    )
  } else {
    console.log('RESULT: ENVIRONMENT CONFIGURED AND VERIFIED')
  }
  process.exit(0)
} else {
  console.log(`RESULT: CONFIGURATION FAILED — ${result.blockers.length} blocker(s)`)
  process.exit(1)
}
