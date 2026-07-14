import { STAGING_SMOKE_MANIFEST, type StagingSmokeCategory, validateStagingSmokeManifest } from './stagingSmokeManifest'

export type StagingSmokePlanOptions = {
  environment?: string
  execute?: boolean
}

const CATEGORY_ORDER: ReadonlyArray<StagingSmokeCategory> = [
  'PUBLIC',
  'MEMBER',
  'ADMIN',
  'SUPPORT',
  'BILLING',
  'EMAIL',
  'MIGRATION',
  'SECURITY',
  'CONTENT',
]

export function buildStagingSmokePlan(options: StagingSmokePlanOptions = {}): {
  ok: boolean
  errors: string[]
  output: string
} {
  const environment = options.environment ?? 'repository-plan'
  const manifest = validateStagingSmokeManifest()
  const errors = [...manifest.errors]
  if (options.execute) errors.push('live_execution_not_supported')
  if (environment !== 'repository-plan') errors.push('repository_plan_environment_required')

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    entries: STAGING_SMOKE_MANIFEST.filter((entry) => entry.category === category),
  }))

  const lines: string[] = [
    'STAGING SMOKE PLAN',
    `Environment: ${environment}`,
    'Mode: plan-only',
    'Go/No-Go: pending external operator execution and approval',
    'Provider-backed checks: documented, unexecuted',
    'Programme preview blocker: explicit and still blocked by content approval',
    '',
  ]

  for (const group of grouped) {
    lines.push(`## ${group.category}`)
    for (const entry of group.entries) {
      lines.push(`- ${entry.id}`)
      lines.push(`  operation: ${entry.routeOrOperation}`)
      lines.push(`  auth: ${entry.authRole}`)
      lines.push(`  status: ${entry.currentStatus}`)
      lines.push(`  automated: ${entry.automated ? 'yes' : 'no'}`)
      lines.push(`  providerBacked: ${entry.providerBacked ? 'yes' : 'no'}`)
      lines.push(`  action: ${entry.smokeAction}`)
      lines.push(`  expected: ${entry.expectedResult}`)
      lines.push(`  evidence: ${entry.evidenceToCapture}`)
    }
    lines.push('')
  }

  return {
    ok: errors.length === 0,
    errors,
    output: `${lines.join('\n').trim()}\n`,
  }
}
