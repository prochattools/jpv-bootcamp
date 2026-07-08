import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function main(): void {
  const summaryPath = 'docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md'
  const readmePath = 'docs/client/README.md'
  const roadmapPath = 'docs/client/ROADMAP_PROGRESS_STATUS.md'
  const integrationPlanPath = 'docs/PAYLOAD_INTEGRATION_PLAN.md'
  const previewReadinessPath = 'docs/PREVIEW_RELEASE_READINESS.md'
  const docxPath = 'docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_4.docx'

  assert.ok(existsSync(summaryPath), `${summaryPath} should exist`)

  const summary = readFileSync(summaryPath, 'utf8')
  const readme = readFileSync(readmePath, 'utf8')
  const roadmap = readFileSync(roadmapPath, 'utf8')
  const integrationPlan = readFileSync(integrationPlanPath, 'utf8')
  const previewReadiness = readFileSync(previewReadinessPath, 'utf8')

  assert.match(summary, /Version 3\.4/)
  assert.match(summary, /Version 3\.3 baseline/)
  assert.match(summary, /4a8f79b/)
  assert.match(summary, /22 July 2026/)
  assert.match(summary, /23 July 2026/)
  assert.match(summary, /24 July 2026/)
  assert.match(summary, /Wednesday 15 July 2026/)
  assert.match(summary, /front-end website go-live milestone/)
  assert.match(summary, /No migrations have been applied|No migrations applied/i)
  assert.match(summary, /table-plan-to-Free approval/i)
  assert.match(summary, /feature\/course-branding-and-preview/)

  assert.match(readme, /JPV Bootcamp Go-Live Plan v3\.4 Summary/)
  assert.match(readme, /JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY\.md/)

  if (existsSync(docxPath)) {
    assert.match(readme, /JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_4\.docx/)
  }

  assert.match(roadmap, /Version 3\.4/)
  assert.match(roadmap, /22 July 2026/)
  assert.match(roadmap, /15 July 2026/)

  assert.match(integrationPlan, /15 July 2026/)
  assert.match(integrationPlan, /22 July 2026/)

  assert.match(previewReadiness, /15 July 2026/)
  assert.match(previewReadiness, /22 July 2026/)

  console.log('v34_go_live_plan_static.test.ts passed')
}

main()
