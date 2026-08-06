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
  'src/migrations',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironment.ts',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironmentCli.ts',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironment.test.ts',
  'scripts/staging-gates/stagingPayloadMigrationPlanWorkflowContract.test.ts',
  'scripts/release/runStagingPayloadMigration.ts',
  'scripts/release/runStagingPayloadMigration.test.ts',
  'scripts/release/releaseTestManifest.ts',
  'package.json',
  'pnpm-lock.yaml',
  'docs/PREVIEW_RELEASE_READINESS.md',
]

// ─── Injectable executor types ────────────────────────────────────────────────

export type GhApiCall = { args: string[]; stdin?: string }
export type GhApiReadExecutor = (call: GhApiCall) => unknown
export type GhApiMutateExecutor = (call: GhApiCall) => { ok: boolean; exitCode: number | null }
export type GitStatusExecutor = (paths: string[]) => Map<string, string> | null
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
  gitStatus?: GitStatusExecutor
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

function defaultGhApiMutate(call: GhApiCall): { ok: boolean; exitCode: number | null } {
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
  return { ok: result.status === 0 && !result.error, exitCode: result.status }
}

function defaultGitStatus(paths: string[]): Map<string, string> | null {
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', ...paths], {
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0 || result.error) return null

  const output = result.stdout
  if (!output) return new Map()

  const statusMap = new Map<string, string>()
  const records = output.split('\0').filter((r) => r.length > 0)

  for (const record of records) {
    if (record.length < 3) continue
    const status = record.slice(0, 2)
    const pathPart = record.slice(3)

    if (status.startsWith('R') || status.startsWith('C')) {
      const parts = pathPart.split('\0')
      if (parts.length >= 2) {
        statusMap.set(parts[0], `${status} -> ${parts[1]}`)
      }
    } else {
      statusMap.set(pathPart, status)
    }
  }

  return statusMap
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
  const result = spawnSync('gh', ['api', 'user'], {
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GH_API_TIMEOUT_MS,
  })
  if (result.status !== 0 || result.error) return null
  try {
    const data = JSON.parse(result.stdout)
    return data.login?.trim() || null
  } catch {
    return null
  }
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

async function checkCleanPaths(gitStatusExec: GitStatusExecutor): Promise<string | null> {
  const statusMap = gitStatusExec(GUARDED_PATHS)
  if (!statusMap) return 'git_status_failed'

  for (const [path, status] of statusMap) {
    return `Path has uncommitted changes (${status}): ${path}`
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
  const gitStatusExec = deps.gitStatus ?? defaultGitStatus
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

  // ── Reviewer login guard and validation ──────────────────────────────────
  if (!input.reviewerLogin?.trim()) {
    result.blockers.push('--reviewer-login is required (GitHub login, not numeric ID)')
    return result
  }
  const reviewerLoginInput = input.reviewerLogin.trim()
  if (!/^[a-zA-Z0-9\-_]+$/.test(reviewerLoginInput)) {
    result.blockers.push('--reviewer-login must contain only alphanumeric characters, hyphens, and underscores')
    return result
  }

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
    const cleanErr = await checkCleanPaths(gitStatusExec)
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
    args: ['api', `users/${reviewerLoginInput}`],
  }) as { id?: number; login?: string } | null
  if (!reviewerData) {
    result.blockers.push(`reviewer_lookup_failed`)
    return result
  }

  const reviewerId = reviewerData.id
  if (!Number.isSafeInteger(reviewerId) || typeof reviewerId !== 'number' || reviewerId <= 0) {
    result.blockers.push(`reviewer_lookup_failed`)
    return result
  }

  const reviewerCanonicalLogin = reviewerData.login?.trim()
  if (!reviewerCanonicalLogin || reviewerCanonicalLogin.toLowerCase() !== reviewerLoginInput.toLowerCase()) {
    result.blockers.push(`reviewer_lookup_failed`)
    return result
  }

  // ── Caller identity and self-review guard (numeric ID comparison) ──────────
  const callerLoginResult = callerLoginExec()
  if (!callerLoginResult) {
    result.blockers.push('caller_identity_failed')
    return result
  }

  const callerData = apiRead({
    args: ['api', 'user'],
  }) as { id?: number; login?: string } | null
  if (!callerData) {
    result.blockers.push('caller_identity_failed')
    return result
  }

  const callerId = callerData.id
  if (!Number.isSafeInteger(callerId) || typeof callerId !== 'number' || callerId <= 0) {
    result.blockers.push('caller_identity_failed')
    return result
  }

  if (callerId === reviewerId) {
    result.blockers.push(
      `Self-review rejected: caller ID ${callerId} cannot be the reviewer ID ${reviewerId}. ` +
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
    result.actions.push(`[DRY-RUN] Would set required_reviewers: ${reviewerCanonicalLogin} (ID: ${reviewerId})`)
    result.actions.push(`[DRY-RUN] Would enable prevent_self_review`)
    result.actions.push(`[DRY-RUN] Would set branch policy: custom, exactly '${REQUIRED_FEATURE_BRANCH}'`)
    result.actions.push(`[DRY-RUN] Would set variable PLAN_READY_FOR_DISPATCH=${REQUIRED_PLAN_READY_VALUE}`)
    for (const [name, present] of secretPresenceByName) {
      result.actions.push(
        `[DRY-RUN] Would set environment secret ${name} (${present ? 'present' : 'ABSENT'} in process.env)`,
      )
    }
    result.actions.push(
      `[DRY-RUN] To apply: re-run with --confirmation=${APPLY_CONFIRMATION} --reviewer-login=${reviewerCanonicalLogin} --expected-commit=<SHA>`,
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
    args: [
      'api',
      '--method',
      'PUT',
      `repos/${repo}/environments/${ENV_NAME}`,
      '--header',
      'Accept: application/vnd.github+json',
      '--input',
      '-',
    ],
    stdin: envBody,
  })

  if (!createEnvResult.ok) {
    result.blockers.push('github_api_call_failed')
    return result
  }
  result.actions.push(`Created/updated environment '${ENV_NAME}' with reviewer and branch policy`)

  // ── Apply: set custom branch policy ───────────────────────────────────────
  const existingPolicies = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`],
  }) as { branch_policies?: Array<{ id: number; name: string }> } | null

  if (!existingPolicies) {
    result.blockers.push('github_api_call_failed')
    return result
  }

  for (const policy of existingPolicies.branch_policies ?? []) {
    if (policy.name !== REQUIRED_FEATURE_BRANCH) {
      const deleteResult = apiMutate({
        args: ['api', '--method', 'DELETE', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies/${policy.id}`],
      })
      if (!deleteResult.ok) {
        result.blockers.push('branch_policy_delete_failed')
        return result
      }
    }
  }

  const hasExact = (existingPolicies?.branch_policies ?? []).some((p) => p.name === REQUIRED_FEATURE_BRANCH)
  if (!hasExact) {
    const branchPolicyBody = JSON.stringify({ name: REQUIRED_FEATURE_BRANCH })
    const branchPolicyResult = apiMutate({
      args: [
        'api',
        '--method',
        'POST',
        `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`,
        '--input',
        '-',
      ],
      stdin: branchPolicyBody,
    })
    if (!branchPolicyResult.ok) {
      result.blockers.push('github_api_call_failed')
      return result
    }
  }
  result.actions.push(`Branch policy set: custom, exactly '${REQUIRED_FEATURE_BRANCH}'`)

  // ── Apply: set PLAN_READY_FOR_DISPATCH variable ───────────────────────────
  const existingVars = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/variables`],
  }) as { variables?: Array<{ name: string; value: string }> } | null

  if (!existingVars) {
    result.blockers.push('github_api_call_failed')
    return result
  }

  const hasExistingVar = (existingVars.variables ?? []).some((v) => v.name === 'PLAN_READY_FOR_DISPATCH')
  const varBody = JSON.stringify({
    name: 'PLAN_READY_FOR_DISPATCH',
    value: REQUIRED_PLAN_READY_VALUE,
  })

  if (hasExistingVar) {
    const patchVarResult = apiMutate({
      args: [
        'api',
        '--method',
        'PATCH',
        `repos/${repo}/environments/${ENV_NAME}/variables/PLAN_READY_FOR_DISPATCH`,
        '--input',
        '-',
      ],
      stdin: varBody,
    })
    if (!patchVarResult.ok) {
      result.blockers.push('github_api_call_failed')
      return result
    }
  } else {
    const postVarResult = apiMutate({
      args: ['api', '--method', 'POST', `repos/${repo}/environments/${ENV_NAME}/variables`, '--input', '-'],
      stdin: varBody,
    })
    if (!postVarResult.ok) {
      result.blockers.push('github_api_call_failed')
      return result
    }
  }
  result.actions.push(`Variable PLAN_READY_FOR_DISPATCH set to '${REQUIRED_PLAN_READY_VALUE}'`)

  // ── Apply: set environment secrets (values from process.env only) ─────────
  for (const name of REQUIRED_ENV_SECRETS) {
    const value = process.env[name]
    if (!value?.trim()) {
      result.blockers.push('github_api_call_failed')
      return result
    }
    const secretResult = apiMutate({
      args: ['secret', 'set', name, '--env', ENV_NAME, '--repo', repo],
      stdin: value,
    })
    if (!secretResult.ok) {
      result.blockers.push('github_api_call_failed')
      return result
    }
    result.actions.push(`Environment secret ${name} set (value not logged)`)
  }

  // ── Verify applied state ───────────────────────────────────────────────────
  const verifyEnv = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}`],
  }) as {
    name?: string
    protection_rules?: Array<{ type: string; reviewers?: Array<{ type?: string; id?: number }>; prevent_self_review?: boolean }>
    deployment_branch_policy?: { protected_branches: boolean; custom_branch_policies: boolean } | null
  } | null

  if (!verifyEnv) {
    result.blockers.push('environment_verification_failed')
    return result
  }

  if (verifyEnv.name !== ENV_NAME) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`Environment: ${verifyEnv.name}`)

  const reviewerRules = (verifyEnv.protection_rules ?? []).filter((r) => r.type === 'required_reviewers')
  if (reviewerRules.length !== 1) {
    result.blockers.push('environment_verification_failed')
    return result
  }

  const reviewers = reviewerRules[0].reviewers ?? []
  if (reviewers.length !== 1) {
    result.blockers.push('environment_verification_failed')
    return result
  }

  const reviewerVerify = reviewers[0]
  if (reviewerVerify.type !== 'User' || reviewerVerify.id !== reviewerId) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`Required reviewer: ${reviewerCanonicalLogin} (ID: ${reviewerId})`)

  if (reviewerRules[0].prevent_self_review !== true) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`prevent_self_review: enabled`)

  if (verifyEnv.deployment_branch_policy?.protected_branches !== false) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  if (verifyEnv.deployment_branch_policy?.custom_branch_policies !== true) {
    result.blockers.push('environment_verification_failed')
    return result
  }

  const verifyPolicies = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`],
  }) as { branch_policies?: Array<{ name: string }> } | null
  if (!verifyPolicies) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  const policyNames = (verifyPolicies.branch_policies ?? []).map((p) => p.name)
  if (policyNames.length !== 1 || !policyNames.includes(REQUIRED_FEATURE_BRANCH)) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`Branch policy: ['${REQUIRED_FEATURE_BRANCH}']`)

  const verifyVars = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/variables`],
  }) as { variables?: Array<{ name: string; value: string }> } | null
  if (!verifyVars) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  const readyVar = (verifyVars.variables ?? []).find((v) => v.name === 'PLAN_READY_FOR_DISPATCH')
  if (readyVar?.value !== REQUIRED_PLAN_READY_VALUE) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`PLAN_READY_FOR_DISPATCH: ${REQUIRED_PLAN_READY_VALUE}`)

  const verifySecrets = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/secrets`],
  }) as { secrets?: Array<{ name: string }> } | null
  if (!verifySecrets) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  const secretNames = (verifySecrets.secrets ?? []).map((s) => s.name)
  for (const name of REQUIRED_ENV_SECRETS) {
    if (!secretNames.includes(name)) {
      result.blockers.push('environment_verification_failed')
      return result
    }
    result.verifiedState.push(`Secret '${name}': present`)
  }
  if (secretNames.length !== REQUIRED_ENV_SECRETS.length) {
    result.blockers.push('environment_verification_failed')
    return result
  }

  result.ok = true
  return result
}
