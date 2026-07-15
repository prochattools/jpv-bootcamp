import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { DECISION_MANIFEST, DECISION_READY_SUMMARY, NOT_DECISION_READY_SUMMARY } from './release/decisionManifest'
import { runDecisionReadiness } from './release/runDecisionReadiness'

function main(): void {
  const logsA: string[] = []
  const summaryA = runDecisionReadiness({
    log(message) {
      logsA.push(message)
    },
  })
  const logsB: string[] = []
  const summaryB = runDecisionReadiness({
    log(message) {
      logsB.push(message)
    },
  })

  assert.equal(summaryA, DECISION_READY_SUMMARY)
  assert.equal(summaryB, DECISION_READY_SUMMARY)
  assert.deepEqual(logsA, logsB, 'decision readiness output must be deterministic')
  assert.match(logsA.join('\n'), /programme content/i)
  assert.match(logsA.join('\n'), /go\/no-go/i)

  const badDecision = readFileSync('docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md', 'utf8').replace(
    'Decision owner role: `Platform owner`',
    'Decision owner role: ``',
  )

  const failureLogs: string[] = []
  const failureSummary = runDecisionReadiness({
    readFile(path) {
      if (path === 'docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md') return badDecision
      return readFileSync(path, 'utf8')
    },
    log(message) {
      failureLogs.push(message)
    },
  })
  assert.equal(failureSummary, NOT_DECISION_READY_SUMMARY)
  assert.match(failureLogs.join('\n'), /decision owner role drifted/)

  const falseApproval = readFileSync('docs/decisions/CORE_GO_LIVE_DECISION.md', 'utf8').replace(
    'Current status: `NO-GO`',
    'Current status: `GO`',
  )
  const falseApprovalLogs: string[] = []
  const falseApprovalSummary = runDecisionReadiness({
    readFile(path) {
      if (path === 'docs/decisions/CORE_GO_LIVE_DECISION.md') return falseApproval
      return readFileSync(path, 'utf8')
    },
    log(message) {
      falseApprovalLogs.push(message)
    },
  })
  assert.equal(falseApprovalSummary, NOT_DECISION_READY_SUMMARY)
  assert.match(falseApprovalLogs.join('\n'), /core-go-live: GO is invalid/i)

  const runnerSource = readFileSync('scripts/release/runDecisionReadiness.ts', 'utf8')
  assert.doesNotMatch(runnerSource, /fetch\(|https?:\/\//)
  assert.doesNotMatch(runnerSource, /prisma migrate|payload:staging:migrate|deploy/i)
  assert.ok(DECISION_MANIFEST.every((entry) => runnerSource.includes('readFileSync') || entry.filePath.length > 0))

  console.log('decision_readiness_runner.test.ts passed')
}

main()
