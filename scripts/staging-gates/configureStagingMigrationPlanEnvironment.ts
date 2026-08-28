/**
 * Dry-run-default GitHub environment configurator for staging-migration-plan.
 *
 * Configures (or verifies) the GitHub environment required by the read-only-plan
 * dispatch lane: branch policy, PLAN_READY_FOR_DISPATCH variable, SOLO_OPERATOR_MODE
 * variable, and environment secrets (DATABASE_URL, TAILSCALE_OAUTH_CLIENT_ID,
 * TAILSCALE_OAUTH_SECRET).
 *
 * Solo-operator mode: zero reviewers, no wait timer, no prevent_self_review.
 *
 * DEFAULTS TO DRY-RUN. Apply only when called with:
 *   --confirmation=configure_staging_migration_plan_environment
 *   --expected-commit=<40-char SHA>
 *
 * Required guards before apply:
 *   - Repository exactly: prochattools/jpv-bootcamp
 *   - Branch: an approved feature/*, fix/*, or release/* source ref
 *   - Current HEAD matches --expected-commit
 *   - Guarded paths (workflow, migration, configurator, package, runbook) clean
 *
 * Dry-run: reports secret names and presence, does not require values.
 * Apply: requires secret values from process.env; never prints them.
 *
 * Exit 0 = dry-run complete (no mutations) OR apply verified.
 * Exit 1 = input error, guard failure, or verified state differs.
 *
 * Invoked via: pnpm staging:configure-environment
 */

import { spawnSync } from 'node:child_process'

import { isAllowedStagingSourceRef } from '../../src/lib/environmentTopology'

const ENV_NAME = 'staging-migration-plan'
const REQUIRED_REPO = 'prochattools/jpv-bootcamp'
const ALLOWED_RELEASE_BRANCH_DESCRIPTION = 'feature/*, fix/*, or release/* (never main)'
const REQUIRED_PLAN_READY_VALUE = 'true'
const REQUIRED_SOLO_OPERATOR_VALUE = 'true'
const REQUIRED_ENV_SECRETS = ['DATABASE_URL', 'TAILSCALE_OAUTH_CLIENT_ID', 'TAILSCALE_OAUTH_SECRET']
const APPLY_CONFIRMATION = 'configure_staging_migration_plan_environment'
const GH_API_TIMEOUT_MS = 20_000

const GUARDED_PATHS = [
  '.github/workflows/deploy-preview.yml',
  'prisma/migrations',
  'src/migrations',
  'src/lib/auth/memberAccountActionReservationMigrationSql.ts',
  'src/lib/previewMigrationInventory.ts',
  'src/payload.config.ts',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironment.ts',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironmentCli.ts',
  'scripts/staging-gates/configureStagingMigrationPlanEnvironment.test.ts',
  'scripts/staging-gates/stagingPayloadMigrationPlanWorkflowContract.test.ts',
  'scripts/release/buildStagingMigrationStatus.ts',
  'scripts/release/buildStagingMigrationStatus.test.ts',
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
export type CurrentHeadExecutor = () => string | null
export type CurrentBranchExecutor = () => string | null

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type ConfigureInput = {
  confirmation: string | undefined
  expectedCommit: string | undefined
  dryRun: boolean
}

export type ConfigureEnvDependencies = {
  ghApiRead?: GhApiReadExecutor
  ghApiMutate?: GhApiMutateExecutor
  gitStatus?: GitStatusExecutor
  repoName?: RepoNameExecutor
  currentHead?: CurrentHeadExecutor
  currentBranch?: CurrentBranchExecutor
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
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...paths], {
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0 || result.error) return null

  try {
    return parseGitStatusNul(result.stdout)
  } catch {
    return null
  }
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

function defaultCurrentBranch(): string | null {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
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

export class GitStatusParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitStatusParseError'
  }
}

export function parseGitStatusNul(output: string): Map<string, string> {
  const statusMap = new Map<string, string>()

  // Empty output is valid (no changes)
  if (!output) return statusMap

  // Nonempty output must end with NUL
  if (!output.endsWith('\0')) {
    throw new GitStatusParseError('missing_terminal_nul')
  }

  // Split on NUL; last element is always empty after the terminal NUL
  const parts = output.split('\0')

  let i = 0
  while (i < parts.length - 1) {
    const record = parts[i]

    // Reject interior empty records (consecutive NULs)
    if (!record) {
      throw new GitStatusParseError('interior_empty_record')
    }

    // Minimum: "XY P" where P is at least 1 char = 4 chars
    if (record.length < 4) {
      throw new GitStatusParseError('malformed_record')
    }

    const X = record[0]
    const Y = record[1]
    const space = record[2]
    if (space !== ' ') {
      throw new GitStatusParseError('malformed_separator')
    }

    const pathPart = record.slice(3)
    if (pathPart.length === 0) {
      throw new GitStatusParseError('empty_path')
    }

    // Validate status codes: must be valid porcelain state
    // Valid codes: ' ' (unmodified), 'M' (modified), 'A' (added),
    // 'D' (deleted), 'R' (renamed), 'C' (copied), 'T' (type change), 'U' (unmerged)
    // '??' for untracked, '!!' for ignored
    const isValidStatus = (x: string, y: string): boolean => {
      const validCodes = new Set([' ', 'M', 'A', 'D', 'R', 'C', 'T', 'U', '?', '!'])
      if (!validCodes.has(x) || !validCodes.has(y)) return false
      // Reject blank/unknown states: both spaces
      if (x === ' ' && y === ' ') return false
      // ??, !! are only valid as pairs
      if (x === '?' || x === '!') return y === x
      if (y === '?' || y === '!') return x === y
      return true
    }

    if (!isValidStatus(X, Y)) {
      throw new GitStatusParseError('unsupported_status')
    }

    // Rename or Copy requires second path: X === 'R' or 'C' or Y === 'R' or 'C'
    const isRenameOrCopy = X === 'R' || X === 'C' || Y === 'R' || Y === 'C'

    if (isRenameOrCopy) {
      if (i + 1 >= parts.length - 1) {
        throw new GitStatusParseError('truncated_rename_record')
      }
      const nextPath = parts[i + 1]
      if (nextPath.length === 0) {
        throw new GitStatusParseError('missing_second_path')
      }
      statusMap.set(pathPart, `${X}${Y}`)
      statusMap.set(nextPath, `${X}${Y}`)
      i += 2
    } else {
      statusMap.set(pathPart, `${X}${Y}`)
      i++
    }
  }

  return statusMap
}

function isValidSha40(s: string | undefined): boolean {
  return /^[0-9a-f]{40}$/.test(s ?? '')
}

async function checkCleanPaths(gitStatusExec: GitStatusExecutor): Promise<string | null> {
  const statusMap = gitStatusExec(GUARDED_PATHS)
  if (!statusMap) return 'git_status_failed'

  for (const path of statusMap.keys()) {
    return 'guarded_path_dirty'
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
  const currentHeadExec = deps.currentHead ?? defaultCurrentHead
  const currentBranchExec = deps.currentBranch ?? defaultCurrentBranch

  const result: ConfigureResult = {
    ok: false,
    dryRun: input.dryRun,
    actions: [],
    blockers: [],
    verifiedState: [],
  }

  // ── Expected commit (both dry-run and apply) ─────────────────────────────
  if (!isValidSha40(input.expectedCommit)) {
    result.blockers.push('missing_expected_commit')
    return result
  }

  // ── Current HEAD matches expected (both dry-run and apply) ────────────────
  const currentHead = currentHeadExec()
  if (currentHead !== input.expectedCommit) {
    result.blockers.push('head_mismatch')
    return result
  }

  // ── Clean guarded paths (both dry-run and apply) ──────────────────────────
  const cleanErr = await checkCleanPaths(gitStatusExec)
  if (cleanErr) {
    result.blockers.push(cleanErr)
    return result
  }

  // ── Apply-only guards ─────────────────────────────────────────────────────
  if (!input.dryRun) {
    // Confirmation
    if (input.confirmation !== APPLY_CONFIRMATION) {
      result.blockers.push('missing_apply_confirmation')
      return result
    }
  }

  // ── Detect repo and verify exact repo ─────────────────────────────────────
  const repo = repoNameExec()
  if (!repo) {
    result.blockers.push('repo_detection_failed')
    return result
  }
  if (repo !== REQUIRED_REPO) {
    result.blockers.push('repo_mismatch')
    return result
  }

  // ── Verify current branch ─────────────────────────────────────────────────
  const currentBranch = currentBranchExec()
  if (!currentBranch || !isAllowedStagingSourceRef(currentBranch)) {
    result.blockers.push('branch_mismatch')
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
      result.blockers.push('missing_env_secrets')
      return result
    }
  }

  // ── Dry-run plan ──────────────────────────────────────────────────────────
  if (input.dryRun) {
    result.actions.push(`[DRY-RUN] Would create/update environment '${ENV_NAME}'`)
    result.actions.push(`[DRY-RUN] Would set zero reviewers (solo-operator mode)`)
    result.actions.push(`[DRY-RUN] Would set zero wait timer`)
    result.actions.push(
      `[DRY-RUN] Would accept release source ref: ${ALLOWED_RELEASE_BRANCH_DESCRIPTION}`,
    )
    result.actions.push(`[DRY-RUN] Would set variable PLAN_READY_FOR_DISPATCH=${REQUIRED_PLAN_READY_VALUE}`)
    result.actions.push(`[DRY-RUN] Would set variable SOLO_OPERATOR_MODE=${REQUIRED_SOLO_OPERATOR_VALUE}`)
    for (const [name, present] of secretPresenceByName) {
      result.actions.push(
        `[DRY-RUN] Would set environment secret ${name} (${present ? 'present' : 'ABSENT'} in process.env)`,
      )
    }
    result.actions.push(
      `[DRY-RUN] To apply: re-run with --confirmation=${APPLY_CONFIRMATION} --expected-commit=<SHA>`,
    )
    result.ok = true
    return result
  }

  // ── Apply: create/update environment with zero reviewers, no branch policy ─
  // GitHub custom deployment branch policies are not supported on public repositories
  // with a free org plan — they block deployment rather than enforcing the policy.
  // Branch enforcement is handled in-workflow via explicit guards.
  const envBody = JSON.stringify({
    wait_timer: 0,
    prevent_self_review: false,
    reviewers: [],
    deployment_branch_policy: null,
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
  result.actions.push(`Created/updated environment '${ENV_NAME}' with zero reviewers (branch guards in-workflow)`)

  // ── Apply: set PLAN_READY_FOR_DISPATCH and SOLO_OPERATOR_MODE variables ───
  const existingVars = apiRead({
    args: ['api', `repos/${repo}/environments/${ENV_NAME}/variables`],
  }) as { variables?: Array<{ name: string; value: string }> } | null

  if (!existingVars) {
    result.blockers.push('github_api_call_failed')
    return result
  }

  for (const [varName, varValue] of [
    ['PLAN_READY_FOR_DISPATCH', REQUIRED_PLAN_READY_VALUE],
    ['SOLO_OPERATOR_MODE', REQUIRED_SOLO_OPERATOR_VALUE],
  ] as const) {
    const hasExistingVar = (existingVars.variables ?? []).some((v) => v.name === varName)
    const varBody = JSON.stringify({ name: varName, value: varValue })

    if (hasExistingVar) {
      const patchResult = apiMutate({
        args: [
          'api',
          '--method',
          'PATCH',
          `repos/${repo}/environments/${ENV_NAME}/variables/${varName}`,
          '--input',
          '-',
        ],
        stdin: varBody,
      })
      if (!patchResult.ok) {
        result.blockers.push('github_api_call_failed')
        return result
      }
    } else {
      const postResult = apiMutate({
        args: ['api', '--method', 'POST', `repos/${repo}/environments/${ENV_NAME}/variables`, '--input', '-'],
        stdin: varBody,
      })
      if (!postResult.ok) {
        result.blockers.push('github_api_call_failed')
        return result
      }
    }
    result.actions.push(`Variable ${varName} set to '${varValue}'`)
  }

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

  // Solo-operator mode: verify zero reviewers
  const reviewerRules = (verifyEnv.protection_rules ?? []).filter((r) => r.type === 'required_reviewers')
  const reviewerCount = reviewerRules.length > 0 ? (reviewerRules[0].reviewers ?? []).length : 0
  if (reviewerCount !== 0) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`Required reviewers: 0 (solo-operator mode)`)

  // Verify no deployment branch policy is set — it blocks deployments on public repos with free org plan.
  // Branch enforcement is in-workflow only.
  if (
    verifyEnv.deployment_branch_policy !== null &&
    verifyEnv.deployment_branch_policy !== undefined
  ) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(
    `Branch policy: none (in-workflow guards enforce ${ALLOWED_RELEASE_BRANCH_DESCRIPTION})`,
  )

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

  const soloVar = (verifyVars.variables ?? []).find((v) => v.name === 'SOLO_OPERATOR_MODE')
  if (soloVar?.value !== REQUIRED_SOLO_OPERATOR_VALUE) {
    result.blockers.push('environment_verification_failed')
    return result
  }
  result.verifiedState.push(`SOLO_OPERATOR_MODE: ${REQUIRED_SOLO_OPERATOR_VALUE}`)

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
