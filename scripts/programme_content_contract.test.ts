import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PROGRAMME_CONTENT_FORMAT,
  REQUIRED_PROGRAMME_WEEK_COUNT,
  buildProgrammeAcceptanceReportMarkdown,
  checksumText,
  parseProgrammeContentPackage,
  stablePackageJson,
  validateProgrammeContentPackage,
  type ProgrammeContentPackage,
} from './content/programmeContentContract'

const FIXTURE_PATH = 'scripts/content/fixtures/programme-content.example.json'

function loadFixture(): ProgrammeContentPackage {
  return parseProgrammeContentPackage(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')))
}

function validateFixture(packageData: ProgrammeContentPackage) {
  return validateProgrammeContentPackage(
    packageData,
    FIXTURE_PATH,
    FIXTURE_PATH,
    checksumText(stablePackageJson(packageData)),
  )
}

function makeApprovedPackage(): ProgrammeContentPackage {
  const fixture = loadFixture()
  return {
    ...fixture,
    packagePurpose: 'client_submission',
    programme: {
      ...fixture.programme,
      status: 'approved',
      publicationIntent: 'approved_for_import',
      version: '1.0.0',
    },
    weeks: fixture.weeks.map((week) => ({
      ...week,
      status: 'approved',
      lessons: week.lessons.map((lesson) => ({
        ...lesson,
        status: 'approved',
        resources: lesson.resources.map((resource) => ({
          ...resource,
          status: 'approved',
        })),
      })),
    })),
    approval: {
      approvalStatus: 'approved',
      approver: 'Client Approver',
      approvalDate: '2026-07-15',
      approvalReference: 'docs/client/evidence/programme-approval.md',
      explicitClientApproval: true,
      publicationApproved: true,
      notes: 'Approved in-memory test package.',
    },
  }
}

function assertStructuralButNotEligible(): void {
  const result = validateFixture(loadFixture())
  assert.equal(result.packageData.packageFormat, PROGRAMME_CONTENT_FORMAT)
  assert.equal(result.packageData.programme.weekCount, REQUIRED_PROGRAMME_WEEK_COUNT)
  assert.equal(result.structuralValid, true)
  assert.equal(result.releaseEligible, false)
  assert.equal(result.errors.length, 0)
  assert.equal(result.blockers.some((issue) => issue.code === 'test_fixture_not_publishable'), true)
  assert.equal(result.blockers.some((issue) => issue.code === 'approval_missing'), true)
}

function assertApprovedPackageEligible(): void {
  const result = validateFixture(makeApprovedPackage())
  assert.equal(result.structuralValid, true)
  assert.equal(result.releaseEligible, true)
  assert.equal(result.errors.length, 0)
  assert.equal(result.blockers.length, 0)
}

function assertUnknownFieldsRejected(): void {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
  fixture.unknownField = 'bad'
  assert.throws(() => parseProgrammeContentPackage(fixture), /unknown_field/)
}

function assertDuplicateIdsRejected(): void {
  const fixture = loadFixture()
  fixture.weeks[1].id = fixture.weeks[0].id
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, false)
  assert.equal(result.errors.some((issue) => issue.code === 'duplicate_week_id'), true)
}

function assertDuplicateOrderingRejected(): void {
  const fixture = loadFixture()
  fixture.weeks[1].sequence = fixture.weeks[0].sequence
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, false)
  assert.equal(result.errors.some((issue) => issue.code === 'duplicate_week_sequence'), true)
}

function assertMissingWeekRejected(): void {
  const fixture = loadFixture()
  fixture.weeks.pop()
  fixture.programme.weekCount = 8
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, false)
  assert.equal(result.errors.some((issue) => issue.code === 'week_array_count_invalid'), true)
}

function assertWrongWeekCountRejected(): void {
  const fixture = loadFixture()
  fixture.programme.weekCount = 7
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, false)
  assert.equal(result.errors.some((issue) => issue.code === 'week_count_invalid'), true)
}

function assertEmptyFieldsRejected(): void {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    programme: { title: string }
  }
  fixture.programme.title = '   '
  assert.throws(() => parseProgrammeContentPackage(fixture), /empty_string/)
}

function assertUnsafeUrlRejected(): void {
  const fixture = loadFixture()
  fixture.weeks[0].lessons[0].resources[0].source = 'javascript:alert(1)'
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, false)
  assert.equal(result.errors.some((issue) => issue.code === 'unsafe_url_protocol'), true)
}

function assertUnsupportedProtocolRejected(): void {
  const fixture = loadFixture()
  fixture.approval.approvalReference = 'file:///tmp/approval.md'
  fixture.approval.approvalStatus = 'approved'
  fixture.approval.approver = 'Client Approver'
  fixture.approval.approvalDate = '2026-07-15'
  fixture.approval.explicitClientApproval = true
  fixture.approval.publicationApproved = true
  fixture.packagePurpose = 'client_submission'
  fixture.programme.publicationIntent = 'approved_for_import'
  fixture.programme.status = 'approved'
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, false)
  assert.equal(result.errors.some((issue) => issue.code === 'unsafe_url_protocol'), true)
}

function assertPlaceholderMarkersBlocked(): void {
  const fixture = makeApprovedPackage()
  fixture.weeks[0].title = 'Placeholder title'
  const result = validateFixture(fixture)
  assert.equal(result.structuralValid, true)
  assert.equal(result.releaseEligible, false)
  assert.equal(result.blockers.some((issue) => issue.code === 'placeholder_marker'), true)
}

function assertMissingApprovalEvidenceRejected(): void {
  const fixture = makeApprovedPackage()
  fixture.approval.approvalReference = null
  const result = validateFixture(fixture)
  assert.equal(result.releaseEligible, false)
  assert.equal(result.blockers.some((issue) => issue.code === 'approval_reference_missing'), true)
}

function assertDraftContentCannotBeEligible(): void {
  const fixture = loadFixture()
  const result = validateFixture(fixture)
  assert.equal(result.releaseEligible, false)
}

function assertAcceptanceReportDeterministic(): void {
  const result = validateFixture(loadFixture())
  const reportA = buildProgrammeAcceptanceReportMarkdown(result)
  const reportB = buildProgrammeAcceptanceReportMarkdown(result)
  assert.equal(reportA, reportB)
  assert.match(reportA, /release eligibility: ineligible/)
  assert.match(reportA, /approval status: not_approved/)
}

try {
  assertStructuralButNotEligible()
  assertApprovedPackageEligible()
  assertUnknownFieldsRejected()
  assertDuplicateIdsRejected()
  assertDuplicateOrderingRejected()
  assertMissingWeekRejected()
  assertWrongWeekCountRejected()
  assertEmptyFieldsRejected()
  assertUnsafeUrlRejected()
  assertUnsupportedProtocolRejected()
  assertPlaceholderMarkersBlocked()
  assertMissingApprovalEvidenceRejected()
  assertDraftContentCannotBeEligible()
  assertAcceptanceReportDeterministic()
  console.log('programme_content_contract.test.ts passed')
} catch (error) {
  console.error('programme_content_contract.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
