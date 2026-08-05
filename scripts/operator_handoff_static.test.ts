import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const [
    operatorHandoff,
    evidenceChecklist,
    roadmap,
    approvalPacket,
    approvalStatus,
    rehearsalRunbook,
    stagingChecklist,
    stagingEvidence,
    providerReadiness,
    providerEvidence,
  ] = await Promise.all([
    readFile('docs/client/OPERATOR_HANDOFF_SUMMARY.md', 'utf8'),
    readFile('docs/client/EVIDENCE_REVIEW_CHECKLIST.md', 'utf8'),
    readFile('docs/client/ROADMAP_PROGRESS_STATUS.md', 'utf8'),
    readFile('docs/client/MIGRATION_APPROVAL_PACKET.md', 'utf8'),
    readFile('docs/client/MIGRATION_APPROVAL_STATUS.md', 'utf8'),
    readFile('docs/client/MIGRATION_REHEARSAL_RUNBOOK.md', 'utf8'),
    readFile('docs/client/STAGING_SMOKE_CHECKLIST.md', 'utf8'),
    readFile('docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md', 'utf8'),
    readFile('docs/client/PROVIDER_EMAIL_READINESS.md', 'utf8'),
    readFile('docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md', 'utf8'),
  ])

  assert.match(operatorHandoff, /feature\/course-branding-and-preview/)
  assert.match(operatorHandoff, /Migrations applied:\s*`No`|Migration inventory.*29\/29/i)
  assert.match(operatorHandoff, /do not touch `main`/i)
  assert.match(operatorHandoff, /No migrations without written target-environment approval\./)
  assert.match(evidenceChecklist, /If migrations are marked applied but no separate approved migration record exists, stop and escalate\./)
  assert.match(evidenceChecklist, /No secrets were pasted/)
  assert.match(evidenceChecklist, /Staging smoke evidence is complete/)
  assert.match(evidenceChecklist, /Provider\/email evidence is complete/)
  assert.match(roadmap, /does not authorize further staging writes or any production migration\./)
  assert.match(approvalPacket, /Migration Approval Packet/)
  assert.match(approvalStatus, /Migration Approval Status/)
  assert.match(rehearsalRunbook, /Migration Rehearsal Runbook/)
  assert.match(stagingChecklist, /Staging Smoke Checklist/)
  assert.match(stagingEvidence, /Staging Smoke Evidence Template/)
  assert.match(providerReadiness, /Provider and Email Readiness/)
  assert.match(providerEvidence, /Provider and Email Evidence Template/)

  for (const source of [operatorHandoff, evidenceChecklist, roadmap, approvalPacket, approvalStatus, rehearsalRunbook, stagingChecklist, stagingEvidence, providerReadiness, providerEvidence]) {
    assert.doesNotMatch(
      source,
      /sk_live_|sk_test_|pk_live_|pk_test_|whsec_|dokploy_|api_key=|password=|BEGIN PRIVATE KEY|BEGIN RSA PRIVATE KEY/i,
    )
  }

  console.log('operator_handoff_static.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
