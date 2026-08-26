import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
  const [
    stagingEvidence,
    providerEvidence,
    approvalPacket,
    approvalStatus,
    rehearsalRunbook,
    stagingChecklist,
    providerReadiness,
    roadmap,
    reviewPacket,
  ] = await Promise.all([
    readFile('docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md', 'utf8'),
    readFile('docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md', 'utf8'),
    readFile('docs/client/MIGRATION_APPROVAL_PACKET.md', 'utf8'),
    readFile('docs/client/MIGRATION_APPROVAL_STATUS.md', 'utf8'),
    readFile('docs/client/MIGRATION_REHEARSAL_RUNBOOK.md', 'utf8'),
    readFile('docs/client/STAGING_SMOKE_CHECKLIST.md', 'utf8'),
    readFile('docs/client/PROVIDER_EMAIL_READINESS.md', 'utf8'),
    readFile('docs/client/ROADMAP_PROGRESS_STATUS.md', 'utf8'),
    readFile('docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md', 'utf8'),
  ])

  assert.match(stagingEvidence, /feature\/course-branding-and-preview/)
  assert.match(providerEvidence, /feature\/course-branding-and-preview/)
  assert.match(stagingEvidence, /Migrations applied:\s*`No`/)
  assert.match(providerEvidence, /Migrations applied:\s*`No`/)
  assert.match(stagingEvidence, /Do not paste secrets|No secrets were pasted/)
  assert.match(providerEvidence, /Do not paste secret values|No migrations applied/)
  assert.match(stagingEvidence, /main was not touched/i)
  assert.match(providerEvidence, /main was not touched/i)
  assert.match(stagingEvidence, /No migrations were applied/i)
  assert.match(providerEvidence, /No migrations were applied/i)
  assert.match(stagingEvidence, /Result:/)
  assert.match(stagingEvidence, /Evidence:/)
  assert.match(providerEvidence, /Result:/)
  assert.match(providerEvidence, /Evidence:/)

  for (const source of [
    stagingEvidence,
    providerEvidence,
    approvalPacket,
    approvalStatus,
    rehearsalRunbook,
    stagingChecklist,
    providerReadiness,
    roadmap,
    reviewPacket,
  ]) {
    assert.doesNotMatch(
      source,
      /sk_live_|sk_test_|pk_live_|pk_test_|whsec_|dokploy_|api_key=|password=|BEGIN PRIVATE KEY|BEGIN RSA PRIVATE KEY/i,
    )
  }

  assert.match(approvalPacket, /Migration Approval Packet/)
  assert.match(approvalStatus, /Current status:\*\*\s*`STAGING MIGRATION COMPLETE`/)
  assert.match(rehearsalRunbook, /This runbook does not authorize migration execution\./)
  assert.match(stagingChecklist, /Staging Smoke Checklist/)
  assert.match(providerReadiness, /Provider and Email Readiness/)
  assert.match(roadmap, /does not authorize further staging writes or any production migration\./)
  assert.match(reviewPacket, /Migration approval status/)

  console.log('staging_evidence_static.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
