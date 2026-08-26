import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TSX_BIN = './node_modules/.bin/tsx'
const FORBIDDEN_COMMAND_PATTERNS = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bhttps?:\/\//i,
  /\bpayload:email:send\b/i,
  /\bstripe:check-products\b/i,
  /\bwebhook_live_test\b/i,
  /\bdeploy\b/i,
]

export type ProviderSimulationCategory = 'EMAIL' | 'STRIPE' | 'PAYLOAD'

export type ProviderSimulationStep = {
  id: string
  category: ProviderSimulationCategory
  label: string
  executable: string
  args: string[]
}

export type ProviderSimulationRunOptions = {
  executor?: (
    executable: string,
    args: string[],
    env: NodeJS.ProcessEnv,
  ) => { status: number | null; stdout?: string; stderr?: string }
  log?: (message: string) => void
  environment?: NodeJS.ProcessEnv
}

export const PROVIDER_SIMULATION_STEPS: ReadonlyArray<ProviderSimulationStep> = [
  {
    id: 'email.support-intake',
    category: 'EMAIL',
    label: 'Support intake persistence, queue, and retry behavior',
    executable: TSX_BIN,
    args: ['scripts/support_intake_runtime.test.ts'],
  },
  {
    id: 'email.queue-redaction',
    category: 'EMAIL',
    label: 'Queued email retry and redaction behavior',
    executable: TSX_BIN,
    args: ['scripts/payload_course_email_sender.test.ts'],
  },
  {
    id: 'stripe.checkout-contract',
    category: 'STRIPE',
    label: 'Checkout plan, cadence, and return-url policy',
    executable: TSX_BIN,
    args: ['scripts/stripe_checkout_validation.test.ts'],
  },
  {
    id: 'stripe.member-checkout',
    category: 'STRIPE',
    label: 'Server-derived member checkout identity',
    executable: TSX_BIN,
    args: ['scripts/member_checkout.test.ts'],
  },
  {
    id: 'stripe.commitment-contract',
    category: 'STRIPE',
    label: 'Twelve-month commitment lifecycle contract',
    executable: TSX_BIN,
    args: ['scripts/stripe_commitment_contract.test.ts'],
  },
  {
    id: 'stripe.billing-portal',
    category: 'STRIPE',
    label: 'Billing portal member ownership',
    executable: TSX_BIN,
    args: ['scripts/payload_member_billing_portal.test.ts'],
  },
  {
    id: 'stripe.shadow-sync',
    category: 'STRIPE',
    label: 'Stripe shadow synchronization and projection safety',
    executable: TSX_BIN,
    args: ['scripts/payload_course_stripe_shadow_sync.test.ts'],
  },
  {
    id: 'stripe.readiness-report',
    category: 'STRIPE',
    label: 'Billing readiness blocker reporting',
    executable: TSX_BIN,
    args: ['scripts/billing_readiness_report.test.ts'],
  },
  {
    id: 'payload.admin-boundary',
    category: 'PAYLOAD',
    label: 'Admin-only review access boundary',
    executable: TSX_BIN,
    args: ['scripts/admin_review_access.test.ts'],
  },
  {
    id: 'payload.admin-dashboard',
    category: 'PAYLOAD',
    label: 'Payload administrator dashboard boundary',
    executable: TSX_BIN,
    args: ['scripts/payload_admin_dashboard.test.ts'],
  },
] as const

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

function buildEnvironment(overrides: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...overrides,
    NODE_ENV: 'test',
    PROVIDER_SIMULATION_MODE: '1',
    APP_PUBLIC_URL: 'http://127.0.0.1:3107',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3107',
    DATABASE_URL: 'postgresql://provider-sim:provider-sim@127.0.0.1:9/provider_sim?schema=public',
    STRIPE_ENV: 'test',
    STRIPE_SECRET_KEY: 'sk_test_provider_sim_disabled',
    STRIPE_SECRET_KEY_TEST: 'sk_test_provider_sim_disabled',
    STRIPE_WEBHOOK_SECRET: 'whsec_provider_sim_disabled',
    STRIPE_WEBHOOK_SECRET_TEST: 'whsec_provider_sim_disabled',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST: 'pk_test_provider_sim_disabled',
    RESEND_API_KEY: 're_provider_sim_disabled',
    EMAIL_FROM: 'provider-sim@example.invalid',
    EMAIL_REPLY_TO: 'provider-sim@example.invalid',
    SUPPORT_TO_EMAIL: 'provider-sim@example.invalid',
  }
}

export function validateProviderSimulationSteps(
  steps: ReadonlyArray<ProviderSimulationStep> = PROVIDER_SIMULATION_STEPS,
): void {
  const ids = new Set<string>()
  for (const step of steps) {
    if (ids.has(step.id)) throw new Error(`duplicate_provider_simulation_step:${step.id}`)
    ids.add(step.id)
    const command = [step.executable, ...step.args].join(' ')
    for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
      if (pattern.test(command)) throw new Error(`forbidden_provider_simulation_command:${step.id}`)
    }
  }
}

export function runProviderSimulation(options: ProviderSimulationRunOptions = {}): string {
  const executor = options.executor ?? defaultExecutor
  const log = options.log ?? console.log
  const env = buildEnvironment(options.environment)
  const categoryCounts = new Map<ProviderSimulationCategory, number>()

  validateProviderSimulationSteps()
  log('STAGING PROVIDER SIMULATION')

  let completed = 0
  let currentCategory: ProviderSimulationCategory | null = null
  for (const step of PROVIDER_SIMULATION_STEPS) {
    if (step.category !== currentCategory) {
      currentCategory = step.category
      log(`\n[${currentCategory}]`)
    }
    const command = [step.executable, ...step.args].join(' ')
    log(`RUN ${step.id}: ${step.label}`)
    const result = executor(step.executable, step.args, env)
    if (result.status !== 0) {
      if (result.stdout?.trim()) log(`STDOUT ${step.id}:\n${result.stdout.trim()}`)
      if (result.stderr?.trim()) log(`STDERR ${step.id}:\n${result.stderr.trim()}`)
      throw new Error(`STAGING PROVIDER SIMULATION FAILED: ${step.id} (${command})`)
    }
    completed += 1
    categoryCounts.set(step.category, (categoryCounts.get(step.category) ?? 0) + 1)
    log(`PASS ${step.id}`)
  }

  const summary = `STAGING PROVIDER SIMULATION PASSED: ${completed}/${PROVIDER_SIMULATION_STEPS.length}`
  const categorySummary = [...categoryCounts.entries()]
    .map(([category, count]) => `${category}=${count}`)
    .join(', ')
  log(summary)
  log(`Categories: ${categorySummary}`)
  return summary
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    runProviderSimulation()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
