/**
 * Local infrastructure preflight for the staging-migration-plan dispatch lane.
 *
 * Reads only: repository visibility, environment protection/branch policy,
 * network TCP reachability, and secret NAMES — never secret values.
 *
 * Invoked via: pnpm staging:payload-migration-infra-preflight
 *
 * Prerequisites: gh CLI authenticated; GITHUB_REPOSITORY set or auto-detected.
 *
 * Exit 0 = all required infrastructure is in place (push and dispatch are safe).
 * Exit 1 = one or more blocking items are missing (report printed; do not push).
 */

import { spawnSync } from 'node:child_process'

const ENV_NAME = 'staging-migration-plan'
const REQUIRED_SOURCE_REF_DESCRIPTION = 'feature/*, fix/*, or release/*'
const REQUIRED_BRANCH_POLICIES = ['feature/*', 'fix/*', 'release/*']
const REQUIRED_ENV_SECRETS = ['DATABASE_URL', 'TAILSCALE_OAUTH_CLIENT_ID', 'TAILSCALE_OAUTH_SECRET']
const STAGING_HOST = '10.0.2.4'
const STAGING_PORT = 5433
const GH_API_TIMEOUT_MS = 15_000
const TCP_TIMEOUT_SECS = 5

export type GhApiExecutor = (args: string[]) => unknown
export type TcpProbeExecutor = (host: string, port: number, timeoutSecs: number) => boolean
export type TailscaleStatusExecutor = () => boolean
export type RepoNameExecutor = () => string | null

type StagingEnvironmentData = {
  name?: string
  protection_rules?: Array<{ type: string; reviewers?: unknown[]; prevent_self_review?: boolean }>
  deployment_branch_policy?: { protected_branches: boolean; custom_branch_policies: boolean } | null
}

type StagingBranchPolicyData = {
  branch_policies?: Array<{ name?: string }>
}

function defaultGhApi(args: string[]): unknown {
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

function defaultRepoName(): string | null {
  const result = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], {
    shell: false,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: GH_API_TIMEOUT_MS,
  })
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim() || null
}

function ghApi(path: string, executor: GhApiExecutor = defaultGhApi): unknown {
  return executor(['api', '--', path])
}

function defaultTcpReachable(host: string, port: number, timeoutSecs: number): boolean {
  const result = spawnSync('nc', ['-z', '-w', String(timeoutSecs), host, String(port)], {
    shell: false,
    stdio: 'pipe',
    timeout: (timeoutSecs + 2) * 1000,
  })
  return result.status === 0 && !result.error
}

function tcpReachable(
  host: string,
  port: number,
  timeoutSecs = TCP_TIMEOUT_SECS,
  executor: TcpProbeExecutor = defaultTcpReachable,
): boolean {
  return executor(host, port, timeoutSecs)
}

interface PreflightResult {
  ok: boolean
  blockers: string[]
  warnings: string[]
  info: string[]
}

export interface PreflightDependencies {
  ghApi?: GhApiExecutor
  repoName?: RepoNameExecutor
  tcpReachable?: TcpProbeExecutor
  tailscaleStatus?: TailscaleStatusExecutor
}

export async function runPreflight(deps: PreflightDependencies = {}): Promise<PreflightResult> {
  const apiExec = deps.ghApi ?? defaultGhApi
  const repoNameExec = deps.repoName ?? defaultRepoName
  const tcpExec = deps.tcpReachable ?? defaultTcpReachable
  const tailscaleExec = deps.tailscaleStatus ?? defaultTailscaleStatus

  const result: PreflightResult = { ok: false, blockers: [], warnings: [], info: [] }

  // ── Detect repo ────────────────────────────────────────────────────────────
  let repo: string
  const detectedRepo = repoNameExec()
  if (typeof detectedRepo === 'string' && detectedRepo.trim()) {
    repo = detectedRepo.trim()
  } else {
    result.blockers.push('Cannot detect repository — is gh CLI authenticated? Run: gh auth status')
    result.ok = false
    return result
  }
  result.info.push(`Repository: ${repo}`)

  // ── Repository visibility ──────────────────────────────────────────────────
  const repoData = ghApi(`repos/${repo}`, apiExec) as { private?: boolean; visibility?: string } | null
  if (!repoData) {
    result.blockers.push('Cannot read repository metadata (gh API auth failure)')
  } else {
    result.info.push(`Visibility: ${repoData.visibility ?? (repoData.private ? 'private' : 'public')}`)
    if (!repoData.private && repoData.visibility !== 'private') {
      result.warnings.push('Repository is not private — confirm this is the correct repo before pushing')
    }
  }

  // ── Environment existence ──────────────────────────────────────────────────
  const envData = ghApi(`repos/${repo}/environments/${ENV_NAME}`, apiExec) as StagingEnvironmentData | null

  if (!envData || !envData.name) {
    result.blockers.push(
      `GitHub environment '${ENV_NAME}' does not exist — create it at: ` +
        `https://github.com/${repo}/settings/environments`,
    )
  } else {
    result.info.push(`Environment '${ENV_NAME}': exists`)

    // The live staging environment is protected. Keep at least one required
    // reviewer in the deployment gate; this is intentionally stronger
    // than the old solo-operator assumption.
    const reviewerRules = (envData.protection_rules ?? []).filter((r) => r.type === 'required_reviewers')
    const reviewerCount = reviewerRules.reduce((count, rule) => count + (rule.reviewers ?? []).length, 0)
    if (reviewerCount < 1) {
      result.blockers.push(
        `Environment '${ENV_NAME}' has no required reviewer — ` +
          `the protected staging path requires a configured reviewer approval before dispatch. ` +
          `Configure it at: https://github.com/${repo}/settings/environments`,
      )
    } else {
      result.info.push(`Required reviewers: ${reviewerCount} (protected staging path)`)
    }

    // Verify the protected deployment branch policy matches the live staging
    // model. The API exposes the policy names through a separate endpoint.
    const branchPolicy = envData.deployment_branch_policy
    if (!branchPolicy || branchPolicy.protected_branches || !branchPolicy.custom_branch_policies) {
      result.blockers.push(
        `Environment '${ENV_NAME}' does not have the protected custom branch policy required for ` +
          `${REQUIRED_SOURCE_REF_DESCRIPTION}. Configure it at: ` +
          `https://github.com/${repo}/settings/environments`,
      )
    } else {
      const policiesData = ghApi(
        `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`,
        apiExec,
      ) as StagingBranchPolicyData | null
      const policies = (policiesData?.branch_policies ?? [])
        .map((policy) => policy.name)
        .filter((name): name is string => typeof name === 'string')
        .sort()
      const expectedPolicies = [...REQUIRED_BRANCH_POLICIES].sort()
      if (
        !policiesData ||
        policies.length !== expectedPolicies.length ||
        policies.some((name, index) => name !== expectedPolicies[index])
      ) {
        result.blockers.push(
          `Environment '${ENV_NAME}' branch policies do not match the protected staging model — ` +
            `expected ${REQUIRED_SOURCE_REF_DESCRIPTION}. Review them at: ` +
            `https://github.com/${repo}/settings/environments`,
        )
      } else {
        result.info.push(`Branch policy: ${REQUIRED_SOURCE_REF_DESCRIPTION} (protected environment gate)`)
      }
    }
  }

  // ── Environment secret NAMES ───────────────────────────────────────────────
  const secretsData = ghApi(`repos/${repo}/environments/${ENV_NAME}/secrets`, apiExec) as {
    secrets?: Array<{ name: string }>
  } | null
  const envSecretNames = (secretsData?.secrets ?? []).map((s) => s.name)

  if (secretsData === null) {
    result.blockers.push(
      `Cannot read environment secret names for '${ENV_NAME}' — ` +
        'ensure the gh CLI has sufficient scope (admin:org or repo)',
    )
  } else {
    for (const name of REQUIRED_ENV_SECRETS) {
      if (!envSecretNames.includes(name)) {
        result.blockers.push(
          `Environment secret '${name}' is absent from '${ENV_NAME}' — add it at: ` +
            `https://github.com/${repo}/settings/environments`,
        )
      } else {
        result.info.push(`Secret '${name}': present in environment`)
      }
    }
  }

  // ── Readiness variable ─────────────────────────────────────────────────────
  const varsData = ghApi(`repos/${repo}/environments/${ENV_NAME}/variables`, apiExec) as {
    variables?: Array<{ name: string; value: string }>
  } | null
  const readyVar = (varsData?.variables ?? []).find((v) => v.name === 'PLAN_READY_FOR_DISPATCH')
  if (!readyVar) {
    result.blockers.push(
      `Environment variable 'PLAN_READY_FOR_DISPATCH' is absent from '${ENV_NAME}' — ` +
        "set it to 'true' via: Settings → Environments → staging-migration-plan → Variables",
    )
  } else if (readyVar.value !== 'true') {
    result.blockers.push(
      `Environment variable 'PLAN_READY_FOR_DISPATCH' is '${readyVar.value}' in '${ENV_NAME}' — ` +
        "must be 'true'",
    )
  } else {
    result.info.push(`PLAN_READY_FOR_DISPATCH: true`)
  }

  const soloVar = (varsData?.variables ?? []).find((v) => v.name === 'SOLO_OPERATOR_MODE')
  if (!soloVar) {
    result.blockers.push(
      `Environment variable 'SOLO_OPERATOR_MODE' is absent from '${ENV_NAME}' — ` +
        "set it to 'true' via: Settings → Environments → staging-migration-plan → Variables",
    )
  } else if (soloVar.value !== 'true') {
    result.blockers.push(
      `Environment variable 'SOLO_OPERATOR_MODE' is '${soloVar.value}' in '${ENV_NAME}' — ` +
        "must be 'true'",
    )
  } else {
    result.info.push(`SOLO_OPERATOR_MODE: true`)
  }

  // ── Network reachability (fail closed) ────────────────────────────────────
  // Absent Tailscale or unreachable host are blockers — not warnings.
  const tailscaleRunning = tailscaleExec()

  if (!tailscaleRunning) {
    result.blockers.push(
      `Tailscale is not running locally — connect to Tailscale and re-run. ` +
        `Network path to ${STAGING_HOST}:${STAGING_PORT} cannot be verified without Tailscale.`,
    )
  } else if (!tcpReachable(STAGING_HOST, STAGING_PORT, TCP_TIMEOUT_SECS, tcpExec)) {
    result.blockers.push(
      `${STAGING_HOST}:${STAGING_PORT} is not reachable via Tailscale — ` +
        'confirm subnet route 10.0.2.4/32 is exported and ACL allows tag:ci-reader -> 10.0.2.4:5433.',
    )
  } else {
    result.info.push(`Network: ${STAGING_HOST}:${STAGING_PORT} reachable (Tailscale active)`)
  }

  result.ok = result.blockers.length === 0
  return result
}

function defaultTailscaleStatus(): boolean {
  const result = spawnSync('tailscale', ['status'], {
    shell: false,
    stdio: 'pipe',
    timeout: 10_000,
  })
  return result.status === 0 && !result.error
}

const preflight = await runPreflight({})

console.log('\n=== Staging Migration Plan Infrastructure Preflight ===\n')

for (const line of preflight.info) {
  console.log(`  INFO  ${line}`)
}
if (preflight.warnings.length > 0) {
  console.log()
  for (const line of preflight.warnings) {
    console.log(`  WARN  ${line}`)
  }
}
if (preflight.blockers.length > 0) {
  console.log()
  for (const line of preflight.blockers) {
    console.log(`  BLOCK ${line}`)
  }
}

console.log()
if (preflight.ok) {
  console.log('RESULT: PREFLIGHT PASSED — infrastructure is ready for dispatch')
  process.exit(0)
} else {
  console.log(
    `RESULT: PREFLIGHT FAILED — ${preflight.blockers.length} blocker(s) must be resolved before push/dispatch`,
  )
  process.exit(1)
}
