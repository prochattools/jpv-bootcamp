import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export type LaunchCriticalCommandKind = 'script' | 'tsx'

export type LaunchCriticalCommand = Readonly<{
  kind: LaunchCriticalCommandKind
  command: string
  scriptName?: string
  filePath?: string
  liveProvider: boolean
  purpose: string
}>

export type LaunchCriticalSuite = Readonly<{
  id: 'billing' | 'membership-support' | 'migration' | 'course' | 'frontend' | 'release'
  title: string
  lane: 'BILLING' | 'MEMBERSHIP SUPPORT' | 'MIGRATION' | 'COURSE' | 'FRONTEND' | 'RELEASE'
  parallelSafe: boolean
  status: 'ready'
  commands: LaunchCriticalCommand[]
}>

export const LAUNCH_CRITICAL_TEST_MANIFEST: LaunchCriticalSuite[] = [
  {
    id: 'billing',
    title: 'Billing suite',
    lane: 'BILLING',
    parallelSafe: true,
    status: 'ready',
    commands: [
      {
        kind: 'script',
        command: 'pnpm test:payload-member-billing',
        scriptName: 'test:payload-member-billing',
        liveProvider: false,
        purpose: 'Validate portal billing overview behavior without provider calls.',
      },
      {
        kind: 'script',
        command: 'pnpm test:payload-member-billing-portal',
        scriptName: 'test:payload-member-billing-portal',
        liveProvider: false,
        purpose: 'Validate billing portal behavior without provider calls.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/billing_readiness_report.test.ts',
        filePath: 'scripts/billing_readiness_report.test.ts',
        liveProvider: false,
        purpose: 'Validate the billing readiness report contract.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/stripe_commitment_contract.test.ts',
        filePath: 'scripts/stripe_commitment_contract.test.ts',
        liveProvider: false,
        purpose: 'Keep the approved billing contract aligned to the local test surface.',
      },
    ],
  },
  {
    id: 'membership-support',
    title: 'Membership support suite',
    lane: 'MEMBERSHIP SUPPORT',
    parallelSafe: true,
    status: 'ready',
    commands: [
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/membership_support_collections.test.ts',
        filePath: 'scripts/membership_support_collections.test.ts',
        liveProvider: false,
        purpose: 'Validate collection registration and admin grouping.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/membership_support_cockpit.test.ts',
        filePath: 'scripts/membership_support_cockpit.test.ts',
        liveProvider: false,
        purpose: 'Validate operator cockpit links and safe summaries.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/membership_support_workflows.test.ts',
        filePath: 'scripts/membership_support_workflows.test.ts',
        liveProvider: false,
        purpose: 'Validate voucher and pay-it-forward workflow projections.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/membership_support_review_queue_projection.test.ts',
        filePath: 'scripts/membership_support_review_queue_projection.test.ts',
        liveProvider: false,
        purpose: 'Validate review queue dedupe and ordering projections.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/payload_course_stripe_shadow_sync.test.ts',
        filePath: 'scripts/payload_course_stripe_shadow_sync.test.ts',
        liveProvider: false,
        purpose: 'Validate shadow sync and reconciliation behavior.',
      },
    ],
  },
  {
    id: 'migration',
    title: 'Migration suite',
    lane: 'MIGRATION',
    parallelSafe: false,
    status: 'ready',
    commands: [
      {
        kind: 'script',
        command: 'pnpm staging:migration-preflight',
        scriptName: 'staging:migration-preflight',
        liveProvider: false,
        purpose: 'Validate the repository-only migration preflight boundary.',
      },
      {
        kind: 'script',
        command: 'pnpm staging:migration-rehearsal',
        scriptName: 'staging:migration-rehearsal',
        liveProvider: false,
        purpose: 'Validate the static rehearsal path without any apply step.',
      },
      {
        kind: 'script',
        command: 'pnpm staging:migration-rehearsal:evidence',
        scriptName: 'staging:migration-rehearsal:evidence',
        liveProvider: false,
        purpose: 'Validate migration rehearsal evidence generation.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/migration_readiness_static.test.ts',
        filePath: 'scripts/migration_readiness_static.test.ts',
        liveProvider: false,
        purpose: 'Validate migration readiness classification.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/migration_rehearsal_safety.test.ts',
        filePath: 'scripts/migration_rehearsal_safety.test.ts',
        liveProvider: false,
        purpose: 'Validate rehearsal and rollback safety rules.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/payload_staging_migration_boundary.test.ts',
        filePath: 'scripts/payload_staging_migration_boundary.test.ts',
        liveProvider: false,
        purpose: 'Validate the no-implicit-migration boundary.',
      },
    ],
  },
  {
    id: 'course',
    title: 'Course suite',
    lane: 'COURSE',
    parallelSafe: true,
    status: 'ready',
    commands: [
      {
        kind: 'script',
        command: 'pnpm test:payload-course',
        scriptName: 'test:payload-course',
        liveProvider: false,
        purpose: 'Validate the launch-critical course and entitlement surface.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/course_programme_mvp.test.ts',
        filePath: 'scripts/course_programme_mvp.test.ts',
        liveProvider: false,
        purpose: 'Validate programme preview boundaries and claims.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/payload_course_access_service.test.ts',
        filePath: 'scripts/payload_course_access_service.test.ts',
        liveProvider: false,
        purpose: 'Validate course access service behavior.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/payload_course_reconciliation.test.ts',
        filePath: 'scripts/payload_course_reconciliation.test.ts',
        liveProvider: false,
        purpose: 'Validate course reconciliation behavior.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/payload_lesson_resource_delivery.test.ts',
        filePath: 'scripts/payload_lesson_resource_delivery.test.ts',
        liveProvider: false,
        purpose: 'Validate protected lesson resource delivery.',
      },
    ],
  },
  {
    id: 'frontend',
    title: 'Frontend suite',
    lane: 'FRONTEND',
    parallelSafe: true,
    status: 'ready',
    commands: [
      {
        kind: 'script',
        command: 'pnpm test:e2e',
        scriptName: 'test:e2e',
        liveProvider: false,
        purpose: 'Validate browser journeys without live provider calls.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/frontend_milestone_static.test.ts',
        filePath: 'scripts/frontend_milestone_static.test.ts',
        liveProvider: false,
        purpose: 'Validate milestone and pricing copy claims.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/frontend_acceptance_evidence_static.test.ts',
        filePath: 'scripts/frontend_acceptance_evidence_static.test.ts',
        liveProvider: false,
        purpose: 'Validate the acceptance evidence template.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/public_copy_claims_cleanup.test.ts',
        filePath: 'scripts/public_copy_claims_cleanup.test.ts',
        liveProvider: false,
        purpose: 'Validate public copy against unsupported claims.',
      },
      {
        kind: 'tsx',
        command: 'pnpm exec tsx scripts/portal_account_billing_parity.test.ts',
        filePath: 'scripts/portal_account_billing_parity.test.ts',
        liveProvider: false,
        purpose: 'Validate portal account and billing parity.',
      },
    ],
  },
  {
    id: 'release',
    title: 'Release suite',
    lane: 'RELEASE',
    parallelSafe: false,
    status: 'ready',
    commands: [
      {
        kind: 'script',
        command: 'pnpm staging:static-preflight',
        scriptName: 'staging:static-preflight',
        liveProvider: false,
        purpose: 'Validate the local release gate without deployment or provider calls.',
      },
      {
        kind: 'script',
        command: 'pnpm test:release',
        scriptName: 'test:release',
        liveProvider: false,
        purpose: 'Run the deterministic non-browser release gate.',
      },
      {
        kind: 'script',
        command: 'pnpm test:release:full',
        scriptName: 'test:release:full',
        liveProvider: false,
        purpose: 'Validate the composed release and browser gate.',
      },
      {
        kind: 'script',
        command: 'pnpm staging:decision-readiness',
        scriptName: 'staging:decision-readiness',
        liveProvider: false,
        purpose: 'Validate decision-readiness state without implying approval.',
      },
      {
        kind: 'script',
        command: 'pnpm staging:provider-simulation',
        scriptName: 'staging:provider-simulation',
        liveProvider: false,
        purpose: 'Validate mocked provider simulation only.',
      },
      {
        kind: 'script',
        command: 'pnpm staging:smoke-plan',
        scriptName: 'staging:smoke-plan',
        liveProvider: false,
        purpose: 'Validate the staging smoke plan without execution.',
      },
      {
        kind: 'script',
        command: 'pnpm staging:smoke-simulated',
        scriptName: 'staging:smoke-simulated',
        liveProvider: false,
        purpose: 'Validate localhost-only simulated staging smoke.',
      },
      {
        kind: 'script',
        command: 'pnpm release:evidence:dry-run',
        scriptName: 'release:evidence:dry-run',
        liveProvider: false,
        purpose: 'Validate the repository-owned release evidence dry run.',
      },
    ],
  },
]

const FORBIDDEN_COMMAND_PATTERNS = [
  /\bpayload:email:send\b/i,
  /\bstripe:check-products\b/i,
  /\bprisma\s+migrate\b/i,
  /\b(?:deploy|deployment)\b/i,
  /\b(?:curl|wget)\b/i,
  /\bmcp:provision\b/i,
]

function loadPackageScripts(): Record<string, string> {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  return packageJson.scripts ?? {}
}

export function validateLaunchCriticalTestManifest(
  suites: LaunchCriticalSuite[] = LAUNCH_CRITICAL_TEST_MANIFEST,
  packageScripts: Record<string, string> = loadPackageScripts(),
): string[] {
  const errors: string[] = []
  const suiteIds = new Set<string>()

  for (const suite of suites) {
    if (!suite.id.trim()) errors.push('missing_suite_id')
    if (suiteIds.has(suite.id)) errors.push(`duplicate_suite_id:${suite.id}`)
    suiteIds.add(suite.id)
    if (!suite.title.trim()) errors.push(`missing_title:${suite.id}`)
    if (!suite.lane.trim()) errors.push(`missing_lane:${suite.id}`)
    if (suite.commands.length === 0) errors.push(`missing_commands:${suite.id}`)

    for (const command of suite.commands) {
      if (!command.command.trim()) errors.push(`missing_command:${suite.id}`)
      if (!command.purpose.trim()) errors.push(`missing_purpose:${suite.id}:${command.command}`)
      if (command.liveProvider) errors.push(`live_provider_not_allowed:${suite.id}:${command.command}`)
      for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
        if (pattern.test(command.command)) errors.push(`forbidden_command:${suite.id}:${command.command}`)
      }

      if (command.kind === 'script') {
        if (!command.scriptName?.trim()) errors.push(`missing_script_name:${suite.id}:${command.command}`)
        else if (typeof packageScripts[command.scriptName] !== 'string' || !packageScripts[command.scriptName]?.trim()) {
          errors.push(`missing_package_script:${command.scriptName}`)
        }
      } else if (command.kind === 'tsx') {
        if (!command.filePath?.trim()) errors.push(`missing_file_path:${suite.id}:${command.command}`)
        else if (!existsSync(command.filePath)) errors.push(`missing_test_file:${command.filePath}`)
      } else {
        errors.push(`unknown_command_kind:${suite.id}:${command.command}`)
      }
    }
  }

  return errors
}

export function buildLaunchCriticalTestManifestReport(
  suites: LaunchCriticalSuite[] = LAUNCH_CRITICAL_TEST_MANIFEST,
  packageScripts: Record<string, string> = loadPackageScripts(),
): { ok: boolean; errors: string[]; output: string } {
  const errors = validateLaunchCriticalTestManifest(suites, packageScripts)
  const lines: string[] = ['LAUNCH CRITICAL TEST MANIFEST', '']

  for (const suite of suites) {
    lines.push(`## ${suite.lane} - ${suite.title}`)
    lines.push(`- id: ${suite.id}`)
    lines.push(`- parallelSafe: ${suite.parallelSafe ? 'yes' : 'no'}`)
    lines.push(`- status: ${suite.status}`)
    for (const command of suite.commands) {
      lines.push(`  - ${command.command}`)
      lines.push(`    liveProvider: ${command.liveProvider ? 'yes' : 'no'}`)
      lines.push(`    purpose: ${command.purpose}`)
    }
    lines.push('')
  }

  if (errors.length > 0) {
    lines.push('VALIDATION ERRORS')
    for (const error of errors) lines.push(`- ${error}`)
    lines.push('')
  }

  return { ok: errors.length === 0, errors, output: `${lines.join('\n').trim()}\n` }
}

export function main(): void {
  process.stdout.write(buildLaunchCriticalTestManifestReport().output)
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main()
}
