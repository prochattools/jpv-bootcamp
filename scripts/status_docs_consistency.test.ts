import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RELEASE_TEST_MANIFEST } from './release/releaseTestManifest'

async function main(): Promise<void> {
  const releaseCount = RELEASE_TEST_MANIFEST.length
  const files = {
    approvalPacket: 'docs/client/MIGRATION_APPROVAL_PACKET.md',
    approvalStatus: 'docs/client/MIGRATION_APPROVAL_STATUS.md',
    evidenceChecklist: 'docs/client/EVIDENCE_REVIEW_CHECKLIST.md',
    integrationPlan: 'docs/PAYLOAD_INTEGRATION_PLAN.md',
    operatorHandoff: 'docs/client/OPERATOR_HANDOFF_SUMMARY.md',
    previewReadiness: 'docs/PREVIEW_RELEASE_READINESS.md',
    providerEvidence: 'docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md',
    providerReadiness: 'docs/client/PROVIDER_EMAIL_READINESS.md',
    readme: 'docs/client/README.md',
    clientContentRequest: 'docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md',
    frontEndContentTracker: 'docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md',
    frontEndAcceptanceEvidence: 'docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md',
    roadmap: 'docs/client/ROADMAP_PROGRESS_STATUS.md',
    summaryV34: 'docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md',
    reviewPacket: 'docs/client/PAYLOAD_ONLY_FREE_PRO_REVIEW_PACKET.md',
    rehearsalRunbook: 'docs/client/MIGRATION_REHEARSAL_RUNBOOK.md',
    stagingChecklist: 'docs/client/STAGING_SMOKE_CHECKLIST.md',
    stagingEvidence: 'docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md',
    statusProcedure: 'docs/client/STATUS_UPDATE_PROCEDURE.md',
  } as const

  const entries = await Promise.all(
    Object.entries(files).map(async ([name, path]) => [name, await readFile(path, 'utf8')] as const),
  )
  const docs = Object.fromEntries(entries) as Record<keyof typeof files, string>

  const allDocs = Object.values(docs).join('\n')

  const noSecrets = [
    /sk_live_/i,
    /sk_test_/i,
    /pk_live_/i,
    /pk_test_/i,
    /whsec_/i,
    /dokploy_/i,
    /api_key=/i,
    /password=/i,
    /BEGIN PRIVATE KEY/i,
    /BEGIN RSA PRIVATE KEY/i,
  ]

  for (const [name, source] of Object.entries(docs)) {
    assert.match(source, /feature\/course-branding-and-preview/, `${name} should mention the feature branch`)
    for (const secretPattern of noSecrets) {
      assert.doesNotMatch(source, secretPattern, `${name} should not contain secret-looking material`)
    }
  }

  assert.match(docs.statusProcedure, /git log --oneline -1/)
  assert.match(docs.statusProcedure, /Do not touch `main`/)
  assert.match(docs.statusProcedure, /Migrations applied remains `No` unless a separate approved migration record exists\./)
  assert.match(docs.statusProcedure, /docs\/client\/ROADMAP_PROGRESS_STATUS\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/MIGRATION_APPROVAL_PACKET\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/MIGRATION_APPROVAL_STATUS\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/MIGRATION_REHEARSAL_RUNBOOK\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/OPERATOR_HANDOFF_SUMMARY\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/EVIDENCE_REVIEW_CHECKLIST\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/STAGING_SMOKE_CHECKLIST\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/STAGING_SMOKE_EVIDENCE_TEMPLATE\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/PROVIDER_EMAIL_READINESS\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/PROVIDER_EMAIL_EVIDENCE_TEMPLATE\.md/)
  assert.match(docs.statusProcedure, /docs\/client\/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_6\.docx/)
  assert.match(docs.statusProcedure, /docs\/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT\.md/)
  assert.match(docs.statusProcedure, /pnpm toolchain:check/)

  assert.match(docs.roadmap, /Status update procedure: `docs\/client\/STATUS_UPDATE_PROCEDURE\.md`/)
  assert.match(docs.roadmap, /feature\/course-branding-and-preview/)
  assert.match(docs.roadmap, /Do not apply migrations\./)
  assert.match(docs.roadmap, /Do not touch `main`/)
  assert.match(docs.roadmap, /Migrations applied \| None \|/)
  assert.match(docs.roadmap, /Current client truth: `docs\/client\/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_6\.docx`/)
  assert.match(docs.roadmap, /Version 3\.4 is the prior progress baseline/)
  assert.match(docs.roadmap, /Migration approval \| Blocked pending table-plan-to-Free/)
  assert.match(docs.roadmap, /Decision readiness \| `DECISION-READY, EXTERNAL APPROVALS PENDING`/)
  assert.match(docs.roadmap, /22 July front-end milestone/i)
  assert.match(docs.roadmap, /client content.*by 15 July/i)
  assert.match(docs.roadmap, /Provider\/email acceptance \| Pending operator verification \|/)
  assert.match(docs.roadmap, /Local browser validation passed; staging smoke pending/)
  assert.match(docs.roadmap, /historical baseline, `af6de62 docs: record core go-live readiness` as the previous readiness baseline/)
  assert.match(docs.roadmap, /`d55229f test: enforce programme content readiness` as the current validated baseline/)
  assert.match(docs.roadmap, /Core go-live implementation and deterministic local validation are complete/i)
  assert.match(docs.roadmap, /not ready for the controlled staging release process/i)
  assert.match(docs.roadmap, /M0-01 through M0-09/)
  assert.match(docs.roadmap, /M1-01 through M1-06/)
  assert.match(docs.roadmap, new RegExp(String.raw`\`pnpm test:release\` passed \`${releaseCount}\/${releaseCount}\``))
  assert.match(docs.roadmap, /`pnpm test:e2e` passed `58\/58`/)
  assert.match(docs.roadmap, /`pnpm staging:decision-readiness` passed with `DECISION-READY, EXTERNAL APPROVALS PENDING`\./)
  assert.match(docs.roadmap, /`pnpm staging:migration-preflight`/)
  assert.match(docs.roadmap, /`pnpm staging:smoke-plan`/)
  assert.match(docs.roadmap, /Repository inventory now includes deterministic release-manifest coverage and Playwright launch browser E2E\./)

  assert.match(docs.operatorHandoff, /Version 3\.6 current client go-live plan; Version 3\.4 is the prior progress baseline/)
  assert.match(docs.operatorHandoff, /Current validated readiness baseline: `d55229f test: enforce programme content readiness`/)
  assert.match(docs.operatorHandoff, /Front-end website go-live milestone: 22 July 2026/)
  assert.match(docs.operatorHandoff, /Branch tip verification: verify the current tip with `git log --oneline -1` before operator action/)
  assert.match(docs.operatorHandoff, /Status update procedure: `docs\/client\/STATUS_UPDATE_PROCEDURE\.md`/)
  assert.match(docs.operatorHandoff, /Toolchain check: `pnpm toolchain:check`/)
  assert.match(docs.operatorHandoff, /Decision-readiness check: `pnpm staging:decision-readiness`/)
  assert.match(docs.operatorHandoff, /Static preflight: `pnpm staging:static-preflight`/)
  assert.match(docs.operatorHandoff, /Migration rehearsal: `pnpm staging:migration-rehearsal`/)
  assert.match(docs.operatorHandoff, /Provider simulation: `pnpm staging:provider-simulation`/)
  assert.match(docs.operatorHandoff, /Local simulated smoke: `pnpm staging:smoke-simulated`/)
  assert.match(docs.operatorHandoff, /Migrations applied: `No`/)
  assert.match(docs.operatorHandoff, new RegExp(String.raw`Deterministic non-browser release gate: \`pnpm test:release\` \(\`${releaseCount}\/${releaseCount}\`\)`))
  assert.match(docs.operatorHandoff, /Launch browser E2E: `pnpm test:e2e` \(`58\/58`, desktop and mobile Chromium\)/)
  assert.match(docs.operatorHandoff, /Decision-readiness summary: `DECISION-READY, EXTERNAL APPROVALS PENDING`/)
  assert.match(docs.operatorHandoff, /Repository-owned staging operations contract/)
  assert.match(docs.operatorHandoff, /Rollback evidence checklist: `docs\/release\/ROLLBACK_EVIDENCE_CHECKLIST\.md`/)
  assert.match(docs.operatorHandoff, /pnpm staging:migration-preflight/)
  assert.match(docs.operatorHandoff, /pnpm staging:migration-rehearsal/)
  assert.match(docs.operatorHandoff, /pnpm staging:provider-simulation/)
  assert.match(docs.operatorHandoff, /pnpm staging:smoke-plan/)
  assert.match(docs.operatorHandoff, /pnpm staging:smoke-simulated/)
  assert.match(docs.operatorHandoff, /pnpm release:evidence:dry-run/)
  assert.match(docs.operatorHandoff, /Representative 8-week programme content approval or explicit placeholder acceptance/)
  assert.match(docs.operatorHandoff, /No `main` branch work\./)

  assert.match(docs.reviewPacket, /Version 3\.4 summary: `docs\/client\/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY\.md`/)
  assert.match(docs.reviewPacket, /Latest verified branch tip before this pass: `4a8f79b chore: guard against committed draft evidence`/)
  assert.match(docs.reviewPacket, /Verify the current branch tip with `git log --oneline -1` before operator action\./)
  assert.match(docs.reviewPacket, /Status update procedure: `docs\/client\/STATUS_UPDATE_PROCEDURE\.md`/)
  assert.match(docs.reviewPacket, /Toolchain check: `pnpm toolchain:check`/)
  assert.match(docs.reviewPacket, /Static preflight: `pnpm staging:static-preflight`/)
  assert.match(docs.reviewPacket, /Do not touch `main`/)
  assert.match(docs.reviewPacket, /No migrations have been applied\./)
  assert.match(docs.reviewPacket, /table-plan-to-Free mapping requires explicit target-environment approval before migration execution\./)
  assert.match(docs.reviewPacket, /22 July 2026 front-end website go-live milestone/)
  assert.match(docs.reviewPacket, /`pnpm staging:static-preflight` is a local-only validation bundle and does not generate or validate operator approval evidence\./)
  assert.match(docs.reviewPacket, /`pnpm evidence:create` is separate from static preflight and produces local draft evidence only\./)

  assert.match(docs.approvalPacket, /Do not touch `main`/)
  assert.match(docs.approvalPacket, /Current branch tip must be verified with `git log --oneline -1` before operator action\./)
  assert.match(docs.approvalPacket, /Status update procedure: `docs\/client\/STATUS_UPDATE_PROCEDURE\.md`/)
  assert.match(docs.approvalPacket, /No migrations have been applied\./)
  assert.match(docs.approvalPacket, /Approve table-plan-to-Free mapping for the target environment\./)

  assert.match(docs.approvalStatus, /Status update procedure: `docs\/client\/STATUS_UPDATE_PROCEDURE\.md`/)
  assert.match(docs.approvalStatus, /Migrations applied: `No`/)
  assert.match(docs.approvalStatus, /Target-environment table-plan-to-Free approval: `Pending`/)
  assert.match(docs.approvalStatus, /Do not apply migrations\./)
  assert.match(docs.approvalStatus, /Do not touch main\./)
  assert.match(docs.approvalStatus, /Staging smoke run: `Pending`/)

  assert.match(docs.rehearsalRunbook, /feature\/course-branding-and-preview/)
  assert.match(docs.rehearsalRunbook, /Do not touch `main`/)
  assert.match(docs.rehearsalRunbook, /Do not apply migrations unless the target-environment approval checklist is signed off\./)
  assert.match(docs.rehearsalRunbook, /Table-plan-to-Free mapping approved/)
  assert.match(docs.rehearsalRunbook, /Account-column rename approved/)

  assert.match(docs.evidenceChecklist, /Branch is `feature\/course-branding-and-preview`/)
  assert.match(docs.evidenceChecklist, /Migrations applied remains `No`/)
  assert.match(docs.evidenceChecklist, /Old WordPress, Fluent, and portal-path checks were recorded/)
  assert.match(docs.evidenceChecklist, /Reviewer signoff exists/)
  assert.match(docs.evidenceChecklist, /`pnpm staging:static-preflight` was run before manual staging smoke or evidence capture/)

  assert.match(docs.stagingChecklist, /feature\/course-branding-and-preview/)
  assert.match(docs.stagingChecklist, /Migrations applied: `No`/)
  assert.match(docs.stagingChecklist, /Verify deploy did not auto-apply migrations\./)
  assert.match(docs.stagingChecklist, /Verify invalid and legacy checkout plans fail safely/)

  assert.match(docs.stagingEvidence, /feature\/course-branding-and-preview/)
  assert.match(docs.stagingEvidence, /Migrations applied: `No`/)
  assert.match(docs.stagingEvidence, /No migrations were applied\./)
  assert.match(docs.stagingEvidence, /main was not touched/)

  assert.match(docs.providerReadiness, /checkout accepts only `plan=pro` and optional `billing=monthly\|annual`/)
  assert.match(docs.providerReadiness, /Do not apply migrations from this checklist\./)
  assert.match(docs.providerReadiness, /Migrations applied: `No`/)

  assert.match(docs.providerEvidence, /feature\/course-branding-and-preview/)
  assert.match(docs.providerEvidence, /Migrations applied: `No`/)
  assert.match(docs.providerEvidence, /No migrations were applied\./)
  assert.match(docs.providerEvidence, /main was not touched\./)

  assert.match(docs.readme, /Status Update Procedure/)
  assert.match(docs.readme, /JPV Bootcamp Go-Live Plan v3\.4 Summary/)
  assert.match(docs.readme, /roadmap documents stay linked from this index and the review packet/)
  assert.match(docs.readme, /pnpm toolchain:check/)
  assert.match(docs.readme, /`pnpm staging:static-preflight`/)

  assert.match(docs.integrationPlan, /feature\/course-branding-and-preview/)
  assert.match(docs.integrationPlan, /Verify the exact branch tip with `git log --oneline -1` before operator action\./)
  assert.match(docs.integrationPlan, /No migrations have been applied\./)
  assert.match(docs.integrationPlan, /Do not touch `main`/)
  assert.match(docs.integrationPlan, /H1-02 \| Add one complete release test command and browser E2E suite/)

  assert.match(docs.previewReadiness, /feature\/course-branding-and-preview/)
  assert.match(docs.previewReadiness, /Verify the exact branch tip with `git log --oneline -1` before operator action\./)
  assert.match(docs.previewReadiness, /No migrations have been applied\./)
  assert.match(docs.previewReadiness, /Do not touch `main`/)
  assert.match(docs.previewReadiness, /Status update procedure: `docs\/client\/STATUS_UPDATE_PROCEDURE\.md`/)
  assert.match(docs.previewReadiness, /`pnpm staging:static-preflight`/)
  assert.match(docs.previewReadiness, /NOT READY FOR CONTROLLED STAGING RELEASE PROCESS/)
  assert.match(docs.previewReadiness, /DECISION-READY FOR CONTROLLED STAGING APPROVAL/)
  assert.match(docs.previewReadiness, /DECISION-READY, EXTERNAL APPROVALS PENDING/)
  assert.match(docs.previewReadiness, new RegExp(String.raw`\`pnpm test:release\` passed \`${releaseCount}\/${releaseCount}\``))
  assert.match(docs.previewReadiness, /`pnpm test:e2e` passed `58\/58`/)
  assert.match(docs.previewReadiness, /`pnpm staging:decision-readiness` passed with `DECISION-READY, EXTERNAL APPROVALS PENDING`/)
  assert.match(docs.previewReadiness, /`pnpm staging:migration-preflight`/)
  assert.match(docs.previewReadiness, /`pnpm staging:migration-rehearsal`/)
  assert.match(docs.previewReadiness, /`pnpm staging:provider-simulation`/)
  assert.match(docs.previewReadiness, /`pnpm staging:smoke-plan`/)
  assert.match(docs.previewReadiness, /`pnpm staging:smoke-simulated`/)
  assert.match(docs.previewReadiness, /`pnpm release:evidence:dry-run`/)
  assert.match(docs.previewReadiness, /support-request migration remains unapplied/i)
  assert.match(docs.previewReadiness, /M2-01 remains post-core/i)

  for (const secretPattern of noSecrets) {
    assert.doesNotMatch(allDocs, secretPattern, `combined docs should not contain ${secretPattern}`)
  }

  console.log('status_docs_consistency.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
