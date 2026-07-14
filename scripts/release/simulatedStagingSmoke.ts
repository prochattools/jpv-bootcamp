import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TSX_BIN = './node_modules/.bin/tsx'
const LOCAL_SMOKE_URL = 'http://127.0.0.1:3107'
const FORBIDDEN_COMMAND_PATTERNS = [
  /\bprisma migrate\b/i,
  /\bpayload:staging:migrate\b/i,
  /\bdeploy\b/i,
  /\bpayload:email:send\b/i,
  /\bstripe:check-products\b/i,
  /\bwebhook_live_test\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
]

export type SimulatedSmokeStep = {
  id: string
  label: string
  executable: string
  args: string[]
}

export type SimulatedSmokeOptions = {
  executor?: (
    executable: string,
    args: string[],
    env: NodeJS.ProcessEnv,
  ) => { status: number | null; stdout?: string; stderr?: string }
  log?: (message: string) => void
  environment?: NodeJS.ProcessEnv
}

export const SIMULATED_STAGING_SMOKE_STEPS: ReadonlyArray<SimulatedSmokeStep> = [
  {
    id: 'migration-rehearsal-static',
    label: 'Static migration rehearsal contract',
    executable: TSX_BIN,
    args: ['scripts/release/migrationRehearsal.ts'],
  },
  {
    id: 'provider-simulation',
    label: 'Mocked provider and admin verification contracts',
    executable: TSX_BIN,
    args: ['scripts/release/providerSimulation.ts'],
  },
  {
    id: 'smoke-manifest-integrity',
    label: 'Staging smoke manifest integrity',
    executable: TSX_BIN,
    args: ['scripts/staging_smoke_manifest.test.ts'],
  },
  {
    id: 'no-legacy-member-namespace',
    label: 'Removed legacy member namespace invariant',
    executable: TSX_BIN,
    args: ['scripts/no_legacy_learn_namespace.test.ts'],
  },
  {
    id: 'browser-e2e',
    label: 'Local browser smoke across public, portal, billing, support, course, and community routes',
    executable: TSX_BIN,
    args: ['scripts/e2e/runBrowserTests.ts'],
  },
] as const

function validateLocalBaseUrl(baseUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error('simulated_smoke_base_url_malformed')
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('simulated_smoke_requires_localhost_only')
  }
  if (parsed.protocol !== 'http:') {
    throw new Error('simulated_smoke_requires_http_local_url')
  }
}

function defaultExecutor(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): { status: number | null; stdout?: string; stderr?: string } {
  const result = spawnSync(executable, args, {
    env,
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

export function validateSimulatedSmokeSteps(
  steps: ReadonlyArray<SimulatedSmokeStep> = SIMULATED_STAGING_SMOKE_STEPS,
): void {
  const ids = new Set<string>()
  for (const step of steps) {
    if (ids.has(step.id)) throw new Error(`duplicate_simulated_smoke_step:${step.id}`)
    ids.add(step.id)
    const command = [step.executable, ...step.args].join(' ')
    for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
      if (pattern.test(command)) throw new Error(`forbidden_simulated_smoke_command:${step.id}`)
    }
  }
}

export function runSimulatedStagingSmoke(options: SimulatedSmokeOptions = {}): string {
  const executor = options.executor ?? defaultExecutor
  const log = options.log ?? console.log
  const env = {
    ...process.env,
    ...options.environment,
    SIMULATED_STAGING_SMOKE: '1',
    E2E_BASE_URL: options.environment?.E2E_BASE_URL ?? process.env.E2E_BASE_URL ?? LOCAL_SMOKE_URL,
  }

  validateLocalBaseUrl(env.E2E_BASE_URL)
  validateSimulatedSmokeSteps()

  log('LOCAL SIMULATED STAGING SMOKE')

  let completed = 0
  for (const step of SIMULATED_STAGING_SMOKE_STEPS) {
    const command = [step.executable, ...step.args].join(' ')
    log(`RUN ${step.id}: ${step.label}`)
    const result = executor(step.executable, step.args, env)
    if (result.status !== 0) {
      if (result.stdout?.trim()) log(`STDOUT ${step.id}:\n${result.stdout.trim()}`)
      if (result.stderr?.trim()) log(`STDERR ${step.id}:\n${result.stderr.trim()}`)
      throw new Error(`LOCAL SIMULATED STAGING SMOKE FAILED: ${step.id} (${command})`)
    }
    completed += 1
    log(`PASS ${step.id}`)
  }

  const summary = `LOCAL SIMULATED STAGING SMOKE PASSED: ${completed}/${SIMULATED_STAGING_SMOKE_STEPS.length}`
  log(summary)
  log('This result is repository-only simulated evidence. It is not external staging acceptance.')
  return summary
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    runSimulatedStagingSmoke()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
