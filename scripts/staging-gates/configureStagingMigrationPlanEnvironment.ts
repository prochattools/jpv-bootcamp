/**
 * Dry-run-default GitHub environment configurator for staging-migration-plan.
 *
 * Configures (or verifies) the GitHub environment required by the read-only-plan
 * dispatch lane: reviewer guard, branch policy, PLAN_READY_FOR_DISPATCH variable,
 * and environment secrets (DATABASE_URL, TAILSCALE_OAUTH_CLIENT_ID, TAILSCALE_OAUTH_SECRET).
 *
 * DEFAULTS TO DRY-RUN. Apply only when called with:
 *   --confirmation=configure_staging_migration_plan_environment
 *   --reviewer-login=<GitHub login> --expected-commit=<40-char SHA>
 *
 * Required guards before apply:
 *   - Repository exactly: prochattools/jpv-bootcamp
 *   - Branch exactly: feature/course-branding-and-preview
 *   - Current HEAD matches --expected-commit
 *   - Guarded paths (workflow, migration, configurator, package, runbook) clean
 *
 * Dry-run: reports secret names and presence, does not require values.
 * Apply: requires secret values from process.env; never prints them.
 *
 * Exit 0 = dry-run complete (no mutations) OR apply verified.
 * Exit 1 = input error, self-reviewer, guard failure, or verified state differs.
 *
 * Invoked via: pnpm staging:configure-environment
 */

import { spawnSync } from 'node:child_process'

const ENV_NAME = 'staging-migration-plan'
const REQUIRED_REPO = 'prochattools/jpv-bootcamp'
const REQUIRED_FEATURE_BRANCH = 'feature/course-branding-and-preview'
const REQUIRED_PLAN_READY_VALUE = 'true'
const REQUIRED_ENV_SECRETS = ['DATABASE_URL', 'TAILSCALE_OAUTH_CLIENT_ID', 'TAILSCALE_OAUTH_SECRET']
const APPLY_CONFIRMATION = 'configure_staging_migration_plan_environment'
const GH_API_TIMEOUT_MS = 20_000

const GUARDED_PATHS = [
  '.github/workflows/deploy-preview.yml',
  'prisma/migrations',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironment.mts',
  'scripts/staging-gates/stagingPayloadMigrationInfraPreflight.mts',
  'scripts/staging-gates/stagingPayloadMigrationPlanWorkflowContract.test.ts',
  'scripts/release/runStagingPayloadMigration.ts',
  'scripts/release/runStagingPayloadMigration.test.ts',
  'package.json',
]

// ─── Injectable executor types ────────────────────────────────────────────────

export type GhApiCall = { args: string[]; stdin?: string }
export type GhApiReadExecutor = (call: GhApiCall) => unknown
export type GhApiMutateExecutor = (call: GhApiCall) => { ok: boolean; status: number | null }
export type RepoNameExecutor = () => string | null
export type CallerLoginExecutor = () => string | null
export type CurrentHeadExecutor = () => string | null

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type ConfigureInput = {
  confirmation: string | undefined
  reviewerLogin: string | undefined
  expectedCommit: string | undefined
  dryRun: boolean
}

export type ConfigureEnvDependencies = {
  ghApiRead?: GhApiReadExecutor
  ghApiMutate?: GhApiMutateExecutor
  repoName?: RepoNameExecutor
  callerLogin?: CallerLoginExecutor
  currentHead?: CurrentHeadExecutor
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultGhApiRead(call: GhApiCall): unknown {
  const stdio: ['pipe' | 'ignore', 'pipe' | 'ignore', 'pipe' | 'ignore'] = [
    call.stdin ? 'pipe' : 'ignore',
    'pipe',
    'pipe',
  ]
  const result = spawnSync('gh', call.args, {
    shell: false,
    encoding: 'utf8',
    input: call.stdin,
    stdio,
    timeout: GH_API_TIMEOUT_MS,
  })
  if (result.status !== 0 || result.error) return null
  try {
    return JSON.parse(result.stdout)
  } catch {
    return null
  }
}

function defaultGhApiMutate(call: GhApiCall): { ok: boolean; status: number | null } {
  const stdio: ['pipe' | 'ignore', 'pipe' | 'ignore', 'pipe' | 'ignore'] = [
    call.stdin ? 'pipe' : 'ignore',
    'pipe',
    'pipe',
  ]
  const result = spawnSync('gh', call.args, {
    shell: false,
    encoding: 'utf8',
    input: call.stdin,
    stdio,
    timeout: GH_API_TIMEOUT_MS,
  })
  return { ok: result.status === 0 && !result.error, status: result.status }
}

function defaultRepoName(): string | null {
  const result = spawnSync(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    { shell: false, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: GH_API_TIMEOUT_MS },
  )
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim() || null
}

function defaultCallerLogin(): string | null {
  const result = spawnSync('gh', ['api', 'user', '--jq', '.login'], {
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GH_API_TIMEOUT_MS,
  })
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim() || null
}

function defaultCurrentHead(): string | null {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GH_API_TIMEOUT_MS,
  })
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

// ─── Utilities ────────────────────────────────────────────────────────────────

function isValidSha40(s: string | undefined): boolean {
  return /^[0-9a-f]{40}$/.test(s ?? '')
}

async function checkCleanPaths(): Promise<string | null> {
  for (const path of GUARDED_PATHS) {
    const result = spawnSync('git', ['status', '--porcelain', path], {
      shell: false,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (result.status === 0 && result.stdout.trim()) {
      return `Path has uncommitted changes: ${path}`
    }
  }
  return null
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
  const currentHeadExec = deps.currentHead ?? defaultCurrentHead

  const result: ConfigureResult = {
    ok: false,
    dryRun: input.dryRun,
    actions: [],
    blockers: [],
    verifiedState: [],
  }

  // ── Reviewer login guard ──────────────────────────────────────────────────
  if (!input.reviewerLogin?.trim()) {
    result.blockers.push('--reviewer-login is required (GitHub login, not numeric ID)')
    return result
  }
  const reviewerLogin = input.reviewerLogin.trim()

  // ── Apply-only guards ─────────────────────────────────────────────────────
  if (!input.dryRun) {
    // Confirmation
    if (input.confirmation !== APPLY_CONFIRMATION) {
      result.blockers.push(
        `Apply requires --confirmation=${APPLY_CONFIRMATION} (got '${input.confirmation ?? ''}')`,
      )
      return result
    }

    // Expected commit
    if (!isValidSha40(input.expectedCommit)) {
      result.blockers.push(
        `Apply requires --expected-commit=<40-char hex SHA> (got '${input.expectedCommit ?? ''}')`,
      )
      return result
    }

    // Current HEAD matches expected
    const currentHead = currentHeadExec()
    if (currentHead !== input.expectedCommit) {
      result.blockers.push(
        `HEAD mismatch: expected ${input.expectedCommit}, got ${currentHead ?? 'unknown'}`,
      )
      return result
    }

    // Clean guarded paths
    const cleanErr = await checkCleanPaths()
    if (cleanErr) {
      result.blockers.push(cleanErr)
      return result
    }
  }

  // ── Detect repo and verify exact repo ─────────────────────────────────────
  const repo = repoNameExec()
  if (!repo) {
    result.blockers.push('Cannot detect repository — is gh CLI authenticated? Run: gh auth status')
    return result
  }
  if (repo !== REQUIRED_REPO) {
    result.blockers.push(
      `Repository mismatch: expected ${REQUIRED_REPO}, got ${repo}. ` +
        'This configurator must run only in the exact required repository.',
    )
    return result
  }

  // ── Verify current branch ─────────────────────────────────────────────────
  const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const currentBranch = (branchResult.status === 0 && branchResult.stdout.trim()) || null
  if (currentBranch !== REQUIRED_FEATURE_BRANCH) {
    result.blockers.push(
      `Branch mismatch: expected ${REQUIRED_FEATURE_BRANCH}, got ${currentBranch || 'unknown'}`,
    )
    return result
  }

  // ── Resolve reviewer login → numeric ID (required for both dry-run and apply) ──
  const reviewerData = apiRead({
    args: ['api', `users/${reviewerLogin}`],
  }) as { id?: number; login?: string } | null
  const reviewerId = reviewerData?.id
  if (!reviewerId) {
    result.blockers.push(
      `Cannot resolve GitHub user '${reviewerLogin}'. Verify the login exists and gh CLI has sufficient scope.`,
    )
    return result
  }

  // ── Caller identity and self-review guard ─────────────────────────────────
  const callerLogin = callerLoginExec()
  if (!callerLogin) {
    result.blockers.push(
      'Cannot determine authenticated caller identity. Verify gh CLI authentication with: gh auth status',
    )
    return result
  }
  if (callerLogin === reviewerLogin) {
    result.blockers.push(
      `Self-review rejected: caller '${callerLogin}' cannot be the reviewer. ` +
        'A different operator must approve the configuration.',
    )
    return result
  }

  // ── Secret presence checks (dry-run reports names only; apply requires values) ──
  const secretPresenceByName = new Map<string, boolean>()
  for (const name of REQUIRED_ENV_SECRETS) {
    secretPresenceByName.set(name, !!process.env[name]?.trim())
  }

  if (!input.dryRun) {
    const missingSecrets = Array.from(secretPresenceByName.entries())
      .filter(([, present]) => !present)
      .map(([name]) => name)
    if (missingSecrets.length > 0) {
      result.blockers.push(
        `Apply requires environment variables: ${missingSecrets.join(', ')}. ` +
          'Set them in your process environment before retrying.',
      )
      return result
    }
  }

  // ── Dry-run plan ──────────────────────────────────────────────────────────
  if (input.dryRun) {
    result.actions.push(`[DRY-RUN] Would create/update environment '${ENV_NAME}'`)
    result.actions.push(`[DRY-RUN] Would set required_reviewers: ${reviewerLogin} (ID: ${reviewerId})`)
    result.actions.push(`[DRY-RUN] Would enable prevent_self_review`)
    result.actions.push(`[DRY-RUN] Would set branch policy: custom, exactly '${REQUIRED_FEATURE_BRANCH}'`)
    result.actions.push(`[DRY-RUN] Would set variable PLAN_READY_FOR_DISPATCH=${REQUIRED_PLAN_READY_VALUE}`)
    for (const [name, present] of secretPresenceByName) {
      result.actions.push(
        `[DRY-RUN] Would set environment secret ${name} (${present ? 'present' : 'ABSENT'} in process.env)`,
      )
    }
    result.actions.push(
      `[DRY-RUN] To apply: re-run with --confirmation=${APPLY_CONFIRMATION} --reviewer-login=${reviewerLogin} --expected-commit=<SHA>`,
    )
    result.ok = true
    return result
  }

  // ── Apply: create/update environment with reviewer + branch policy ────────
  const envBody = JSON.stringify({
    wait_timer: 0,
    prevent_self_review: true,
    reviewers: [{ type: 'User', id: reviewerId }],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  })

  const createEnvResult = apiMutate({
    args: ['api', '--method', 'PUT', `repos/${repo}/environments/${ENV_NAME}`, '--header', 'Accept: application/vnd.github+json'],
    stdin: envBody,
  })

  if (!createEnvResult.ok) {
    result.blockers.push(
      `Failed to create/update environment '${ENV_NAME}' (HTTP ${createEnvResult.status}). ` +
        'Check gh CLI scopes and repository permissions.',
    )
    return result
  }
  result.actions.push(`Created/updated environment '${ENV_NAME}' with reviewer and branch policy`)

  // ── Apply: set custom branch policy ───────────────────────────────────────
  const existingPolicies = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`],
  }) as { branch_policies?: Array<{ id: number; name: string }> } | null

  for (const policy of existingPolicies?.branch_policies ?? []) {
    if (policy.name !== REQUIRED_FEATURE_BRANCH) {
      apiMutate({
        args: ['api', '--method', 'DELETE', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies/${policy.id}`],
      })
    }
  }

  const hasExact = (existingPolicies?.branch_policies ?? []).some((p) => p.name === REQUIRED_FEATURE_BRANCH)
  if (!hasExact) {
    const branchPolicyBody = JSON.stringify({ name: REQUIRED_FEATURE_BRANCH })
    const branchPolicyResult = apiMutate({
      args: ['api', '--method', 'POST', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`],
      stdin: branchPolicyBody,
    })
    if (!branchPolicyResult.ok) {
      result.blockers.push(
        `Failed to set branch policy '${REQUIRED_FEATURE_BRANCH}' (HTTP ${branchPolicyResult.status})`,
      )
      return result
    }
  }
  result.actions.push(`Branch policy set: custom, exactly '${REQUIRED_FEATURE_BRANCH}'`)

  // ── Apply: set PLAN_READY_FOR_DISPATCH variable ───────────────────────────
  const varBody = JSON.stringify({
    name: 'PLAN_READY_FOR_DISPATCH',
    value: REQUIRED_PLAN_READY_VALUE,
  })
  const varResult = apiMutate({
    args: ['api', '--method', 'POST', `repos/${repo}/environments/${ENV_NAME}/variables`],
    stdin: varBody,
  })
  if (!varResult.ok) {
    const patchVarBody = JSON.stringify({
      name: 'PLAN_READY_FOR_DISPATCH',
      value: REQUIRED_PLAN_READY_VALUE,
    })
    const patchVarResult = apiMutate({
      args: ['api', '--method', 'PATCH', `repos/${repo}/environments/${ENV_NAME}/variables/PLAN_READY_FOR_DISPATCH`],
      stdin: patchVarBody,
    })
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
    const secretResult = apiMutate({
      args: ['secret', 'set', name, '--env', ENV_NAME, '--repo', repo],
      stdin: value,
    })
    if (!secretResult.ok) {
      result.blockers.push(`Failed to set environment secret ${name} (status ${secretResult.status})`)
      return result
    }
    result.actions.push(`Environment secret ${name} set (value not logged)`)
  }

  // ── Verify applied state ───────────────────────────────────────────────────
  const verifyEnv = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}`],
  }) as {
    name?: string
    protection_rules?: Array<{ type: string; reviewers?: unknown[]; prevent_self_review?: boolean }>
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

  if (verifyEnv.deployment_branch_policy?.protected_branches !== false) {
    result.blockers.push(`Verification failed: protected_branches should be false on '${ENV_NAME}'`)
    return result
  }
  if (verifyEnv.deployment_branch_policy?.custom_branch_policies !== true) {
    result.blockers.push(`Verification failed: branch policy is not custom on '${ENV_NAME}'`)
    return result
  }

  const verifyPolicies = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`],
  }) as { branch_policies?: Array<{ name: string }> } | null
  const policyNames = (verifyPolicies?.branch_policies ?? []).map((p) => p.name)
  if (policyNames.length !== 1 || !policyNames.includes(REQUIRED_FEATURE_BRANCH)) {
    result.blockers.push(
      `Verification failed: branch policy is not exactly ['${REQUIRED_FEATURE_BRANCH}'], got [${policyNames.join(', ')}]`,
    )
    return result
  }
  result.verifiedState.push(`Branch policy: ['${REQUIRED_FEATURE_BRANCH}']`)

  const verifyVars = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/variables`],
  }) as { variables?: Array<{ name: string; value: string }> } | null
  const readyVar = (verifyVars?.variables ?? []).find((v) => v.name === 'PLAN_READY_FOR_DISPATCH')
  if (readyVar?.value !== REQUIRED_PLAN_READY_VALUE) {
    result.blockers.push(
      `Verification failed: PLAN_READY_FOR_DISPATCH is '${readyVar?.value ?? 'absent'}', expected '${REQUIRED_PLAN_READY_VALUE}'`,
    )
    return result
  }
  result.verifiedState.push(`PLAN_READY_FOR_DISPATCH: ${REQUIRED_PLAN_READY_VALUE}`)

  const verifySecrets = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/secrets`],
  }) as { secrets?: Array<{ name: string }> } | null
  const secretNames = (verifySecrets?.secrets ?? []).map((s) => s.name)
  for (const name of REQUIRED_ENV_SECRETS) {
    if (!secretNames.includes(name)) {
      result.blockers.push(`Verification failed: environment secret '${name}' absent after apply`)
      return result
    }
    result.verifiedState.push(`Secret '${name}': present`)
  }
  if (secretNames.length !== REQUIRED_ENV_SECRETS.length) {
    const extra = secretNames.filter((n) => !REQUIRED_ENV_SECRETS.includes(n))
    result.blockers.push(`Verification failed: unexpected extra secrets: ${extra.join(', ')}`)
    return result
  }

  result.ok = true
  return result
}
