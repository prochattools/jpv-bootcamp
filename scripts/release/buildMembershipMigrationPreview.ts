import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  classifyMigrationCandidate,
  summarizeMigrationCandidates,
  type MigrationCandidateInput,
} from '../../src/lib/billing/membershipMigrationPreview'

type SerializedCandidate = Omit<MigrationCandidateInput, 'subscriptionCurrentPeriodEnd'> & {
  subscriptionCurrentPeriodEnd: string | null
}

function parseArgs(argv: string[]): { inputPath: string } {
  const inputIndex = argv.indexOf('--input')
  const inputPath = inputIndex >= 0 ? argv[inputIndex + 1] : undefined
  if (!inputPath) {
    throw new Error('usage: pnpm migration:membership:preview -- --input <repository-relative-json-path>')
  }
  if (path.isAbsolute(inputPath) || inputPath.includes('..')) {
    throw new Error('input_path_must_be_repository_relative')
  }
  return { inputPath }
}

function readCandidates(inputPath: string): MigrationCandidateInput[] {
  const absolutePath = path.join(process.cwd(), inputPath)
  const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error('input_must_be_array')

  return (parsed as SerializedCandidate[]).map((candidate) => ({
    ...candidate,
    subscriptionCurrentPeriodEnd: candidate.subscriptionCurrentPeriodEnd
      ? new Date(candidate.subscriptionCurrentPeriodEnd)
      : null,
  }))
}

export function buildMembershipMigrationPreviewMarkdown(inputs: MigrationCandidateInput[]): string {
  const candidates = inputs.map(classifyMigrationCandidate)
  const summary = summarizeMigrationCandidates(candidates)
  const lines = [
    '# JPV Bootcamp Membership Migration Preview',
    '',
    '## Safety boundary',
    '',
    '- Repository-only classification; no Stripe or database mutation was performed.',
    '- Eligible records still require a live Stripe invoice preview immediately before an approved update.',
    '- Manual-review and ineligible records must not enter an automatic migration batch.',
    '',
    '## Summary',
    '',
    `- Total: \`${summary.total}\``,
    `- Eligible: \`${summary.eligible}\``,
    `- Manual review: \`${summary.manual_review}\``,
    `- Ineligible: \`${summary.ineligible}\``,
    '',
    '## Candidates',
    '',
    '| Email | Cadence | Status | Eligibility | Reasons |',
    '| --- | --- | --- | --- | --- |',
    ...candidates.map((candidate) =>
      [
        candidate.normalizedEmail,
        candidate.targetCadence ?? 'unknown',
        candidate.subscriptionStatus ?? 'unknown',
        candidate.eligibility,
        candidate.reasons.join(', ') || 'none',
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    ),
    '',
  ]
  return lines.join('\n')
}

if (require.main === module) {
  const { inputPath } = parseArgs(process.argv.slice(2))
  process.stdout.write(buildMembershipMigrationPreviewMarkdown(readCandidates(inputPath)))
}
