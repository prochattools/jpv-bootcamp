import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  buildMembershipMigrationPreviewJson,
  buildMembershipMigrationPreviewMarkdown,
  type MigrationCandidateInput,
  type SerializedMigrationCandidateInput,
} from '../../src/lib/billing/membershipMigrationPreview'

type PreviewFormat = 'markdown' | 'json'

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseArgs(argv: string[]): { inputPath: string; format: PreviewFormat } {
  const inputIndex = argv.indexOf('--input')
  const inputPath = inputIndex >= 0 ? argv[inputIndex + 1] : undefined
  if (!inputPath) {
    throw new Error('usage: pnpm migration:membership:preview -- --input <repository-relative-json-path>')
  }
  if (path.isAbsolute(inputPath) || inputPath.includes('..')) {
    throw new Error('input_path_must_be_repository_relative')
  }

  const formatIndex = argv.indexOf('--format')
  const format = (formatIndex >= 0 ? argv[formatIndex + 1] : 'markdown') as PreviewFormat
  if (format !== 'markdown' && format !== 'json') {
    throw new Error('format_must_be_markdown_or_json')
  }

  return { inputPath, format }
}

function readCandidates(inputPath: string): MigrationCandidateInput[] {
  const absolutePath = path.join(process.cwd(), inputPath)
  const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error('input_must_be_array')

  return (parsed as SerializedMigrationCandidateInput[]).map((candidate) => ({
    ...candidate,
    stripeSubscriptionProjection: {
      ...candidate.stripeSubscriptionProjection,
      currentPeriodStart: parseDate(candidate.stripeSubscriptionProjection.currentPeriodStart),
      currentPeriodEnd: parseDate(candidate.stripeSubscriptionProjection.currentPeriodEnd),
    },
    preview: candidate.preview
      ? {
          ...candidate.preview,
          previewTimestamp: parseDate(candidate.preview.previewTimestamp),
          nextRenewalDate: parseDate(candidate.preview.nextRenewalDate),
        }
      : null,
  }))
}

export function buildMembershipMigrationPreviewMarkdownReport(inputs: MigrationCandidateInput[]): string {
  return buildMembershipMigrationPreviewMarkdown(inputs)
}

export function buildMembershipMigrationPreviewJsonReport(inputs: MigrationCandidateInput[]): string {
  return buildMembershipMigrationPreviewJson(inputs)
}

if (require.main === module) {
  const { inputPath, format } = parseArgs(process.argv.slice(2))
  const candidates = readCandidates(inputPath)
  process.stdout.write(
    format === 'json'
      ? buildMembershipMigrationPreviewJsonReport(candidates)
      : buildMembershipMigrationPreviewMarkdownReport(candidates),
  )
}
