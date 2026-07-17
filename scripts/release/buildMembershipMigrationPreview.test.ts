import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildMembershipMigrationPreviewJsonReport,
  buildMembershipMigrationPreviewMarkdownReport,
} from './buildMembershipMigrationPreview'
import type { MigrationCandidateInput, SerializedMigrationCandidateInput } from '../../src/lib/billing/membershipMigrationPreview'

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function readFixture(): SerializedMigrationCandidateInput[] {
  return JSON.parse(
    readFileSync('scripts/fixtures/membership-migration-preview.json', 'utf8'),
  ) as SerializedMigrationCandidateInput[]
}

function toInputs(): MigrationCandidateInput[] {
  return readFixture().map((candidate) => ({
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

const inputs = toInputs()
const markdown = buildMembershipMigrationPreviewMarkdownReport(inputs)
const json = buildMembershipMigrationPreviewJsonReport(inputs)

assert.match(markdown, /JPV Bootcamp Membership Migration Preview/)
assert.match(markdown, /candidate-a|eligible-monthly@example.com|manual-review@example.com|ineligible@example.com/)
assert.match(json, /"candidateCount": 3/)
assert.match(json, /"same_price_candidate"/)
assert.match(json, /"GBP"/)

const parsed = JSON.parse(json) as {
  totals: { candidateCount: number }
  candidates: Array<{ stableCandidateId: string }>
}

assert.equal(parsed.totals.candidateCount, 3)
assert.deepEqual(parsed.candidates.map((candidate) => candidate.stableCandidateId), [
  'eligible-monthly',
  'ineligible',
  'manual-review',
])

console.log('buildMembershipMigrationPreview.test.ts passed')
