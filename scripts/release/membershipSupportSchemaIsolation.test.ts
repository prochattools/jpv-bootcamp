import assert from 'node:assert/strict'

import { buildMembershipSupportSchemaIsolationReport, EXPECTED_BRANCH, type GitSnapshot } from './membershipSupportSchemaIsolation'

const snapshot: GitSnapshot = {
  branch: EXPECTED_BRANCH,
  head: '8927df9',
  statusLines: [' M docs/CURRENT_WORK_HANDOFF.md', ' M src/payload-types.ts', '?? docs/client/fixtures/'],
}

function run(): void {
  const liveReport = buildMembershipSupportSchemaIsolationReport()
  assert.equal(liveReport.ok, true)
  assert.match(liveReport.output, /MEMBERSHIP SUPPORT SCHEMA ISOLATION PLAN/)

  const report = buildMembershipSupportSchemaIsolationReport(snapshot)
  assert.equal(report.ok, true)
  assert.match(report.output, /MEMBERSHIP SUPPORT SCHEMA ISOLATION PLAN/)
  assert.match(report.output, /Protected dirty paths: src\/payload-types.ts, docs\/client\/fixtures\//)
  assert.match(report.output, /git worktree add \.\.\/jpv-bootcamp-schema-worktree HEAD/)
  assert.match(report.output, /payload generate:types/)
  assert.match(report.output, /payload generate:importmap/)

  const wrongBranch = buildMembershipSupportSchemaIsolationReport({
    ...snapshot,
    branch: 'main',
  })
  assert(wrongBranch.errors.some((error) => error.startsWith('branch_mismatch:')))
}

run()

console.log('membership support schema isolation tests passed')
