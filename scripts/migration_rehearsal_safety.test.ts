import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const [
    runbookSource,
    approvalStatusSource,
    roadmapSource,
    stagingSmokeSource,
    providerReadinessSource,
    approvalPacketSource,
  ] = await Promise.all([
    readFile('docs/client/MIGRATION_REHEARSAL_RUNBOOK.md', 'utf8'),
    readFile('docs/client/MIGRATION_APPROVAL_STATUS.md', 'utf8'),
    readFile('docs/client/ROADMAP_PROGRESS_STATUS.md', 'utf8'),
    readFile('docs/client/STAGING_SMOKE_CHECKLIST.md', 'utf8'),
    readFile('docs/client/PROVIDER_EMAIL_READINESS.md', 'utf8'),
    readFile('docs/client/MIGRATION_APPROVAL_PACKET.md', 'utf8'),
  ])

  assert.match(runbookSource, /This runbook does not authorize migration execution\./)
  assert.match(approvalStatusSource, /Current status:\s*`BLOCKED`/)
  assert.match(approvalStatusSource, /Migrations applied:\s*`No`/)
  assert.match(approvalStatusSource, /Target-environment table-plan-to-Free approval:\s*`Pending`/)
  assert.match(approvalPacketSource, /Approve table-plan-to-Free mapping for the target environment\./)
  assert.match(
    roadmapSource,
    /The repository contains 35 canonical Payload migration registrations\. Registration and the deployment health inventory are not database-applied state\./i,
  )
  assert.match(roadmapSource, /has not been run against staging.*authorized operator captures the read-only report/is)
  assert.match(roadmapSource, /does not authorize further staging writes or any production migration/i)
  assert.match(stagingSmokeSource, /# Staging Smoke Checklist/)
  assert.match(providerReadinessSource, /# Provider and Email Readiness/)
  assert.match(approvalPacketSource, /# Migration Approval Packet/)

  const combined = [
    runbookSource,
    approvalStatusSource,
    roadmapSource,
    stagingSmokeSource,
    providerReadinessSource,
    approvalPacketSource,
  ].join('\n')

  assert.doesNotMatch(combined, /sk_live_|sk_test_|pk_live_|pk_test_|whsec_|dokploy_|api_key=|password=|BEGIN PRIVATE KEY|BEGIN RSA PRIVATE KEY/i)

  console.log('migration_rehearsal_safety.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
