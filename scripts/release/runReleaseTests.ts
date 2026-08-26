import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import {
  DEFERRED_RELEASE_VALIDATIONS,
  RELEASE_TEST_CATEGORIES,
  RELEASE_TEST_MANIFEST,
  type ReleaseTestEntry,
} from './releaseTestManifest'

export type ReleaseCommandResult = {
  status: number | null
  signal?: NodeJS.Signals | null
  stdout?: string
  stderr?: string
}

export type ReleaseCommandExecutor = (
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => ReleaseCommandResult

export type ReleaseRunOptions = {
  entries?: ReleaseTestEntry[]
  executor?: ReleaseCommandExecutor
  log?: (message: string) => void
  enabledConditions?: Set<string>
  environment?: NodeJS.ProcessEnv
}

const FORBIDDEN_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bprisma\s+migrate\b/i, reason: 'Prisma migration execution is forbidden' },
  { pattern: /\bpayload(?::|\s+)staging(?::|\s+)migrate\b/i, reason: 'Payload migration execution is forbidden' },
  { pattern: /\bdb(?::|\s+)(?:migrate|reset|seed|init|cleanup)\b/i, reason: 'Database mutation is forbidden' },
  { pattern: /\bmigrate-db\b/i, reason: 'Database migration aliases are forbidden' },
  { pattern: /\b(?:deploy|deployment)\b/i, reason: 'Deployment commands are forbidden' },
  { pattern: /\bstripe:check-products\b/i, reason: 'Live Stripe product checks are forbidden' },
  { pattern: /\bpayload:email:send\b/i, reason: 'Live queued-email dispatch is forbidden' },
  { pattern: /\bmcp:provision\b/i, reason: 'Provider provisioning is forbidden' },
  { pattern: /\b(?:curl|wget)\b/i, reason: 'Arbitrary network commands are forbidden' },
  { pattern: /\b(?:bash|sh)\s+-c\b/i, reason: 'Shell evaluation is forbidden' },
  { pattern: /\beval\b/i, reason: 'Runtime evaluation is forbidden' },
  { pattern: /\bsource\s+/i, reason: 'Environment sourcing is forbidden' },
  { pattern: /--no-frozen-lockfile/i, reason: 'Lockfile regeneration is forbidden' },
  { pattern: /--lockfile-only/i, reason: 'Lockfile regeneration is forbidden' },
  { pattern: /\bevidence:create\b/i, reason: 'Release validation must not generate evidence' },
  { pattern: /\b(?:playwright|cypress)\b/i, reason: 'Browser E2E is deferred to M1-03' },
]

const SENSITIVE_ENVIRONMENT_SENTINELS: Record<string, string> = {
  RELEASE_TEST_MODE: '1',
  APP_PUBLIC_URL: 'https://release-validation.invalid',
  NEXT_PUBLIC_APP_URL: 'https://release-validation.invalid',
  DATABASE_URL: 'postgresql://release-test:release-test@127.0.0.1:9/release_test?schema=public',
  PAYLOAD_SECRET: 'release-test-payload-secret-not-for-production',
  STRIPE_SECRET_KEY: 'sk_test_release_validation_disabled',
  STRIPE_WEBHOOK_SECRET: 'whsec_release_validation_disabled',
  RESEND_API_KEY: 're_release_validation_disabled',
  EMAIL_FROM: 'release-validation@example.invalid',
  SUPPORT_EMAIL_TO: 'release-validation@example.invalid',
  DOKPLOY_API_KEY: 'release-validation-disabled',
  DOKPLOY_APP_ID: 'release-validation-disabled',
}

function canonicalCommand(entry: ReleaseTestEntry): string {
  return [entry.command.executable, ...entry.command.args].join(' ')
}

export function validateReleaseManifest(entries: ReleaseTestEntry[] = RELEASE_TEST_MANIFEST): void {
  const ids = new Set<string>()
  const commands = new Set<string>()

  for (const entry of entries) {
    if (!entry.id.trim()) throw new Error('Release manifest entry is missing a stable identifier')
    if (ids.has(entry.id)) throw new Error(`Duplicate release manifest identifier: ${entry.id}`)
    ids.add(entry.id)

    if (!RELEASE_TEST_CATEGORIES.includes(entry.category)) {
      throw new Error(`Unknown release category for ${entry.id}: ${entry.category}`)
    }
    if (!entry.launchCriticalReason.trim()) throw new Error(`${entry.id} is missing a launch-critical reason`)
    if (!entry.failureMeaning.trim()) throw new Error(`${entry.id} is missing a failure meaning`)
    if (!entry.owner.trim()) throw new Error(`${entry.id} is missing an owner`)
    if (entry.requirement === 'conditional' && !entry.condition?.trim()) {
      throw new Error(`${entry.id} is conditional but has no explicit condition`)
    }

    const command = canonicalCommand(entry)
    if (commands.has(command)) throw new Error(`Duplicate release command: ${command}`)
    commands.add(command)

    if (!['pnpm', 'git'].includes(entry.command.executable)) {
      throw new Error(`${entry.id} uses a non-allowlisted executable`)
    }
    for (const { pattern, reason } of FORBIDDEN_COMMAND_PATTERNS) {
      if (pattern.test(command)) throw new Error(`${entry.id}: ${reason}`)
    }
  }
}

export function buildReleaseEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    ...SENSITIVE_ENVIRONMENT_SENTINELS,
    CI: '1',
    FORCE_COLOR: '0',
  }
}

function defaultExecutor(executable: string, args: string[], env: NodeJS.ProcessEnv): ReleaseCommandResult {
  const result = spawnSync(executable, args, {
    env,
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

export function runReleaseManifest(options: ReleaseRunOptions = {}): string {
  const entries = options.entries ?? RELEASE_TEST_MANIFEST
  const executor = options.executor ?? defaultExecutor
  const log = options.log ?? console.log
  const enabledConditions = options.enabledConditions ?? new Set<string>()
  const environment = buildReleaseEnvironment(options.environment)

  validateReleaseManifest(entries)

  const runnable = entries.filter((entry) => {
    if (entry.requirement === 'required') return true
    return Boolean(entry.condition && enabledConditions.has(entry.condition))
  })

  let completed = 0
  let currentCategory: string | undefined
  for (const entry of runnable) {
    if (entry.category !== currentCategory) {
      currentCategory = entry.category
      log(`\n=== ${currentCategory} ===`)
    }

    const display = canonicalCommand(entry)
    log(`RUN ${entry.id}: ${display}`)
    const result = executor(entry.command.executable, entry.command.args, environment)
    if (result.status !== 0) {
      if (result.stdout?.trim()) log(`STDOUT ${entry.id}:\n${result.stdout.trim()}`)
      if (result.stderr?.trim()) log(`STDERR ${entry.id}:\n${result.stderr.trim()}`)
      throw new Error(`RELEASE TEST FAILED: ${entry.id} (${display}) exited ${String(result.status)}`)
    }
    completed += 1
    log(`PASS ${entry.id}`)
  }

  const summary = `RELEASE TESTS PASSED: ${completed}/${runnable.length}`
  log(`\n${summary}`)
  if (DEFERRED_RELEASE_VALIDATIONS.length > 0) {
    log(`DEFERRED VALIDATIONS: ${DEFERRED_RELEASE_VALIDATIONS.map((item) => `${item.id} (${item.owner})`).join(', ')}`)
  }
  return summary
}

function captureGitStatus(): string {
  const result = spawnSync('git', ['status', '--short'], {
    encoding: 'utf8',
    shell: false,
  })
  if (result.status !== 0) throw new Error('Unable to capture repository status before release tests')
  return result.stdout
}

export function main(): void {
  const args = process.argv.slice(2)
  const enabledConditions = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--enable-condition' && args[i + 1]) {
      enabledConditions.add(args[i + 1] as string)
      i++
    }
  }
  const before = captureGitStatus()
  runReleaseManifest({ enabledConditions })
  const after = captureGitStatus()
  if (after !== before) {
    throw new Error('Release tests changed tracked or untracked repository paths')
  }
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
