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

import { execSync } from 'node:child_process'

const ENV_NAME = 'staging-migration-plan'
const REQUIRED_FEATURE_BRANCH = 'feature/course-branding-and-preview'
const REQUIRED_ENV_SECRETS = ['DATABASE_URL', 'TAILSCALE_OAUTH_CLIENT_ID', 'TAILSCALE_OAUTH_SECRET']
const STAGING_HOST = '10.0.2.4'
const STAGING_PORT = 5433

function ghApi(path: string): unknown {
  try {
    const out = execSync(`gh api "${path}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    return JSON.parse(out)
  } catch {
    return null
  }
}

function tcpReachable(host: string, port: number, timeoutSecs = 5): boolean {
  try {
    execSync(`nc -z -w ${timeoutSecs} "${host}" ${port}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

interface PreflightResult {
  ok: boolean
  blockers: string[]
  warnings: string[]
  info: string[]
}

async function runPreflight(): Promise<PreflightResult> {
  const result: PreflightResult = { ok: false, blockers: [], warnings: [], info: [] }

  // ── Detect repo ────────────────────────────────────────────────────────────
  let repo: string
  try {
    repo = execSync('gh repo view --json nameWithOwner --jq .nameWithOwner', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    result.blockers.push('Cannot detect repository — is gh CLI authenticated? Run: gh auth status')
    result.ok = false
    return result
  }
  result.info.push(`Repository: ${repo}`)

  // ── Repository visibility ──────────────────────────────────────────────────
  const repoData = ghApi(`repos/${repo}`) as { private?: boolean; visibility?: string } | null
  if (!repoData) {
    result.blockers.push('Cannot read repository metadata (gh API auth failure)')
  } else {
    result.info.push(`Visibility: ${repoData.visibility ?? (repoData.private ? 'private' : 'public')}`)
    if (!repoData.private && repoData.visibility !== 'private') {
      result.warnings.push('Repository is not private — confirm this is the correct repo before pushing')
    }
  }

  // ── Environment existence ──────────────────────────────────────────────────
  const envData = ghApi(`repos/${repo}/environments/${ENV_NAME}`) as {
    name?: string
    protection_rules?: Array<{ type: string; reviewers?: unknown[] }>
    deployment_branch_policy?: { protected_branches: boolean; custom_branch_policies: boolean } | null
  } | null

  if (!envData || !envData.name) {
    result.blockers.push(
      `GitHub environment '${ENV_NAME}' does not exist — create it at: ` +
        `https://github.com/${repo}/settings/environments`,
    )
  } else {
    result.info.push(`Environment '${ENV_NAME}': exists`)

    // Required reviewers
    const reviewerRules = (envData.protection_rules ?? []).filter((r) => r.type === 'required_reviewers')
    const reviewerCount = reviewerRules.length > 0 ? (reviewerRules[0].reviewers ?? []).length : 0
    if (reviewerCount < 1) {
      result.blockers.push(
        `Environment '${ENV_NAME}' has no required reviewers — add at least one to prevent self-approval: ` +
          `https://github.com/${repo}/settings/environments`,
      )
    } else {
      result.info.push(`Required reviewers: ${reviewerCount}`)
    }

    // Branch policy: must be limited to the reviewed feature branch
    const branchPolicy = envData.deployment_branch_policy
    if (!branchPolicy) {
      result.blockers.push(
        `Environment '${ENV_NAME}' has no deployment branch policy — restrict deployments to ` +
          `'${REQUIRED_FEATURE_BRANCH}' only via custom branch policies`,
      )
    } else if (branchPolicy.protected_branches && !branchPolicy.custom_branch_policies) {
      // protected_branches = all protected branches; that may include main — not safe enough
      result.warnings.push(
        `Environment '${ENV_NAME}' branch policy is set to 'protected branches' which may include main — ` +
          `prefer a custom policy limited to '${REQUIRED_FEATURE_BRANCH}'`,
      )
    } else if (branchPolicy.custom_branch_policies) {
      // Verify custom policy actually names the feature branch
      const policies = ghApi(
        `repos/${repo}/environments/${ENV_NAME}/deployment-branch-policies`,
      ) as { branch_policies?: Array<{ name: string }> } | null
      const names = (policies?.branch_policies ?? []).map((p) => p.name)
      if (!names.includes(REQUIRED_FEATURE_BRANCH)) {
        result.blockers.push(
          `Environment '${ENV_NAME}' custom branch policy does not include '${REQUIRED_FEATURE_BRANCH}' — ` +
            `got: [${names.join(', ')}]`,
        )
      } else {
        result.info.push(`Branch policy: custom, includes '${REQUIRED_FEATURE_BRANCH}'`)
      }
    } else {
      result.info.push(`Branch policy: ${JSON.stringify(branchPolicy)}`)
    }
  }

  // ── Environment secret NAMES ───────────────────────────────────────────────
  const secretsData = ghApi(`repos/${repo}/environments/${ENV_NAME}/secrets`) as {
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
  const varsData = ghApi(`repos/${repo}/environments/${ENV_NAME}/variables`) as {
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

  // ── Network reachability ───────────────────────────────────────────────────
  // Only probe if Tailscale appears to be running locally
  const tailscaleRunning = (() => {
    try {
      execSync('tailscale status', { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  })()

  if (tailscaleRunning) {
    if (tcpReachable(STAGING_HOST, STAGING_PORT)) {
      result.info.push(`Network: ${STAGING_HOST}:${STAGING_PORT} reachable (Tailscale active)`)
    } else {
      result.warnings.push(
        `${STAGING_HOST}:${STAGING_PORT} not reachable locally — confirm subnet route and ACL tag:ci-reader -> ${STAGING_HOST}:${STAGING_PORT}. ` +
          'The CI runner will attempt its own Tailscale connection.',
      )
    }
  } else {
    result.info.push(
      `Network: Tailscale not running locally — skipping TCP probe ${STAGING_HOST}:${STAGING_PORT}. ` +
        'Connect to Tailscale and re-run to verify network path.',
    )
  }

  result.ok = result.blockers.length === 0
  return result
}

const preflight = await runPreflight()

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
